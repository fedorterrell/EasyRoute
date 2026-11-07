// Easy Route ! — autres horaires de la journée (déchargement, balance, ouverture des portes, spectacle…),
// le même jour que le Get-In. Ils sont gardés dans st.planning : [{ label, time }], time au format "HH:MM".
// Ils s'affichent dans les infos pratiques (plan, message, fiche, description de l'agenda) : voir infoRows (sheet.js).
import { $, st } from "./core.js";
import { schedule } from "./sheet.js";
import { updateMessage } from "./message.js";
import { autosave } from "./storage.js";

export const PLANNING_MAX = 8;

// Liste reçue d'une session, d'un lieu enregistré ou d'une fiche : on ne garde que ce qui a la bonne forme
export function cleanPlanning(list) {
  return (Array.isArray(list) ? list : []).filter((p) => p && typeof p === "object").slice(0, PLANNING_MAX).map((p) => ({
    label: typeof p.label === "string" ? p.label.slice(0, 60) : "",
    time: typeof p.time === "string" && /^\d{2}:\d{2}$/.test(p.time) ? p.time : "",
  }));
}

function changed() { updateMessage(); schedule(); autosave(); }

// Une ligne par horaire : nom (avec suggestions), heure, Retirer
export function syncPlanning() {
  const box = $("planList");
  box.textContent = "";
  st.planning.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "planrow";
    const name = document.createElement("input");
    name.type = "text"; name.value = p.label; name.placeholder = "Balance"; name.setAttribute("list", "planNames");
    name.setAttribute("aria-label", "Nom de l’horaire " + (i + 1));
    const time = document.createElement("input");
    time.type = "time"; time.value = p.time;
    time.setAttribute("aria-label", "Heure de l’horaire " + (i + 1));
    const del = document.createElement("button");
    del.type = "button"; del.className = "btn sm"; del.textContent = "Retirer";
    del.setAttribute("aria-label", "Retirer l’horaire " + (i + 1));
    name.addEventListener("input", () => { p.label = name.value; changed(); });
    ["input", "change"].forEach((ev) => time.addEventListener(ev, () => { if (p.time !== time.value) { p.time = time.value; changed(); } }));
    del.addEventListener("click", () => { st.planning.splice(i, 1); syncPlanning(); changed(); });
    row.append(name, time, del);
    box.appendChild(row);
  });
  $("planAdd").disabled = st.planning.length >= PLANNING_MAX;
}

// Câblage de la page (écouteurs, état de départ) : appelé par main.js, dans l'ordre
export function init() {
  $("planAdd").addEventListener("click", () => {
    if (st.planning.length >= PLANNING_MAX) return;
    st.planning.push({ label: "", time: "" });
    syncPlanning();
    $("planList").lastElementChild.querySelector("input").focus();
    changed();
  });
  syncPlanning();
}
