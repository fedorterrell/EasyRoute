// Easy Route ! — point d'entrée (chargé par index.html, type="module") : onglets, câblage des modules et démarrage.
// Les modules ne lancent rien d'eux-mêmes : chacun a une fonction init(), appelée ici dans l'ordre de la page.
import { $, els, say, shared, SHORT_API, st } from "./core.js";
import { init as initLinks, render } from "./links.js";
import { init as initSheet, schedule, syncPois, syncTool } from "./sheet.js";
import { init as initPlaces, parseCoords } from "./places.js";
import { init as initAssets, fontDbDo, fontState, useLogo } from "./assets.js";
import { init as initMessage, calEvent, googleCalUrl, updateMessage } from "./message.js";
import { init as initExport } from "./export.js";
import { init as initPlanning } from "./planning.js";
import { init as initStorage, loadVenues, restoreSession } from "./storage.js";
import { init as initFiche, openFiche } from "./fiche.js";
import { init as initGuide, guideSave, guideSync } from "./guide.js";

// Tabs
function tab(which) {
  [["sheet", "tabSheet", "paneSheet"], ["label", "tabLabel", "paneLabel"], ["msg", "tabMsg", "paneMsg"]].forEach(([k, t, p]) => {
    $(t).setAttribute("aria-selected", String(k === which)); $(p).hidden = k !== which;
  });
  if (which === "sheet") schedule();
  if (which === "msg") updateMessage();
}

initSheet();
initPlaces();
initAssets();
$("tabSheet").addEventListener("click", () => tab("sheet"));
$("tabLabel").addEventListener("click", () => tab("label"));
$("tabMsg").addEventListener("click", () => tab("msg"));
initMessage();
initPlanning();
initExport();
initLinks();
initStorage();
initFiche();
initGuide(tab);

// ---------- Start ----------
const start = parseCoords(els.coords.value);
if (start) { st.place = start; st.center = { ...start }; }
const ficheMatch = location.hash.match(/^#(fiche|s|a)=(.+)$/); // a = short calendar link
const ficheHash = ficheMatch ? ficheMatch[2] : "";
if (ficheHash) {
  // Team view: never touch this device's saved session
  (async () => {
    let packed = ficheHash, offline = false, problem = "Ce lien de fiche est incomplet ou abîmé. Demandez un nouveau lien à l’expéditeur.";
    if (ficheMatch[1] === "a") say("Ouverture de Google Agenda…");
    if (ficheMatch[1] === "s" || ficheMatch[1] === "a") {
      packed = "";
      try {
        const r = await fetch(SHORT_API + "/f/" + encodeURIComponent(ficheHash));
        if (r.ok) { packed = (await r.json()).d || ""; offline = r.headers.get("X-Easyroute-Offline") === "1"; } // copie gardée par sw.js
        else if (r.status === 404) problem = "Cette fiche est introuvable ou a expiré. Demandez un nouveau lien à l’expéditeur.";
      } catch (_) { problem = "Impossible de charger la fiche pour l’instant (pas de réseau ?). Réessayez dans un moment."; }
    }
    if (packed && await openFiche(packed)) {
      if (offline && ficheMatch[1] !== "a") say("Hors ligne : voici la fiche telle qu’elle était à sa dernière ouverture sur cet appareil. Elle a peut-être changé depuis.", "warn");
      if (ficheMatch[1] !== "a") return;
      // Calendar link: go straight to Google Calendar with the event of the fiche (always its latest version)
      const ev = calEvent();
      if (ev) location.replace(googleCalUrl(ev));
      else say("Cette fiche n’a pas de date de Get-In : rien à ajouter à l’agenda.", "warn");
      return;
    }
    restoreSession(); shared.sessionReady = true; guideSync();
    say(problem, "warn");
  })();
} else {
  let firstVisit = true;
  try { firstVisit = !localStorage.getItem("easyroute.session"); } catch (_) {}
  restoreSession();
  shared.sessionReady = true;
  // New users get the guide; people who already used Easy Route can open it with « Premiers pas »
  if (!shared.guide) { shared.guide = { done: [], closed: !firstVisit }; guideSave(); }
  guideSync();
}
// A fiche link opened in a tab where Easy Route is already open: reload to show it
window.addEventListener("hashchange", () => { if (/^#(fiche|s|a)=/.test(location.hash)) location.reload(); });
loadVenues();
syncTool(); syncPois();
render(); fontState();
if (!ficheHash) fontDbDo("readonly", (s) => s.get("logo")).then((saved) => { if (saved && saved.blob) useLogo(saved.blob, true); }).catch(() => {});
if (document.fonts && document.fonts.load) {
  Promise.all([document.fonts.load('400 40px "Barlow"'), document.fonts.load('400 20px "JetBrains Mono"')]).then(() => { render(); fontState(); }, () => {});
}
// Hors ligne : sw.js garde le site, les fiches déjà ouvertes et les tuiles de carte sur l'appareil
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register("sw.js").catch(() => {});
