// Easy Route ! — fiche partagée : lien long ou court, envoi en ligne au moment du partage, suppression, vue équipe, plan en grand.
import { $, confirmClick, el, els, POI_TYPES, say, shared, SHORT_API, SITE_URL, st } from "./core.js";
import { drawSheet, infoRows, placedPois, poiColor, poiLabel, schedule } from "./sheet.js";
import { calEvent, googleCalUrl, icsDownload, icsForUpload, LINK_COLS, linkSel, updateMessage } from "./message.js";
import { saveSheet } from "./export.js";
import { applyState, autosave, JOB_FIELDS, saveNow, snapshot } from "./storage.js";

// ---------- Shared fiche: the whole job packed into the link (…/#fiche=…), no server ----------
let ficheTimer = 0, ficheLinks = null;
const b64url = (bytes) => {
  let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64url = (str) => {
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const r7 = (v) => Math.round(v * 1e7) / 1e7;
const rPt = (p) => (p ? { lat: r7(p.lat), lng: r7(p.lng) } : null);
function ficheData() {
  const snap = snapshot(), f = {};
  ["name", "addr", "custom", "useName", "qrmm", "showUrl", "eventName", "callDate", "callTime", "callDur",
    "contactName", "contactPhone", "parking", "accessCode", "maxHeight", "note", "infoOnSheet"].forEach((k) => {
    const v = snap.fields[k]; if (v !== "" && v !== undefined) f[k] = v;
  });
  const labels = {}; POI_TYPES.forEach((t) => { const l = snap.poiLabels[t.key]; if (l && l !== t.label && st.pois[t.key]) labels[t.key] = l; });
  const colors = {}; POI_TYPES.forEach((t) => { if (st.pois[t.key] && poiColor(t) !== t.fill) colors[t.key] = poiColor(t); });
  const pois = {}; POI_TYPES.forEach((t) => { if (st.pois[t.key]) pois[t.key] = rPt(st.pois[t.key]); });
  // Route links chosen in the message grid, also used by the team view: key -> "g,w,a,gps"
  const links = {}; ["main", ...POI_TYPES.filter((t) => st.pois[t.key]).map((t) => t.key)].forEach((k) => {
    links[k] = LINK_COLS.filter((c) => linkSel[k][c[0]]).map((c) => c[0]).join(",");
  });
  return { v: 1, fields: f, app: shared.app, layout: shared.layout, place: rPt(st.place), center: rPt(st.center), zoom: st.zoom, pois,
    poiLabels: labels, poiColors: colors, links, arrows: st.arrows.sat.map((a) => a.map(([x, y]) => [r7(x), r7(y)])) };
}
async function packFiche(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (window.CompressionStream) {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
      return "1" + b64url(new Uint8Array(await new Response(stream).arrayBuffer()));
    } catch (_) {}
  }
  return "0" + b64url(bytes);
}
async function unpackFiche(str) {
  const bytes = unb64url(str.slice(1));
  if (str[0] === "1") {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return JSON.parse(await new Response(stream).text());
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export const siteBase = () => (/^https?:$/.test(location.protocol) ? location.origin + location.pathname : SITE_URL);
// Short links: the fiche is stored by our Cloudflare Worker, the link only carries its id (…/#s=k7Qp2xA9bC).
// The fiche goes online only when it is shared (Copier, WhatsApp, e-mail, Partager, Copier le lien),
// never while typing: no drafts on the server. If the Worker can't be reached, the long
// self-contained link (…/#fiche=…) is used instead.
const shortIds = new Map(); // fiche signature -> id (older Worker without keys: one link per version)
let failedSig = "", publishing = null;
export function canShorten() { return ["easyroute.cloud", "www.easyroute.cloud", "fedorterrell.github.io", "localhost"].includes(location.hostname); }
export function hasPlace() { return !!(st.place || els.addr.value.trim()); }
const ficheSig = () => JSON.stringify(ficheData());
// url: link put in the message ("" = short link still to be created); open: page shown by « Voir la fiche »
function setFicheUrl(url, state, open) {
  $("ficheOpen").href = open || url || "#";
  $("ficheCopy").disabled = !url && !open;
  $("ficheState").textContent = state || "";
  if (url !== shared.ficheUrl) { shared.ficheUrl = url; updateMessage(); }
}
const shortUrl = (id) => siteBase() + "#s=" + id;
const longUrl = (packed) => siteBase() + "#fiche=" + packed;
const SYNCED = "Fiche en ligne à jour. Si vous avez déjà envoyé ce lien, l’équipe voit cette version.";
const SYNCED_KEPT = "Ce lien court existait déjà (il a pu être envoyé) : il est à jour. « Nouveau lien » pour ne plus rien envoyer en ligne.";
const UNSYNCED = "Modifications pas encore en ligne : elles partiront au prochain envoi, ou avec « Mettre à jour la fiche en ligne ».";
const PENDING = "Rien n’est encore en ligne : le lien court sera créé au moment de l’envoi.";
const LOCAL_ONLY = "Rien n’est envoyé en ligne : le lien long ci-dessus contient toute la fiche.";
const OFFLINE = "Service des liens courts injoignable : le message garde le lien long, qui fonctionne aussi.";
// Unticking « Lien de la fiche » stops new fiches from being stored by the Worker
// (an existing short link is still updated when sharing: the team may already have it)
export function ficheOnline() { return $("lkFiche").checked; }
// Whether sharing now must first put the fiche online (create the link, or update it)
function needsPublish() {
  if (shared.ficheMode || !canShorten() || !hasPlace()) return false;
  const sig = ficheSig();
  if (st.share) return sig !== st.share.sig && sig !== failedSig;
  return ficheOnline() && !shortIds.has(sig) && sig !== failedSig;
}
// Create the job's link, or update it in place (same link). Resolves to true once the fiche online is up to date.
function publish() {
  if (!publishing) publishing = doPublish().finally(() => { publishing = null; });
  return publishing;
}
async function doPublish() {
  const sig = ficheSig(), packed = await packFiche(JSON.parse(sig));
  try {
    if (st.share) {
      const r = await fetch(SHORT_API + "/f/" + st.share.id, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ d: packed, key: st.share.key, ics: icsForUpload() }) });
      if (r.ok) {
        const res = await r.json().catch(() => ({}));
        st.share.ics = !!res.ics; st.share.sig = sig; failedSig = "";
        autosave(); refreshFiche(true);
        return true;
      }
      if (r.status !== 403 && r.status !== 404) throw new Error(r.status);
      st.share = null; // link no longer ours (expired, or older Worker): make a new one
      say("Nouveau lien créé : l’ancien ne pouvait plus être mis à jour.", "warn");
    }
    const r = await fetch(SHORT_API + "/f", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ d: packed, ics: icsForUpload() }) });
    if (!r.ok) throw new Error(r.status);
    const { id, key, ics } = await r.json();
    if (!/^[0-9A-Za-z]{6,16}$/.test(id || "")) throw new Error("id");
    if (key) st.share = { id, key, ics: !!ics, sig };
    else shortIds.set(sig, id); // older Worker: one link per version
    failedSig = "";
    autosave(); refreshFiche(true);
    return true;
  } catch (_) {
    failedSig = sig;
    refreshFiche(true);
    return false;
  }
}
function syncFicheButtons(unsynced) {
  $("ficheNew").hidden = $("ficheDel").hidden = !st.share;
  $("ficheSync").hidden = !unsynced;
}
// Link and state shown under the message (nothing is sent from here)
export function refreshFiche(now) {
  if (shared.ficheMode) return;
  clearTimeout(ficheTimer);
  ficheTimer = setTimeout(async () => {
    if (!hasPlace()) { syncFicheButtons(false); setFicheUrl("", ""); return; }
    const sig = ficheSig(), long = longUrl(await packFiche(JSON.parse(sig)));
    if (sig !== ficheSig()) return; // changed meanwhile: a newer refresh is on its way
    const unsynced = !!(canShorten() && st.share && sig !== st.share.sig);
    syncFicheButtons(unsynced);
    if (!canShorten()) return setFicheUrl(long, "");
    if (st.share) {
      if (!unsynced) return setFicheUrl(shortUrl(st.share.id), ficheOnline() ? SYNCED : SYNCED_KEPT);
      if (sig === failedSig) return setFicheUrl(long, "Pas de réseau : la fiche en ligne n’est pas à jour. Le message garde le lien long, qui contient la version actuelle.");
      return setFicheUrl(shortUrl(st.share.id), UNSYNCED, long);
    }
    const id = shortIds.get(sig);
    if (id) return setFicheUrl(shortUrl(id), "Lien court prêt.");
    if (!ficheOnline()) return setFicheUrl(long, LOCAL_ONLY);
    if (sig === failedSig) return setFicheUrl(long, OFFLINE);
    setFicheUrl("", PENDING, long);
  }, now ? 0 : 300);
}

// Read-only view for the team
function routeUrls(p, title, search) {
  const ll = p ? p.lat.toFixed(6) + "," + p.lng.toFixed(6) : "";
  return {
    google: "https://www.google.com/maps/search/?api=1&query=" + (p ? ll : encodeURIComponent(search)),
    waze: p ? "https://waze.com/ul?ll=" + ll + "&navigate=yes" : "https://waze.com/ul?q=" + encodeURIComponent(search) + "&navigate=yes",
    apple: p ? "https://maps.apple.com/?ll=" + ll + "&q=" + encodeURIComponent(title || "Lieu") : "https://maps.apple.com/?q=" + encodeURIComponent(search),
  };
}
function buildFicheView() {
  const name = els.name.value.trim(), addr = els.addr.value.trim().replace(/\s*\n\s*/g, ", "), event = $("eventName").value.trim();
  $("fTitle").textContent = event || name || addr || "Lieu";
  $("fPlace").textContent = event ? name : ""; $("fPlace").hidden = !event || !name;
  $("fAddr").textContent = addr;
  document.title = (event || name || "Fiche") + " · Easy Route !";
  // Infos (the phone number is a call link)
  const dl = $("fInfos"); dl.textContent = "";
  infoRows().forEach(([k, v]) => {
    dl.appendChild(el("dt", {}, k));
    const dd = el("dd");
    const phone = $("contactPhone").value.trim();
    if (k === "Contact sur place" && phone) {
      const nm = $("contactName").value.trim();
      if (nm) dd.append(nm + " — ");
      dd.appendChild(el("a", { href: "tel:" + phone.replace(/[^\d+]/g, "") }, phone));
    } else dd.textContent = v;
    dl.appendChild(dd);
  });
  const cal = calEvent(), calBox = $("fCal"); calBox.textContent = "";
  if (cal) {
    calBox.appendChild(el("a", { class: "btn", href: googleCalUrl(cal), target: "_blank", rel: "noopener" }, "Ajouter à Google Agenda"));
    const b = el("a", { class: "btn", href: "#" }, "Ajouter au calendrier (.ics)");
    b.addEventListener("click", (e) => { if (b.getAttribute("href") === "#") { e.preventDefault(); icsDownload(); } });
    calBox.appendChild(b);
    // Short fiche: link straight to the .ics served by the Worker (opens Calendar on iPhone and Mac)
    const m = location.hash.match(/^#s=([0-9A-Za-z]{6,16})$/);
    if (m) {
      const url = SHORT_API + "/ics/" + m[1];
      fetch(url, { cache: "no-store" }).then((r) => { if (r.ok) b.href = url; }).catch(() => {});
    }
  }
  $("fInfosPanel").hidden = !infoRows().length && !cal;
  // Routes: the place, then each useful point
  const box = $("fRoutes"); box.textContent = "";
  const dests = [{ key: "main", title: name || addr || "Lieu", p: st.place, color: "#ea4335", search: (name ? name + ", " : "") + addr }]
    .concat(placedPois().map((t) => ({ key: t.key, title: poiLabel(t), p: st.pois[t.key], color: poiColor(t), search: "" })));
  dests.forEach((d) => {
    // Same links as in the message (fiches made before this choice existed show them all)
    const chosen = ficheLinks && typeof ficheLinks[d.key] === "string" ? ficheLinks[d.key].split(",") : ["g", "w", "a", "gps"];
    const u = routeUrls(d.p, d.title, d.search);
    const links = [["g", "Google Maps", u.google], ["w", "Waze", u.waze], ["a", "Plans", u.apple]].filter(([k]) => chosen.includes(k));
    const gps = d.p && chosen.includes("gps");
    if (!links.length && !gps) return;
    const row = el("div", { class: "froute" }), head = el("div", { class: "name" });
    const dot = el("span", { class: "poidot" }); dot.style.background = d.color;
    head.append(dot, d.title); row.appendChild(head);
    if (links.length) {
      const btns = el("div", { class: "routebtns" });
      links.forEach(([, lbl, href]) => btns.appendChild(el("a", { class: "btn", href, target: "_blank", rel: "noopener" }, lbl)));
      row.appendChild(btns);
    }
    if (gps) row.appendChild(el("span", { class: "gps" }, "GPS : " + d.p.lat.toFixed(6) + ", " + d.p.lng.toFixed(6)));
    box.appendChild(row);
  });
  box.parentElement.hidden = !box.children.length;
}
function showFiche(on) {
  shared.ficheMode = on;
  document.querySelector(".wrap > header").hidden = on;
  document.querySelector(".wrap > .grid").hidden = on;
  $("ficheView").hidden = !on;
  const sheetBox = $("sheetBox");
  els.sheet.style.touchAction = on ? "manipulation" : "";
  els.sheet.style.cursor = on ? "zoom-in" : "";
  if (on) $("fSheetSlot").appendChild(sheetBox);
  else $("paneSheet").insertBefore(sheetBox, document.querySelector("#paneSheet .meta"));
  schedule();
}
export async function openFiche(packed) {
  try {
    const d = await unpackFiche(packed);
    if (!d || d.v !== 1) throw new Error("format");
    shared.ficheMode = true;
    // Fields left out of the link take their empty/default value (not this device's sample)
    const fields = {};
    JOB_FIELDS.forEach((k) => {
      const e = $(k);
      fields[k] = k in (d.fields || {}) ? d.fields[k]
        : e.type === "checkbox" ? e.defaultChecked
        : e.tagName === "SELECT" ? ([...e.options].find((o) => o.defaultSelected) || e.options[0]).value : "";
    });
    applyState({ ...d, fields });
    ficheLinks = d.links && typeof d.links === "object" ? d.links : null;
    buildFicheView();
    showFiche(true);
    return true;
  } catch (_) {
    shared.ficheMode = false;
    return false;
  }
}

// Big plan: full screen, high resolution, zoom buttons (pinch-zoom also works on phones)
const PZ_LEVELS = [1, 1.6, 2.5, 4];
let pzLevel = 0, pzRendered = false;
function pzFit() {
  const box = $("pzScroll"), c = $("pzCanvas");
  const fit = Math.min(box.clientWidth, box.clientHeight * c.width / c.height);
  const w = Math.round(fit * PZ_LEVELS[pzLevel]);
  // keep the visible centre in place while zooming
  const cx = (box.scrollLeft + box.clientWidth / 2) / (c.offsetWidth || 1), cy = (box.scrollTop + box.clientHeight / 2) / (c.offsetHeight || 1);
  c.style.width = w + "px"; c.style.height = Math.round(w * c.height / c.width) + "px";
  box.scrollLeft = cx * w - box.clientWidth / 2; box.scrollTop = cy * c.offsetHeight - box.clientHeight / 2;
  $("pzOut").disabled = pzLevel === 0; $("pzIn").disabled = pzLevel === PZ_LEVELS.length - 1;
}
async function openZoom() {
  $("planZoom").hidden = false; document.body.style.overflow = "hidden";
  pzLevel = 0;
  if (!pzRendered) {
    $("pzWait").hidden = false; $("pzCanvas").hidden = true;
    const c = $("pzCanvas");
    await drawSheet(c.getContext("2d"), c.width, c.height, true);
    pzRendered = true;
    $("pzWait").hidden = true; c.hidden = false;
  }
  pzFit();
  $("pzClose").focus();
}
function closeZoom() { $("planZoom").hidden = true; document.body.style.overflow = ""; $("fZoom").focus(); }

// Câblage de la page (écouteurs, état de départ) : appelé par main.js, dans l'ordre
export function init() {
  st.share = null; // { id, key, ics, sig }: the link of this job, kept with the session; sig = version online
  // Share moments: when the fiche must go online first, this tap sends it and the next one shares
  // (iOS only copies or opens the share sheet right after a tap, not after waiting for the server)
  ["msgCopy", "msgWa", "msgMail", "msgShare", "sheetShare", "ficheCopy"].forEach((id) => $(id).addEventListener("click", async (e) => {
    if (!needsPublish()) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const label = $(id).textContent.trim();
    say("Envoi de la fiche en ligne…");
    const ok = await publish();
    say((ok ? "Fiche en ligne à jour." : OFFLINE) + " Touchez à nouveau « " + label + " » pour envoyer.", ok ? "ok" : "warn");
  }, true));
  $("ficheSync").addEventListener("click", async () => {
    say("Envoi de la fiche en ligne…");
    say(await publish() ? "Fiche en ligne à jour : l’équipe voit cette version." : OFFLINE, "ok");
  });
  // Delete the fiche stored by the Worker (its key proves it is ours): the short link stops working.
  // « Lien de la fiche » is then unticked, so nothing is sent again.
  confirmClick($("ficheDel"), "Supprimer pour de bon ?", async () => {
    const share = st.share, btn = $("ficheDel");
    if (!share) return;
    btn.disabled = true; say("Suppression de la fiche en ligne…");
    try {
      const r = await fetch(SHORT_API + "/f/" + share.id, { method: "DELETE", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ key: share.key }) });
      const res = await r.json().catch(() => ({}));
      // 404 + gone: already deleted or expired (an older Worker answers 404 without « gone »)
      if (!(r.ok && res.deleted) && !(r.status === 404 && res.gone)) throw new Error(r.status);
    } catch (_) {
      btn.disabled = false;
      say("Suppression impossible pour l’instant (pas de réseau, ou service pas encore à jour). Réessayez dans un moment.", "warn");
      return;
    }
    btn.disabled = false;
    if (st.share && st.share.id === share.id) st.share = null;
    failedSig = "";
    $("lkFiche").checked = false;
    try { localStorage.setItem("easyroute.ficheLink", "0"); } catch (_) {}
    autosave(); updateMessage(); refreshFiche(true);
    say("Fiche en ligne supprimée : son lien ne fonctionne plus. « Lien de la fiche » est décoché, rien n’est renvoyé en ligne.", "ok");
  });
  confirmClick($("ficheNew"), "Créer un nouveau lien ?", () => {
    st.share = null; failedSig = ""; autosave();
    say(ficheOnline() ? "Un nouveau lien sera créé au prochain envoi. L’ancien garde la version déjà envoyée."
      : "L’ancien lien garde la version déjà envoyée. La fiche n’est plus envoyée en ligne.", "ok");
    refreshFiche(true);
  });
  $("lkFiche").addEventListener("change", (e) => { try { localStorage.setItem("easyroute.ficheLink", e.target.checked ? "1" : "0"); } catch (_) {} updateMessage(); refreshFiche(true); });
  try { $("lkFiche").checked = localStorage.getItem("easyroute.ficheLink") !== "0"; } catch (_) {}
  $("ficheCopy").addEventListener("click", () => {
    if (!shared.ficheUrl) return;
    try { navigator.clipboard.writeText(shared.ficheUrl).then(() => say("Lien de la fiche copié.", "ok"), () => say("Copie impossible ici : utilisez « Voir la fiche » puis copiez l’adresse.", "warn")); }
    catch (_) { say("Copie impossible ici : utilisez « Voir la fiche » puis copiez l’adresse.", "warn"); }
  });
  $("fJpg").addEventListener("click", () => saveSheet("jpg"));
  $("fZoom").addEventListener("click", openZoom);
  els.sheet.addEventListener("click", () => { if (shared.ficheMode) openZoom(); });
  $("pzClose").addEventListener("click", closeZoom);
  $("pzIn").addEventListener("click", () => { pzLevel = Math.min(PZ_LEVELS.length - 1, pzLevel + 1); pzFit(); });
  $("pzOut").addEventListener("click", () => { pzLevel = Math.max(0, pzLevel - 1); pzFit(); });
  $("pzCanvas").addEventListener("dblclick", () => { pzLevel = (pzLevel + 1) % PZ_LEVELS.length; pzFit(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("planZoom").hidden) closeZoom(); });
  window.addEventListener("resize", () => { if (!$("planZoom").hidden && pzRendered) pzFit(); });
  confirmClick($("fEdit"), "Remplacer mon travail en cours ?", () => {
    showFiche(false);
    history.replaceState(null, "", location.pathname + location.search);
    document.title = "Easy Route !";
    shared.sessionReady = true; saveNow();
    updateMessage();
    say("Fiche ouverte dans l’éditeur. Elle remplace votre travail en cours.", "ok");
  });
}
