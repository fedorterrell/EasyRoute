// Easy Route ! — lien Google Maps / Waze et étiquette QR.
import { $, current, els, MONO, SANS, say, segment, shared, st } from "./core.js";
import { imgSize, schedule, SHEET } from "./sheet.js";
import { updateMessage } from "./message.js";

function mapsUrl() {
  const custom = els.custom.value.trim();
  if (custom) return custom;
  if (shared.app === "waze") {
    if (st.place) return "https://waze.com/ul?ll=" + st.place.lat.toFixed(6) + "," + st.place.lng.toFixed(6) + "&navigate=yes";
    return "https://waze.com/ul?q=" + encodeURIComponent(els.addr.value.trim().replace(/\s*\n\s*/g, ", ")) + "&navigate=yes";
  }
  const addr = els.addr.value.trim().replace(/\s*\n\s*/g, ", ");
  const name = els.name.value.trim();
  const q = (els.useName.checked && name ? name + ", " : "") + addr;
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
}

export function wrap(ctx, text, maxW) {
  const out = [];
  text.split(/\n/).forEach((para) => {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    words.forEach((w) => {
      const t = line ? line + " " + w : w;
      if (ctx.measureText(t).width <= maxW || !line) line = t;
      else { out.push(line); line = w; }
    });
    if (line) out.push(line);
  });
  return out;
}
function breakUrl(ctx, url, maxW) {
  const out = []; let line = "";
  for (const ch of url) {
    if (ctx.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; }
    else line += ch;
  }
  if (line) out.push(line);
  return out;
}

function buildLabel(dpi, url, withLogo) {
  const mm = +els.qrmm.value;
  const px = (v) => Math.round(v / 25.4 * dpi);
  const qrPx = px(mm);
  const s = {
    qrPx, pad: px(Math.max(3, mm * 0.12)), gap: px(Math.max(3, mm * 0.15)),
    nameSize: Math.round(qrPx * 0.13), addrSize: Math.round(qrPx * 0.1), urlSize: Math.round(qrPx * 0.055),
    textW: shared.layout === "side" ? Math.round(qrPx * 1.7) : qrPx + px(10),
  };
  const qr = qrcode(0, "M"); qr.addData(url); qr.make();
  const n = qr.getModuleCount(), quiet = 4, cell = s.qrPx / (n + quiet * 2);
  const name = els.name.value.trim(), addr = els.addr.value.trim();

  const m = document.createElement("canvas").getContext("2d");
  const blocks = [];
  if (name) { m.font = `400 ${s.nameSize}px ${SANS}`; blocks.push({ font: m.font, size: s.nameSize, lines: wrap(m, name, s.textW), color: "#111" }); }
  if (addr) { m.font = `400 ${s.addrSize}px ${SANS}`; blocks.push({ font: m.font, size: s.addrSize, lines: wrap(m, addr, s.textW), color: "#333" }); }
  if (els.showUrl.checked) { m.font = `400 ${s.urlSize}px ${MONO}`; blocks.push({ font: m.font, size: s.urlSize, lines: breakUrl(m, url, s.textW), color: "#555", mono: true }); }

  const lh = 1.25, bgap = Math.round(s.addrSize * 0.5);
  let textH = 0, textW = 0;
  blocks.forEach((b, i) => {
    textH += b.lines.length * b.size * lh + (i ? bgap : 0);
    m.font = b.font;
    b.lines.forEach((l) => { textW = Math.max(textW, m.measureText(l).width); });
  });
  textW = Math.ceil(textW);
  // Optional logo: above the text (side by side) or above the QR (stacked)
  const logo = withLogo && st.logo ? st.logo : null;
  let lgW = 0, lgH = 0;
  const lgGap = Math.round(qrPx * 0.11);
  if (logo) {
    const [iw, ih] = imgSize(logo);
    lgH = Math.round(qrPx * (shared.layout === "side" ? 0.38 : 0.32)); lgW = Math.round(lgH * iw / ih);
    const maxW = shared.layout === "side" ? s.textW : Math.round(qrPx * 1.4);
    if (lgW > maxW) { lgH = Math.round(lgH * maxW / lgW); lgW = maxW; }
    if (shared.layout === "side") { textH += lgH + (blocks.length ? lgGap : 0); textW = Math.max(textW, lgW); }
  }
  const hasText = blocks.length || (logo && shared.layout === "side");

  let W, H, qx, qy, tx, ty;
  if (shared.layout === "side") {
    W = s.pad * 2 + s.qrPx + (hasText ? s.gap + textW : 0);
    H = s.pad * 2 + Math.max(s.qrPx, textH);
    qx = s.pad; qy = s.pad + (H - s.pad * 2 - s.qrPx) / 2;
    tx = s.pad + s.qrPx + s.gap; ty = s.pad + (H - s.pad * 2 - textH) / 2;
  } else {
    const top = logo ? lgH + lgGap : 0;
    W = s.pad * 2 + Math.max(s.qrPx, textW, lgW);
    H = s.pad * 2 + top + s.qrPx + (blocks.length ? s.gap * 0.6 + textH : 0);
    qx = (W - s.qrPx) / 2; qy = s.pad + top;
    tx = null; ty = qy + s.qrPx + s.gap * 0.6;
  }
  W = Math.ceil(W); H = Math.ceil(H);

  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#000";
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) {
    if (qr.isDark(r, col)) {
      const x0 = Math.round(qx + (col + quiet) * cell), y0 = Math.round(qy + (r + quiet) * cell);
      const x1 = Math.round(qx + (col + quiet + 1) * cell), y1 = Math.round(qy + (r + quiet + 1) * cell);
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
  ctx.textBaseline = "top";
  let y = ty, lgX = 0, lgY = 0;
  if (logo) {
    if (shared.layout === "side") { lgX = tx + (textW - lgW) / 2; lgY = ty; y = ty + lgH + (blocks.length ? lgGap : 0); } // centred over the text column
    else { lgX = (W - lgW) / 2; lgY = s.pad; }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(logo, lgX, lgY, lgW, lgH);
  }
  const svgText = [];
  blocks.forEach((b, i) => {
    if (i) y += bgap;
    ctx.font = b.font; ctx.fillStyle = b.color;
    b.lines.forEach((l) => {
      const w = ctx.measureText(l).width;
      const x = tx === null ? (W - w) / 2 : tx;
      const yy = y + (b.size * (lh - 1)) / 2;
      ctx.fillText(l, x, yy);
      svgText.push({ l, x: tx === null ? W / 2 : tx, y: yy + b.size * 0.8, b });
      y += b.size * lh;
    });
  });

  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  let path = "";
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) {
    if (qr.isDark(r, col)) path += `M${(qx + (col + quiet) * cell).toFixed(2)} ${(qy + (r + quiet) * cell).toFixed(2)}h${cell.toFixed(2)}v${cell.toFixed(2)}h-${cell.toFixed(2)}z`;
  }
  const anchor = tx === null ? ' text-anchor="middle"' : "";
  const texts = svgText.map((t) => `<text x="${t.x.toFixed(1)}" y="${t.y.toFixed(1)}" font-family="${t.b.mono ? "JetBrains Mono, Menlo, monospace" : "Barlow, Helvetica, Arial, sans-serif"}" font-size="${t.b.size}" fill="${t.b.color}"${anchor}>${esc(t.l)}</text>`).join("");
  const mmW = (W / dpi * 25.4).toFixed(1), mmH = (H / dpi * 25.4).toFixed(1);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${mmW}mm" height="${mmH}mm" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${logo && st.logoData ? `<image x="${lgX.toFixed(1)}" y="${lgY.toFixed(1)}" width="${lgW}" height="${lgH}" href="${st.logoData}" xlink:href="${st.logoData}"/>` : ""}<a href="${esc(url)}" xlink:href="${esc(url)}" target="_blank"><path d="${path}" fill="#000"/>${texts}</a></svg>`;
  return { canvas: c, svg, W, H, n, mmW, mmH, dpi };
}

export function render() {
  const url = mapsUrl();
  current.url = url;
  els.url.textContent = url;
  els.open.href = /^https?:\/\//i.test(url) ? url : "#";

  const dpi = +els.dpi.value;
  const onLabel = !!(st.logoOnLabel && st.logo);
  current.label = buildLabel(dpi, url, onLabel);
  current.sheetLabel = dpi === SHEET.dpi && !onLabel ? current.label : buildLabel(SHEET.dpi, url, false);
  const L = current.label;
  els.out.src = L.canvas.toDataURL("image/png");
  els.out.style.width = Math.round(L.W / (dpi / 96)) + "px";
  els.meta.innerHTML = `<span>Image <b>${L.W} × ${L.H} px</b></span><span>Impression <b>${L.mmW} × ${L.mmH} mm</b> à ${dpi} dpi</span><span>QR <b>${L.n} × ${L.n}</b> modules</span>`;

  const name = els.name.value.trim(), addr = els.addr.value.trim();
  updateMessage();
  current.base = (name || addr || "address").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "address";
  schedule();
}

// Câblage de la page (écouteurs, état de départ) : appelé par main.js, dans l'ordre
export function init() {
  $("copy").addEventListener("click", () => {
    const sel = () => { const r = document.createRange(); r.selectNodeContents(els.url); const s = getSelection(); s.removeAllRanges(); s.addRange(r); say("Lien sélectionné. Appuyez sur ⌘C pour copier."); };
    try { navigator.clipboard.writeText(current.url).then(() => say("Lien copié", "ok"), sel); } catch (_) { sel(); }
  });
  ["name", "addr", "custom"].forEach((id) => $(id).addEventListener("input", () => {
    if (shared.exampleShown && id !== "custom") { $("exampleTag").hidden = true; shared.exampleShown = false; }
    render();
  }));
  ["useName", "qrmm", "dpi", "showUrl"].forEach((id) => $(id).addEventListener("change", render));
  segment("appSeg", (v) => {
    shared.app = v;
    $("useNameRow").hidden = v === "waze";
    $("appHint").textContent = v === "waze" ? "Ouvre Waze et lance le guidage vers le repère de la carte. Sans l’app, le site Waze s’ouvre." : "Ouvre le lieu dans Google Maps, sur n’importe quel téléphone.";
    render();
  });
  $("form").addEventListener("submit", (e) => e.preventDefault());
}
