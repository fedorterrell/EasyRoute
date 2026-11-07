// Easy Route ! — téléchargements (étiquette, plan A4) et feuille de partage (iPhone / Android).
import { $, current, els, POI_TYPES, say, shared, st } from "./core.js";
import { drawSheet, infoRows, poiLabel, SHEET } from "./sheet.js";
import { messageText } from "./message.js";

function browserDownload(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export function deliver(blob, filename) { browserDownload(blob, filename); say("Téléchargé : " + filename, "ok"); }
const toBlob = (c, type) => new Promise((res, rej) => { try { c.toBlob((b) => b ? res(b) : rej(new Error("empty")), type, 0.92); } catch (err) { rej(err); } });

async function saveLabel(kind) {
  const L = current.label;
  if (kind === "svg") return deliver(new Blob([L.svg], { type: "image/svg+xml" }), "qr-" + current.base + ".svg");
  try { deliver(await toBlob(L.canvas, kind === "jpg" ? "image/jpeg" : "image/png"), "qr-" + current.base + "." + kind); }
  catch (_) { say("Impossible de créer l’image.", "warn"); }
}

export async function saveSheet(kind) {
  say("Création du plan A4 à 300 dpi…");
  const c = document.createElement("canvas");
  c.width = SHEET.W; c.height = SHEET.H;
  try {
    const failed = await drawSheet(c.getContext("2d"), SHEET.W, SHEET.H, true);
    const blob = await toBlob(c, kind === "jpg" ? "image/jpeg" : "image/png");
    await deliver(blob, "plan-" + current.base + "." + kind);
    if (failed) say(`Enregistré, mais ${failed} tuile${failed > 1 ? "s" : ""} de carte n’${failed > 1 ? "ont" : "a"} pas chargé. Vérifiez l’image, et dézoomez d’un cran si des zones sont vides.`, "warn");
  } catch (_) {
    say("Le navigateur a bloqué l’export de l’image satellite. Réessayez dans un moment, ou utilisez Ma capture.", "warn");
  }
}

// ---------- Share (iPhone / Android share sheet) ----------
const canShareFiles = (() => {
  try { return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [new File([new Blob(["x"], { type: "image/jpeg" })], "t.jpg", { type: "image/jpeg" })] })); }
  catch (_) { return false; }
})();
const canShareText = !!navigator.share;
function shareSig() {
  return JSON.stringify([current.url, els.name.value, els.addr.value, els.qrmm.value, shared.layout, els.showUrl.checked, st.place, st.center, st.zoom, st.roads, st.pin, st.bg, st.arrows, !!st.shot && st.shot.src, st.logoData.length, st.logoMm, st.logoCard, st.pois, POI_TYPES.map(poiLabel), $("infoOnSheet").checked, infoRows(), $("eventName").value]);
}
let prepared = null; // { sig, file } — iOS only opens the share sheet right after a tap, so a slow render is done first
async function sheetFile() {
  const sig = shareSig();
  if (prepared && prepared.sig === sig) return { file: prepared.file, fresh: false };
  say("Préparation du plan A4…");
  const c = document.createElement("canvas");
  c.width = SHEET.W; c.height = SHEET.H;
  await drawSheet(c.getContext("2d"), SHEET.W, SHEET.H, true);
  const blob = await toBlob(c, "image/jpeg");
  prepared = { sig, file: new File([blob], "plan-" + current.base + ".jpg", { type: "image/jpeg" }) };
  return { file: prepared.file, fresh: true };
}
async function shareNow(withSheet, btn) {
  const text = messageText(), title = $("eventName").value.trim() || els.name.value.trim() || "Adresse";
  try {
    if (!withSheet) { await navigator.share({ title, text }); say("Partagé.", "ok"); return; }
    const { file, fresh } = await sheetFile();
    const data = { files: [file], title, text };
    const payload = navigator.canShare(data) ? data : { files: [file] };
    try { await navigator.share(payload); say("Partagé.", "ok"); }
    catch (e) {
      if (e && e.name === "AbortError") { say("Partage annulé."); return; }
      if (fresh && e && e.name === "NotAllowedError") { btn.classList.add("primary"); say("Plan prêt. Touchez à nouveau « " + btn.textContent + " » pour l’envoyer.", "ok"); return; }
      throw e;
    }
  } catch (e) {
    if (e && e.name === "AbortError") { say("Partage annulé."); return; }
    say("Le partage n’a pas fonctionné. Téléchargez le JPG et copiez le message à la place.", "warn");
  }
}

// Câblage de la page (écouteurs, état de départ) : appelé par main.js, dans l'ordre
export function init() {
  $("dlPng").addEventListener("click", () => saveLabel("png"));
  $("dlJpg").addEventListener("click", () => saveLabel("jpg"));
  $("dlSvg").addEventListener("click", () => saveLabel("svg"));
  $("sheetJpg").addEventListener("click", () => saveSheet("jpg"));
  if (canShareText) {
    document.querySelectorAll(".share").forEach((el) => {
      if ((el.id === "sheetShare" || el.htmlFor === "msgWithSheet") && !canShareFiles) return;
      el.hidden = false;
    });
    if (!$("msgShare").hidden) $("msgCopy").classList.remove("primary");
  }
  $("sheetShare").addEventListener("click", (e) => shareNow(true, e.currentTarget));
  $("msgShare").addEventListener("click", (e) => shareNow(canShareFiles && $("msgWithSheet").checked, e.currentTarget));
  $("sheetPng").addEventListener("click", () => saveSheet("png"));
}
