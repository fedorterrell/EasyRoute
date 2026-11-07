// Easy Route ! — position du lieu : coordonnées, géocodage, suggestions de lieux (Photon / Nominatim), lien Google Maps collé.
import { $, els, say, shared, st } from "./core.js";
import { render } from "./links.js";
import { project, schedule, syncPois } from "./sheet.js";
import { autosave } from "./storage.js";
import { guideMark } from "./guide.js";

export function parseCoords(text) {
  const t = text.trim();
  let m = t.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) || t.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) || t.match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = +m[1], lng = +m[2];
  return Math.abs(lat) <= 85 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
function setPlace(p, note) {
  if (st.place) {
    const a = project(st.place.lat, st.place.lng), b = project(p.lat, p.lng);
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) * Math.pow(2, 18) > 1500) { st.arrows.sat = []; st.pois = {}; syncPois(); } // moved far: old arrows and points no longer apply
  }
  st.place = p; st.center = { ...p };
  guideMark("place");
  render();
  els.coords.value = p.lat.toFixed(7) + ", " + p.lng.toFixed(7);
  if (note) say(note, "ok");
  schedule();
}

async function geocode(q) {
  try {
    const r = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" + encodeURIComponent(q), { headers: { "Accept-Language": "fr,en" } });
    const j = await r.json();
    if (j && j[0]) return { lat: +j[0].lat, lng: +j[0].lon, label: j[0].display_name };
  } catch (_) {}
  try {
    const r = await fetch("https://photon.komoot.io/api/?limit=1&q=" + encodeURIComponent(q));
    const j = await r.json();
    const f = j && j.features && j.features[0];
    if (f) return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
  } catch (_) {}
  return null;
}
let lookupSeq = 0, lookupTimer = 0;
async function lookup(auto) {
  const addr = els.addr.value.trim().replace(/\s*\n\s*/g, ", "), name = els.name.value.trim();
  if (!addr && !name) { if (!auto) say("Saisissez d’abord une adresse.", "warn"); return; }
  shared.lastLookup = els.addr.value.trim() + "|" + name;
  const seq = ++lookupSeq;
  say("Recherche de l’adresse…");
  const hit = (addr && await geocode(addr)) || (name && await geocode(name + (addr ? ", " + addr : "")));
  if (seq !== lookupSeq) return; // a newer lookup started while this one ran
  if (hit) setPlace(hit, "Carte centrée sur l’adresse. Faites-la glisser pour ajuster, puis vérifiez le repère.");
  else say("Adresse introuvable pour l’instant. Essayez rue, code postal et ville, ou collez des coordonnées.", "warn");
}
function autoLookup() {
  clearTimeout(lookupTimer);
  lookupTimer = setTimeout(() => {
    if (els.addr.value.trim() + "|" + els.name.value.trim() !== shared.lastLookup) lookup(true);
  }, 1200);
}

// ---------- Venue suggestions: typing a name proposes places; picking one fills the address and the position ----------
// Source: Photon (OpenStreetMap data). Countries where the number follows the street name:
const NUMBER_AFTER = ["ch", "de", "at", "it", "es", "nl", "be", "lu", "pt", "pl", "cz", "dk", "se", "no", "fi"];
function formatAddress(a) {
  // a: { house, street, postcode, city, country, cc }
  const cc = (a.cc || "").toLowerCase();
  const line1 = a.street ? (a.house ? (NUMBER_AFTER.includes(cc) ? a.street + " " + a.house : a.house + " " + a.street) : a.street) : "";
  const line2 = [a.postcode, a.city].filter(Boolean).join(" ");
  return [line1, line2, cc && cc !== "fr" ? a.country : ""].filter(Boolean).join(", ");
}
let suggestAbort = null, suggestTimer = 0, suggestions = [], suggestIndex = -1, lastNominatim = 0;
let sugBox = null;
function closeSuggest() { sugBox.hidden = true; els.name.setAttribute("aria-expanded", "false"); suggestIndex = -1; }
function showSuggest() {
  sugBox.textContent = "";
  suggestions.forEach((sg, i) => {
    const li = document.createElement("li");
    li.id = "sug-" + i; li.setAttribute("role", "option"); li.setAttribute("aria-selected", String(i === suggestIndex));
    const n = document.createElement("span"); n.className = "sn"; n.textContent = sg.name;
    const a = document.createElement("span"); a.className = "sa"; a.textContent = sg.address || sg.kind || "";
    li.append(n, a);
    li.addEventListener("mousedown", (e) => { e.preventDefault(); pickSuggestion(i); });
    sugBox.appendChild(li);
  });
  const src = document.createElement("li"); src.className = "src"; src.setAttribute("role", "presentation"); src.textContent = "Données © contributeurs OpenStreetMap";
  sugBox.appendChild(src);
  sugBox.hidden = !suggestions.length;
  els.name.setAttribute("aria-expanded", String(!!suggestions.length));
  els.name.setAttribute("aria-activedescendant", suggestIndex >= 0 ? "sug-" + suggestIndex : "");
}
async function fetchSuggestions(q) {
  if (suggestAbort) suggestAbort.abort();
  suggestAbort = new AbortController();
  const signal = suggestAbort.signal;
  const c = st.center || st.place;
  const bias = c ? "&lat=" + c.lat.toFixed(4) + "&lon=" + c.lng.toFixed(4) : "&lat=46.2&lon=6.1";
  let list = [];
  // 1. Photon: fast, typo-tolerant, but rebuilt from OSM with a delay of several days
  try {
    const r = await fetch("https://photon.komoot.io/api/?limit=6&lang=fr" + bias + "&q=" + encodeURIComponent(q), { signal });
    const j = await r.json();
    list = (j.features || []).filter((f) => f.properties && f.properties.name).map((f) => {
      const p = f.properties;
      return {
        name: p.name,
        address: formatAddress({ house: p.housenumber, street: p.street, postcode: p.postcode, city: p.city || p.town || p.village || p.district, country: p.country, cc: p.countrycode }),
        lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0],
      };
    });
  } catch (e) { if (e && e.name === "AbortError") return; }
  // 2. Nominatim fallback: up to date within minutes, so recently added places show up.
  // Photon is typo-tolerant and almost always returns something ("Sixthemes" gives Sixt, Saint-Sixt…),
  // so the fallback runs whenever no Photon name contains what was typed, not only when the list is short.
  const norm = (t) => (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const nq = norm(q);
  const matches = (name) => norm(name).includes(nq);
  if (list.length < 3 || !list.some((s) => matches(s.name))) {
    try {
      // Nominatim allows one request per second: wait if the previous one was too recent
      const wait = lastNominatim + 1100 - Date.now();
      if (wait > 0) await new Promise((res) => setTimeout(res, wait));
      if (signal.aborted) return;
      lastNominatim = Date.now();
      const found = [];
      const r = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=fr,ch,it&q=" + encodeURIComponent(q), { signal, headers: { "Accept-Language": "fr" } });
      const j = await r.json();
      for (const h of j || []) {
        if (!h.name) continue;
        const lat = +h.lat, lng = +h.lon;
        if (list.some((s) => s.name === h.name && Math.abs(s.lat - lat) < 0.001 && Math.abs(s.lng - lng) < 0.001)) continue;
        const a = h.address || {};
        found.push({
          name: h.name,
          address: formatAddress({ house: a.house_number, street: a.road, postcode: a.postcode, city: a.city || a.town || a.village || a.municipality, country: a.country, cc: a.country_code }),
          lat, lng,
        });
      }
      // Places whose name matches what was typed come first, before Photon's approximate guesses
      list = found.filter((x) => matches(x.name)).concat(list.filter((x) => matches(x.name)), found.filter((x) => !matches(x.name)), list.filter((x) => !matches(x.name)));
    } catch (e) { if (e && e.name === "AbortError") return; }
  }
  if (signal.aborted) return;
  suggestions = list.slice(0, 6);
  suggestIndex = -1;
  if (document.activeElement === els.name && suggestions.length) showSuggest(); else closeSuggest();
}
function pickSuggestion(i) {
  const sg = suggestions[i];
  if (!sg) return;
  closeSuggest();
  els.name.value = sg.name;
  if (sg.address) els.addr.value = sg.address;
  $("exampleTag").hidden = true; shared.exampleShown = false;
  clearTimeout(lookupTimer);
  shared.lastLookup = els.addr.value.trim() + "|" + els.name.value.trim(); // already positioned: no extra lookup
  setPlace({ lat: sg.lat, lng: sg.lng }, sg.address ? "Adresse et position remplies. Vérifiez le repère sur le plan." : "Position remplie ; ce lieu n’a pas d’adresse complète, complétez-la si besoin.");
  render(); autosave();
}

// A full Google Maps link pasted in "Lien personnalisé": take the place name from it and look up the address
async function reverseAddress(p) {
  try {
    const r = await fetch("https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=" + p.lat + "&lon=" + p.lng, { headers: { "Accept-Language": "fr" } });
    const a = (await r.json()).address || {};
    return formatAddress({ house: a.house_number, street: a.road || a.pedestrian || a.footway, postcode: a.postcode, city: a.city || a.town || a.village || a.municipality, country: a.country, cc: a.country_code });
  } catch (_) { return ""; }
}

// Câblage de la page (écouteurs, état de départ) : appelé par main.js, dans l'ordre
export function init() {
  els.coords.addEventListener("change", () => {
    const p = parseCoords(els.coords.value);
    if (p) setPlace(p); else say("Coordonnées illisibles. Utilisez la forme 46.18793, 6.19892.", "warn");
  });
  els.custom.addEventListener("change", async () => {
    const link = els.custom.value.trim(), p = parseCoords(link);
    if (!p) return;
    setPlace(p, "Position reprise du lien Google Maps.");
    // Name from …/maps/place/<Nom+du+lieu>/…, address from the position
    const m = link.match(/\/maps\/place\/([^/@?]+)/);
    let filled = false;
    if (m) {
      const nm = decodeURIComponent(m[1].replace(/\+/g, " ")).trim();
      if (nm && !/^-?\d/.test(nm)) { els.name.value = nm; filled = true; }
    }
    const addr = await reverseAddress(p);
    if (addr) { els.addr.value = addr; filled = true; }
    if (filled) {
      $("exampleTag").hidden = true; shared.exampleShown = false;
      clearTimeout(lookupTimer);
      shared.lastLookup = els.addr.value.trim() + "|" + els.name.value.trim();
      render(); autosave();
      say("Nom, adresse et position repris du lien Google Maps. Vérifiez-les.", "ok");
    }
  });
  shared.lastLookup = (els.addr.value.trim() + "|" + els.name.value.trim());
  $("find").addEventListener("click", () => { clearTimeout(lookupTimer); lookup(false); });
  els.addr.addEventListener("input", autoLookup);
  sugBox = $("nameSuggest");
  els.name.addEventListener("input", () => {
    clearTimeout(suggestTimer);
    const q = els.name.value.trim();
    if (q.length < 3) { closeSuggest(); return; }
    suggestTimer = setTimeout(() => fetchSuggestions(q), 350);
  });
  els.name.addEventListener("keydown", (e) => {
    if (sugBox.hidden) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      suggestIndex = (suggestIndex + (e.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length;
      showSuggest();
    } else if (e.key === "Enter" && suggestIndex >= 0) { e.preventDefault(); pickSuggestion(suggestIndex); }
    else if (e.key === "Escape") closeSuggest();
  });
  els.name.addEventListener("blur", () => setTimeout(closeSuggest, 150));
  els.addr.addEventListener("blur", () => { if (els.addr.value.trim() + "|" + els.name.value.trim() !== shared.lastLookup) { clearTimeout(lookupTimer); lookup(true); } });
}
