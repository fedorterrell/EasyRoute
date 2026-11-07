// Easy Route ! — session (reprise du travail en cours), lieux enregistrés, export et import des lieux.
import { $, confirmClick, els, POI_TYPES, say, shared, st } from "./core.js";
import { render } from "./links.js";
import { poiColor, schedule, setTool, syncPois } from "./sheet.js";
import { fontDbDo, useLogo } from "./assets.js";
import { updateMessage } from "./message.js";
import { deliver } from "./export.js";
import { cleanPlanning, syncPlanning } from "./planning.js";

// Everything describing the job (not the device settings) is captured in a snapshot.
export const JOB_FIELDS = ["name", "addr", "custom", "coords", "useName", "qrmm", "showUrl", "roads", "pin",
  "eventName", "callDate", "callTime", "callDur", "contactName", "contactPhone", "parking", "accessCode", "maxHeight", "note", "infoOnSheet"];
export function snapshot() {
  const fields = {};
  JOB_FIELDS.forEach((id) => { const el = $(id); fields[id] = el.type === "checkbox" ? el.checked : el.value; });
  return {
    v: 1, fields, app: shared.app, layout: shared.layout,
    place: st.place, center: st.center, zoom: st.zoom, pois: st.pois, arrows: st.arrows.sat,
    poiLabels: Object.fromEntries(POI_TYPES.map((t) => [t.key, $("poiLabel-" + t.key).value])),
    poiColors: { ...st.poiColors },
    share: st.share || null, // owned short link { id, key, ics, sig } of this job
    planning: st.planning.map((p) => ({ label: p.label, time: p.time })),
  };
}
export function applyState(d) {
  st.share = d.share && d.share.id && d.share.key ? { id: d.share.id, key: d.share.key, ics: !!d.share.ics, sig: typeof d.share.sig === "string" ? d.share.sig : "" } : null;
  const f = d.fields || {};
  JOB_FIELDS.forEach((id) => { if (!(id in f)) return; const el = $(id); if (el.type === "checkbox") el.checked = !!f[id]; else el.value = f[id]; });
  st.roads = $("roads").checked; st.pin = $("pin").checked;
  st.place = d.place || null; st.center = d.center || (d.place ? { ...d.place } : null); st.zoom = d.zoom || 18;
  if (st.place) els.coords.value = st.place.lat.toFixed(7) + ", " + st.place.lng.toFixed(7);
  st.pois = d.pois || {}; st.arrows.sat = d.arrows || []; st.placing = null;
  st.planning = cleanPlanning(d.planning); syncPlanning();
  POI_TYPES.forEach((t) => { $("poiLabel-" + t.key).value = (d.poiLabels && d.poiLabels[t.key]) || t.label; });
  if (d.poiColors) st.poiColors = { ...d.poiColors };
  POI_TYPES.forEach((t) => { $("poiColor-" + t.key).value = poiColor(t); });
  const clickSeg = (id, v) => { const b = v && $(id).querySelector(`[data-v="${v}"]`); if (b) b.click(); };
  clickSeg("appSeg", d.app); clickSeg("layout", d.layout);
  shared.lastLookup = els.addr.value.trim() + "|" + els.name.value.trim(); // don't re-geocode a restored place
  $("exampleTag").hidden = true; shared.exampleShown = false;
  setTool("pan"); syncPois(); render(); updateMessage(); schedule();
}
let saveTimer = 0;
export function saveNow() { clearTimeout(saveTimer); if (shared.sessionReady) try { localStorage.setItem("easyroute.session", JSON.stringify(snapshot())); } catch (_) {} }
export function autosave() {
  if (!shared.sessionReady) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 600);
}

// Saved venues: one IndexedDB record holding the list (the logo is kept with each venue)
let venues = [];
const venueTitle = () => els.name.value.trim() || els.addr.value.trim().split(/\n|,/)[0].trim();
function fillVenueSelect(selectId) {
  const sel = $("venueSel");
  sel.innerHTML = venues.length ? '<option value="">Choisir un lieu…</option>' : '<option value="">Aucun lieu enregistré</option>';
  [...venues].sort((a, b) => a.title.localeCompare(b.title, "fr")).forEach((v) => {
    const o = document.createElement("option"); o.value = v.id; o.textContent = v.title; sel.appendChild(o);
  });
  sel.value = selectId || "";
  syncVenueButtons();
}
export function syncVenueButtons() { $("venueDel").disabled = !$("venueSel").value; $("venueExport").disabled = !venues.length; }
async function storeVenues() { await fontDbDo("readwrite", (s) => s.put(venues, "venues")); }
function dataUrlToBlob(url) {
  const [head, b64] = url.split(","), type = (head.match(/data:([^;]+)/) || [])[1] || "image/png";
  const bin = atob(b64), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}

// Session enregistrée sur l'appareil (au démarrage, et si une fiche ne s'ouvre pas)
export function restoreSession() {
  try {
    const saved = JSON.parse(localStorage.getItem("easyroute.session") || "null");
    if (saved && saved.v === 1) { applyState(saved); say("Dernière session reprise. « Nouveau lieu » pour repartir de zéro."); }
  } catch (_) {}
}
export function loadVenues() {
  fontDbDo("readonly", (s) => s.get("venues")).then((list) => { venues = Array.isArray(list) ? list : []; fillVenueSelect(""); }).catch(() => {});
}

// Câblage de la page (écouteurs, état de départ) : appelé par main.js, dans l'ordre
export function init() {
  // Save right away when the page is hidden or closed (switching apps on iPhone, closing the tab)
  window.addEventListener("pagehide", saveNow);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveNow(); });
  document.addEventListener("input", autosave);
  document.addEventListener("change", autosave);
  confirmClick($("venueNew"), "Tout effacer ?", () => {
    applyState({ fields: { name: "", addr: "", custom: "", coords: "", eventName: "", callDate: "", callTime: "", contactName: "", contactPhone: "", parking: "", accessCode: "", maxHeight: "", note: "" } });
    st.arrows.shot = []; $("venueSel").value = ""; syncVenueButtons(); saveNow();
    els.name.focus();
    say("Nouveau lieu : saisissez le nom et l’adresse.");
  });
  $("venueSave").addEventListener("click", async () => {
    const title = venueTitle();
    if (!title) { say("Saisissez au moins un nom ou une adresse avant d’enregistrer.", "warn"); return; }
    const existing = venues.find((v) => v.title.toLowerCase() === title.toLowerCase());
    const data = snapshot(); delete data.share; // a saved venue is reused for other dates: it gets its own new link
    const rec = { id: existing ? existing.id : Date.now().toString(36), title, savedAt: Date.now(), data, logoData: st.logoData || "" };
    venues = existing ? venues.map((v) => (v.id === rec.id ? rec : v)) : venues.concat(rec);
    try { await storeVenues(); fillVenueSelect(rec.id); say((existing ? "Lieu mis à jour : " : "Lieu enregistré : ") + title + ".", "ok"); }
    catch (_) { say("Impossible d’enregistrer sur cet appareil (navigation privée ?).", "warn"); }
  });
  $("venueSel").addEventListener("change", async () => {
    syncVenueButtons();
    const v = venues.find((x) => x.id === $("venueSel").value);
    if (!v) return;
    applyState(v.data);
    if (v.logoData) {
      const blob = dataUrlToBlob(v.logoData);
      if (await useLogo(blob, true)) { try { await fontDbDo("readwrite", (s) => s.put({ name: v.title, blob }, "logo")); } catch (_) {} }
    }
    say("Lieu chargé : " + v.title + ".", "ok");
  });
  // Export / import: one JSON file with every saved venue (logos included), to move them between devices
  $("venueExport").addEventListener("click", () => {
    if (!venues.length) return;
    const file = { app: "easyroute", v: 1, exportedAt: new Date().toISOString(), venues };
    const blob = new Blob([JSON.stringify(file)], { type: "application/json" });
    const day = new Date().toISOString().slice(0, 10);
    deliver(blob, "easyroute-lieux-" + day + ".json");
  });
  $("venueImport").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    let list;
    try {
      const data = JSON.parse(await f.text());
      list = data && data.app === "easyroute" && Array.isArray(data.venues) ? data.venues : null;
    } catch (_) { list = null; }
    if (!list) { say("Ce fichier n’est pas un export de lieux Easy Route.", "warn"); return; }
    let added = 0, updated = 0, kept = 0;
    list.forEach((v) => {
      if (!v || typeof v.title !== "string" || !v.data) return;
      const same = venues.find((x) => x.title.toLowerCase() === v.title.toLowerCase());
      if (!same) { venues.push({ ...v, id: v.id && !venues.some((x) => x.id === v.id) ? v.id : Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }); added++; }
      else if ((v.savedAt || 0) > (same.savedAt || 0)) { venues = venues.map((x) => (x === same ? { ...v, id: same.id } : x)); updated++; }
      else kept++;
    });
    try { await storeVenues(); } catch (_) { say("Impossible d’enregistrer sur cet appareil (navigation privée ?).", "warn"); return; }
    fillVenueSelect("");
    const parts = [];
    if (added) parts.push(added + " ajouté" + (added > 1 ? "s" : ""));
    if (updated) parts.push(updated + " mis à jour");
    if (kept) parts.push(kept + " déjà à jour");
    say("Import terminé : " + (parts.join(", ") || "aucun lieu dans le fichier") + ".", added || updated ? "ok" : "");
  });
  confirmClick($("venueDel"), "Supprimer ?", async () => {
    const v = venues.find((x) => x.id === $("venueSel").value);
    if (!v) return;
    venues = venues.filter((x) => x.id !== v.id);
    try { await storeVenues(); } catch (_) {}
    fillVenueSelect(""); say("Lieu supprimé : " + v.title + ".");
  });
}
