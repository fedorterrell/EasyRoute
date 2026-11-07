// Easy Route ! — premiers pas (quatre étapes qui se cochent seules) et exemple complet.
import { $, els, say, shared, st } from "./core.js";
import { project } from "./sheet.js";
import { applyState, saveNow, syncVenueButtons } from "./storage.js";

// Shown to new users: four steps that tick themselves off as the job is done, plus a full example.
const GUIDE_KEY = "easyroute.guide", GUIDE_STEPS = ["place", "pin", "pois", "send"];
let showTab = null; // showTab() de main.js, reçu par init (main.js n'est importé par aucun module)
export const guideSave = () => { try { localStorage.setItem(GUIDE_KEY, JSON.stringify(shared.guide)); } catch (_) {} };
export function guideSync() {
  const g = shared.guide || { done: [], closed: true };
  $("guide").hidden = !!g.closed;
  $("guideOpen").hidden = !g.closed;
  $("guide").querySelectorAll("[data-step]").forEach((b) => {
    const done = g.done.includes(b.dataset.step);
    b.classList.toggle("done", done);
    b.setAttribute("aria-label", b.querySelector("b").textContent + (done ? " (fait)" : ""));
  });
  const complete = GUIDE_STEPS.every((k) => g.done.includes(k));
  $("guide").classList.toggle("complete", complete);
  $("guideLead").textContent = complete ? "Bravo, votre première fiche est partie ! Vous pouvez fermer ce guide ; « Premiers pas » le rouvre."
    : "Quatre étapes pour envoyer un lieu à l’équipe. Elles se cochent au fur et à mesure.";
}
export function guideMark(step) {
  if (!shared.guide || shared.guide.done.includes(step) || shared.ficheMode) return;
  shared.guide.done.push(step); guideSave(); guideSync();
}
function guideShow(on) {
  if (!shared.guide) shared.guide = { done: [], closed: true };
  shared.guide.closed = !on; guideSave(); guideSync();
}
const GUIDE_GO = {
  place: () => { els.name.scrollIntoView({ block: "center" }); els.name.focus(); },
  pin: () => { showTab("sheet"); $("sheetBox").scrollIntoView({ block: "center" }); },
  pois: () => { showTab("sheet"); $("poiOpts").scrollIntoView({ block: "center" }); },
  send: () => { showTab("msg"); $("paneMsg").scrollIntoView({ block: "start" }); },
};

// Example job: a complete fiche on the sample venue, to see everything the tool does
function demoState() {
  const at = (lat, lng) => ({ lat, lng }), pt = (lat, lng) => project(lat, lng);
  const day = new Date(); day.setDate(day.getDate() + 7);
  const iso = day.getFullYear() + "-" + String(day.getMonth() + 1).padStart(2, "0") + "-" + String(day.getDate()).padStart(2, "0");
  return {
    v: 1, app: "google", layout: "side", zoom: 18,
    fields: {
      name: "Espace Culturel du Bois-Des-Arts", addr: "Chemin du Bois-Des-Arts 62, 1226 Thônex, Suisse", custom: "",
      useName: true, qrmm: "30", showUrl: false, roads: true, pin: true,
      eventName: "Exemple — Concert de fin d’année", callDate: iso, callTime: "09:00", callDur: "8",
      contactName: "Camille (régie)", contactPhone: "06 12 34 56 78", parking: "Parking du personnel, derrière la salle",
      accessCode: "Portail 1234A", maxHeight: "3,50 m", note: "Camion par l’arrière du bâtiment, déchargement au quai.", infoOnSheet: true,
    },
    place: at(46.1879295, 6.1989208), center: at(46.18795, 6.19885),
    pois: { dock: at(46.18768, 6.19935), staff: at(46.18815, 6.19862), catering: at(46.18832, 6.19962), parking: at(46.18842, 6.19808) },
    poiLabels: { dock: "Quai de déchargement" },
    arrows: [[pt(46.18842, 6.19818), pt(46.18832, 6.19834), pt(46.18822, 6.19850), pt(46.18817, 6.19858)]],
    share: null,
  };
}
let demoArmed = 0;

// Câblage de la page (écouteurs, état de départ) : appelé par main.js, dans l'ordre
export function init(tab) {
  showTab = tab;
  try { shared.guide = JSON.parse(localStorage.getItem(GUIDE_KEY) || "null"); } catch (_) {}
  $("guideClose").addEventListener("click", () => { guideShow(false); $("guideOpen").focus(); });
  $("guideOpen").addEventListener("click", () => { guideShow(true); $("guide").scrollIntoView({ block: "nearest" }); });
  ["msgCopy", "msgWa", "msgMail", "msgShare"].forEach((id) => $(id).addEventListener("click", () => guideMark("send")));
  $("zoomIn").addEventListener("click", () => guideMark("pin"));
  $("zoomOut").addEventListener("click", () => guideMark("pin"));
  // A step takes you to where it is done
  $("guide").querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => GUIDE_GO[b.dataset.step]()));
  $("guideDemo").addEventListener("click", () => {
    const btn = $("guideDemo");
    // Replacing real work needs a second tap (the untouched sample can go straight away)
    if (!shared.exampleShown && !demoArmed) {
      btn.textContent = "Remplacer mon travail en cours ?"; btn.classList.add("confirm");
      demoArmed = setTimeout(() => { demoArmed = 0; btn.textContent = "Voir un exemple"; btn.classList.remove("confirm"); }, 4000);
      return;
    }
    clearTimeout(demoArmed); demoArmed = 0; btn.textContent = "Voir un exemple"; btn.classList.remove("confirm");
    applyState(demoState());
    st.arrows.shot = []; $("venueSel").value = ""; syncVenueButtons(); saveNow();
    showTab("sheet"); $("sheetBox").scrollIntoView({ block: "center" });
    say("Exemple chargé : plan, points utiles, flèche et infos pratiques. Regardez aussi « Message équipe ». « Nouveau lieu » pour repartir de zéro.", "ok");
  });
}
