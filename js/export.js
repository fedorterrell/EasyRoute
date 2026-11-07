// Easy Route ! — téléchargements (étiquette, plan A4) et feuille de partage (iPhone / Android).
import { $, current, els, POI_TYPES, say, shared, st } from "./core.js";
import { drawSheet, infoRows, poiLabel, qrCardRect, SHEET } from "./sheet.js";
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

// PDF A4 paysage : le plan en une image JPEG pleine page, et un lien cliquable sur la carte QR
// (même adresse que le QR). Écrit à la main, sans bibliothèque : un PDF d'une page reste très simple.
const A4 = [841.89, 595.28]; // points (1/72 de pouce)
async function sheetPdf(jpeg) {
  const img = new Uint8Array(await jpeg.arrayBuffer());
  const ascii = (t) => new TextEncoder().encode(t);
  const pdfText = (t) => "(" + t.replace(/[^\x20-\x7e]/g, (ch) => encodeURIComponent(ch)).replace(/[\\()]/g, "\\$&") + ")";
  const utf16 = (t) => "<FEFF" + [...t].map((ch) => { // titre avec accents : UTF-16BE en hexadécimal
    const u = ch.codePointAt(0), hex = (n) => n.toString(16).toUpperCase().padStart(4, "0");
    if (u < 0x10000) return hex(u);
    const v = u - 0x10000; return hex(0xd800 + (v >> 10)) + hex(0xdc00 + (v & 0x3ff));
  }).join("") + ">";
  const k = A4[0] / SHEET.W, num = (v) => (Math.round(v * 100) / 100).toString();
  const q = qrCardRect(SHEET.W), link = /^https?:\/\//i.test(current.url) ? current.url : "";
  const content = `q ${A4[0]} 0 0 ${A4[1]} 0 0 cm /Im0 Do Q`;
  const what = $("eventName").value.trim() || els.name.value.trim();
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4[0]} ${A4[1]}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R${q && link ? " /Annots [7 0 R]" : ""} >>`,
    [`<< /Type /XObject /Subtype /Image /Width ${SHEET.W} /Height ${SHEET.H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`, img, "\nendstream"],
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    `<< /Title ${utf16(what ? what + " — plan d’accès" : "Plan d’accès")} /Creator (Easy Route !) >>`,
  ];
  if (q && link) {
    const [x, y, w, h] = q;
    objs.push(`<< /Type /Annot /Subtype /Link /Rect [${num(x * k)} ${num(A4[1] - (y + h) * k)} ${num((x + w) * k)} ${num(A4[1] - y * k)}] /Border [0 0 0] /A << /S /URI /URI ${pdfText(link)} >> >>`);
  }
  // En-tête, puis quatre octets non ASCII : les logiciels traitent ainsi le fichier comme binaire
  const parts = [ascii("%PDF-1.4\n%"), new Uint8Array([0xe2, 0xe3, 0xcf, 0xd3, 0x0a])];
  let size = parts[0].length + parts[1].length;
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(size);
    [`${i + 1} 0 obj\n`, ...(Array.isArray(o) ? o : [o]), "\nendobj\n"].forEach((p) => {
      const b = typeof p === "string" ? ascii(p) : p;
      parts.push(b); size += b.length;
    });
  });
  const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("")
    + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${size}\n%%EOF\n`;
  parts.push(ascii(xref));
  return new Blob(parts, { type: "application/pdf" });
}

export async function saveSheet(kind) {
  say("Création du plan A4 à 300 dpi…");
  const c = document.createElement("canvas");
  c.width = SHEET.W; c.height = SHEET.H;
  try {
    const failed = await drawSheet(c.getContext("2d"), SHEET.W, SHEET.H, true);
    const blob = await toBlob(c, kind === "png" ? "image/png" : "image/jpeg");
    await deliver(kind === "pdf" ? await sheetPdf(blob) : blob, "plan-" + current.base + "." + kind);
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
  $("sheetPdf").addEventListener("click", () => saveSheet("pdf"));
}
