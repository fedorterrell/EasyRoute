// Easy Route ! — éléments communs à tous les modules : raccourcis vers la page, état partagé, constantes, petits outils.
// Ce module n'importe rien : il est toujours évalué en premier.

export const $ = (id) => document.getElementById(id);
export const els = { name: $("name"), addr: $("addr"), useName: $("useName"), custom: $("custom"), coords: $("coords"), qrmm: $("qrmm"), dpi: $("dpi"), showUrl: $("showUrl"), url: $("url"), open: $("open"), out: $("out"), meta: $("meta"), status: $("status"), sheet: $("sheet") };

export const SANS = '"CustomLabelFont", "Barlow", system-ui, sans-serif';
export const MONO = '"JetBrains Mono", ui-monospace, monospace';

// État partagé entre les modules (une liaison importée ne peut pas être réaffectée : on change ses propriétés)
export const shared = {
  layout: "side",      // disposition de l'étiquette : side / stack
  app: "google",       // application du QR : google / waze
  lastLookup: "",      // adresse|nom déjà géocodés (voir places.js)
  exampleShown: true,  // l'exemple de départ est encore affiché, intact
  sessionReady: false, // la session peut être enregistrée sur l'appareil
  ficheUrl: "",        // lien de la fiche mis dans le message ("" = lien court encore à créer)
  ficheMode: false,    // vue équipe (fiche ouverte depuis un lien)
  guide: null,         // premiers pas : { done: [...], closed }
};
export const current = { url: "", label: null, sheetLabel: null, base: "address" };

export function say(msg, cls) {
  [els.status, document.getElementById("fStatus")].forEach((el) => { if (el) { el.textContent = msg; el.className = "status " + (cls || ""); } });
}

// État du plan (carte, flèches, points utiles, logo…)
export const st = {
  place: null, center: null, zoom: 18, roads: true, pin: true, bg: "sat", tool: "pan",
  arrows: { sat: [], shot: [] }, shot: null, live: null,
  pois: {},      // key -> { lat, lng } for each useful point placed on the map
  placing: null, // key of the point being placed
  planning: [],  // other times of the day: [{ label, time }] (see planning.js)
};
// Useful points: add a line here to offer another kind of point.
export const POI_TYPES = [
  { key: "dock", name: "Accès technique", label: "Accès technique / déchargement", emoji: "\u{1F69A}", fill: "#1a73e8", stroke: "#0b4ea2" },
  { key: "staff", name: "Accès personnel", label: "Accès personnel", emoji: "\u{1F6AA}", fill: "#188038", stroke: "#0d5a26" },
  { key: "catering", name: "Catering", label: "Catering", emoji: "\u{1F37D}\u{FE0F}", fill: "#e8710a", stroke: "#a34f06" },
  { key: "parking", name: "Parking personnel", label: "Parking personnel", emoji: "\u{1F17F}\u{FE0F}", fill: "#8e24aa", stroke: "#5c1570" },
  { key: "loges", name: "Loges", label: "Loges", emoji: "\u{1F3AD}", fill: "#f4b400", stroke: "#a57900" },
];

export const SITE_URL = "https://easyroute.cloud/";
export const SHORT_API = "https://api.easyroute.cloud";

// Boutons à deux positions (aria-pressed) : rappelle cb avec la valeur data-v du bouton touché
export function segment(id, cb) {
  $(id).addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    $(id).querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    cb(b.dataset.v);
  });
}

// Two-step confirmation for destructive buttons (no browser dialogs)
export function confirmClick(btn, label, action) {
  const orig = btn.textContent;
  btn.addEventListener("click", () => {
    if (btn.dataset.armed) { clearTimeout(+btn.dataset.armed); delete btn.dataset.armed; btn.textContent = orig; btn.classList.remove("confirm"); action(); return; }
    btn.textContent = label; btn.classList.add("confirm");
    btn.dataset.armed = String(setTimeout(() => { delete btn.dataset.armed; btn.textContent = orig; btn.classList.remove("confirm"); }, 4000));
  });
}

export function el(tag, attrs, text) {
  const e = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
  if (text !== undefined) e.textContent = text;
  return e;
}
