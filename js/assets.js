// Easy Route ! — logo, capture d'écran de fond et police de l'étiquette (mémorisés sur l'appareil).
import { $, say, segment, st } from "./core.js";
import { render } from "./links.js";
import { schedule } from "./sheet.js";

// Logo
// The last logo used is remembered on this device (IndexedDB), with its settings (localStorage).
function saveLogoPrefs() { try { localStorage.setItem("easyroute.logo", JSON.stringify({ logoMm: st.logoMm, logoCard: st.logoCard, logoOnLabel: st.logoOnLabel })); } catch (_) {} }
function syncLogo() {
  document.querySelectorAll(".logoPick").forEach((el) => { el.textContent = st.logo ? "Changer de logo…" : "Ajouter un logo…"; });
  $("logoClear").disabled = !st.logo;
  $("logoSize").querySelectorAll("button").forEach((b) => { b.disabled = !st.logo; b.setAttribute("aria-pressed", String(+b.dataset.v === st.logoMm)); });
  $("logoCard").disabled = !st.logo; $("logoCard").checked = st.logoCard;
  $("logoOnLabel").disabled = !st.logo; $("logoOnLabel").checked = st.logoOnLabel;
  $("logoLabelHint").textContent = st.logo ? "" : "Ajoutez d’abord un logo.";
}
// Crop transparent or white margins around a raster logo, so its size on the label/plan is the logo itself
function trimLogo(img) {
  const w = img.naturalWidth, h = img.naturalHeight;
  if (!w || !h || w * h > 16e6) return null;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  let d; try { d = x.getImageData(0, 0, w, h).data; } catch (_) { return null; }
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const i = (yy * w + xx) * 4;
    if (d[i + 3] < 12 || (d[i] > 244 && d[i + 1] > 244 && d[i + 2] > 244)) continue;
    if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
  }
  if (x1 < 0) return null;
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.02);
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  if (cw * ch > 0.95 * w * h) return null; // nothing worth trimming
  const out = document.createElement("canvas"); out.width = cw; out.height = ch;
  out.getContext("2d").drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch);
  return out;
}
export function useLogo(blob, quiet) {
  return new Promise((res) => {
    const img = new Image(), reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const trimmed = blob.type === "image/svg+xml" ? null : trimLogo(img);
        st.logo = trimmed || img; st.logoData = trimmed ? trimmed.toDataURL("image/png") : reader.result;
        syncLogo(); render(); res(true); if (!quiet) say("Logo ajouté en haut à droite du plan.", "ok");
      };
      img.onerror = () => { res(false); if (!quiet) say("Impossible d’ouvrir ce logo. Essayez un PNG ou un JPG.", "warn"); };
      img.src = reader.result;
    };
    reader.onerror = () => res(false);
    reader.readAsDataURL(blob);
  });
}

// Screenshot background
function useShot(file) {
  if (!file || !/^image\//.test(file.type)) return;
  const img = new Image();
  img.onload = () => { st.shot = img; if (st.bg !== "shot") $("bgSeg").querySelector('[data-v="shot"]').click(); schedule(); say("Capture chargée.", "ok"); };
  img.onerror = () => say("Impossible d’ouvrir cette image.", "warn");
  img.src = URL.createObjectURL(file);
}

// Font
// Label font: Barlow by default; a custom font file can be loaded and is remembered on this device only.
let loadedFont = "", customFace = null;
export function fontState() {
  const el = $("fontState");
  el.textContent = loadedFont ? "Police utilisée : " + loadedFont + " (mémorisée sur cet appareil)." : "Police par défaut : Barlow.";
  el.style.color = loadedFont ? "var(--ok)" : "";
  $("fontReset").hidden = !loadedFont;
}
const FONT_DB = { name: "easyroute", store: "fonts", key: "label" }; // the same store also keeps the logo under the key "logo"
function fontDb() {
  return new Promise((res, rej) => {
    try {
      const req = indexedDB.open(FONT_DB.name, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(FONT_DB.store);
      req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
    } catch (err) { rej(err); }
  });
}
export async function fontDbDo(mode, fn) {
  const db = await fontDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(FONT_DB.store, mode), r = fn(tx.objectStore(FONT_DB.store));
    tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error);
  });
}
async function useFont(buf, name) {
  const face = new FontFace("CustomLabelFont", buf);
  await face.load();
  if (customFace) document.fonts.delete(customFace);
  document.fonts.add(face); customFace = face; loadedFont = name;
  fontState(); render();
}

// Câblage de la page (écouteurs, état de départ) : appelé par main.js, dans l'ordre
export function init() {
  st.logo = null; st.logoData = ""; st.logoMm = 20; st.logoCard = true; st.logoOnLabel = false;
  try { Object.assign(st, JSON.parse(localStorage.getItem("easyroute.logo") || "{}")); } catch (_) {}
  $("logoFile").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (await useLogo(file)) { try { await fontDbDo("readwrite", (s) => s.put({ name: file.name, blob: file }, "logo")); } catch (_) {} }
  });
  segment("logoSize", (v) => { st.logoMm = +v; saveLogoPrefs(); schedule(); });
  $("logoCard").addEventListener("change", (e) => { st.logoCard = e.target.checked; saveLogoPrefs(); schedule(); });
  $("logoOnLabel").addEventListener("change", (e) => { st.logoOnLabel = e.target.checked; saveLogoPrefs(); render(); });
  $("logoClear").addEventListener("click", async () => {
    st.logo = null; st.logoData = ""; syncLogo(); render(); say("Logo retiré.");
    try { await fontDbDo("readwrite", (s) => s.delete("logo")); } catch (_) {}
  });
  syncLogo();
  $("shotFile").addEventListener("change", (e) => useShot(e.target.files && e.target.files[0]));
  window.addEventListener("paste", (e) => {
    const items = e.clipboardData ? [...e.clipboardData.items] : [];
    const it = items.find((i) => i.kind === "file" && /^image\//.test(i.type));
    if (it) { e.preventDefault(); useShot(it.getAsFile()); }
  });
  const box = $("sheetBox");
  box.addEventListener("dragover", (e) => { e.preventDefault(); $("dropNote").hidden = false; });
  box.addEventListener("dragleave", () => { $("dropNote").hidden = true; });
  box.addEventListener("drop", (e) => { e.preventDefault(); $("dropNote").hidden = true; useShot(e.dataTransfer.files && e.dataTransfer.files[0]); });
  $("fontFile").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    e.target.value = "";
    try {
      const buf = await f.arrayBuffer();
      await useFont(buf.slice(0), f.name);
      say("Police chargée : " + f.name + ".", "ok");
      try { await fontDbDo("readwrite", (s) => s.put({ name: f.name, buf }, FONT_DB.key)); } catch (_) {}
    } catch (_) { say("Ce fichier n’est pas une police lisible. Essayez la version .ttf ou .otf.", "warn"); }
  });
  $("fontReset").addEventListener("click", async () => {
    if (customFace) document.fonts.delete(customFace);
    customFace = null; loadedFont = "";
    fontState(); render(); say("Retour à la police par défaut.");
    try { await fontDbDo("readwrite", (s) => s.delete(FONT_DB.key)); } catch (_) {}
  });
  (async () => {
    try {
      const saved = await fontDbDo("readonly", (s) => s.get(FONT_DB.key));
      if (saved && saved.buf) await useFont(saved.buf, saved.name);
    } catch (_) {}
  })();
}
