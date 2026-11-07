// Easy Route ! — plan A4 : carte, flèches, points utiles, carte d'infos, logo dessiné, aperçu et pointeur.
import { $, current, els, POI_TYPES, SANS, say, segment, shared, st } from "./core.js";
import { render, wrap } from "./links.js";
import { syncLinkGrid, updateMessage } from "./message.js";
import { autosave } from "./storage.js";
import { refreshFiche } from "./fiche.js";
import { guideMark } from "./guide.js";

export const SHEET = { dpi: 300, W: 3508, H: 2480 };
const mmPx = (mm) => mm / 25.4 * SHEET.dpi; // in sheet px
const VIEW_W = 1200;   // the sheet shows the same area as a 1200 px wide Maps window
const TS = 256;
const MAXZ = 19, MINZ = 13;
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/";
const LAYER = {
  img: (z, x, y) => `${ESRI}World_Imagery/MapServer/tile/${z}/${y}/${x}`,
  roads: (z, x, y) => `${ESRI}Reference/World_Transportation/MapServer/tile/${z}/${y}/${x}`,
  places: (z, x, y) => `${ESRI}Reference/World_Boundaries_and_Places/MapServer/tile/${z}/${y}/${x}`,
};

export const poiLabel = (t) => ($("poiLabel-" + t.key) ? $("poiLabel-" + t.key).value.trim() : "") || t.label;
export const placedPois = () => POI_TYPES.filter((t) => st.pois[t.key]);
// Point colours: chosen by the user (remembered on the device and in each saved venue), else the default
export const poiColor = (t) => (/^#[0-9a-f]{6}$/i.test(st.poiColors[t.key] || "") ? st.poiColors[t.key] : t.fill);
function darken(hex, k) {
  const n = parseInt(hex.slice(1), 16), f = (v) => Math.round(v * (1 - k)).toString(16).padStart(2, "0");
  return "#" + f(n >> 16) + f((n >> 8) & 255) + f(n & 255);
}

export function project(lat, lng) {
  const s = Math.sin(lat * Math.PI / 180);
  return [(lng + 180) / 360 * TS, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TS];
}
function unproject(x, y) {
  const n = Math.PI - 2 * Math.PI * y / TS;
  return { lat: 180 / Math.PI * Math.atan(Math.sinh(n)), lng: x / TS * 360 - 180 };
}
function view(W, H) {
  const k = W / VIEW_W * Math.pow(2, st.zoom);
  const c = project(st.center.lat, st.center.lng);
  return { W, H, k, cx: c[0], cy: c[1] };
}
// Arrow coordinates: satellite → world px at zoom 0; screenshot → 0..1 of the sheet.
function toOut(v, p) { return st.bg === "sat" ? [(p[0] - v.cx) * v.k + v.W / 2, (p[1] - v.cy) * v.k + v.H / 2] : [p[0] * v.W, p[1] * v.H]; }
function fromOut(v, x, y) { return st.bg === "sat" ? [(x - v.W / 2) / v.k + v.cx, (y - v.H / 2) / v.k + v.cy] : [x / v.W, y / v.H]; }

const tiles = new Map();
function tile(url) {
  let t = tiles.get(url);
  if (!t) {
    t = { img: new Image(), ok: false, err: false };
    t.img.crossOrigin = "anonymous";
    t.p = new Promise((res) => {
      t.img.onload = () => { t.ok = true; res(t); schedule(); };
      t.img.onerror = () => { t.err = true; res(t); schedule(); };
    });
    t.img.src = url;
    tiles.set(url, t);
  }
  return t;
}
function tileList(v, layerFn, z) {
  const out = [], n = Math.pow(2, z), f = v.k / n;   // sheet px per tile-world px
  const x0 = v.cx * n - v.W / 2 / f, y0 = v.cy * n - v.H / 2 / f;
  const tx0 = Math.floor(x0 / TS), tx1 = Math.floor((x0 + v.W / f) / TS);
  const ty0 = Math.max(0, Math.floor(y0 / TS)), ty1 = Math.min(n - 1, Math.floor((y0 + v.H / f) / TS));
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const wx = ((tx % n) + n) % n;
    const dx = (tx * TS - x0) * f, dy = (ty * TS - y0) * f;
    out.push({ t: tile(layerFn(z, wx, ty)), x: Math.round(dx), y: Math.round(dy), w: Math.round(dx + TS * f) - Math.round(dx), h: Math.round(dy + TS * f) - Math.round(dy) });
  }
  return out;
}
function mapLayers(v) {
  const iz = Math.max(0, Math.min(MAXZ, Math.round(Math.log2(v.k) + 0.2)));
  const layers = [tileList(v, LAYER.img, iz)];
  if (st.roads) { const lz = Math.min(MAXZ, st.zoom); layers.push(tileList(v, LAYER.roads, lz), tileList(v, LAYER.places, lz)); }
  return layers;
}

export const imgSize = (img) => [img.naturalWidth || img.width || 300, img.naturalHeight || img.height || 150];
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function haloText(ctx, text, x, y, size, align) {
  ctx.font = `400 ${size}px ${SANS}`; ctx.textAlign = align || "left"; ctx.textBaseline = "middle";
  ctx.lineJoin = "round"; ctx.lineWidth = size * 0.28; ctx.strokeStyle = "rgba(0,0,0,.72)";
  ctx.strokeText(text, x, y); ctx.fillStyle = "#fff"; ctx.fillText(text, x, y);
}
const PIN = {
  main: { fill: "#ea4335", stroke: "#a52714", dot: "#6e1409" },
};
function drawPin(ctx, x, y, s, col) {
  col = col || PIN.main;
  const h = mmPx(9) * s, r = h * 0.36, cy = y - h + r;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = r * 0.5; ctx.shadowOffsetY = r * 0.15;
  ctx.beginPath(); ctx.moveTo(x, y);
  ctx.bezierCurveTo(x - r * 0.35, y - r * 0.9, x - r, cy + r * 0.75, x - r, cy);
  ctx.arc(x, cy, r, Math.PI, 0);
  ctx.bezierCurveTo(x + r, cy + r * 0.75, x + r * 0.35, y - r * 0.9, x, y);
  ctx.fillStyle = col.fill; ctx.fill();
  ctx.restore();
  ctx.lineWidth = Math.max(1, r * 0.08); ctx.strokeStyle = col.stroke; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, cy, r * 0.38, 0, Math.PI * 2); ctx.fillStyle = col.dot; ctx.fill();
  return { top: y - h, r };
}
function pinLabel(ctx, pp, pin, text, s) {
  if (!text) return;
  const size = mmPx(4.2) * s;
  ctx.font = `400 ${size}px ${SANS}`;
  const lines = wrap(ctx, text, mmPx(55) * s).slice(0, 3);
  const x = pp[0] + pin.r * 1.35, y0 = pin.top + pin.r - (lines.length - 1) * size * 0.6;
  lines.forEach((l, i) => haloText(ctx, l, x, y0 + i * size * 1.2, size));
}

// ---------- Practical info ----------
export function callText() {
  const d = $("callDate").value, t = $("callTime").value;
  let out = "";
  if (d) {
    const [y, m, dd] = d.split("-").map(Number);
    if (y && m && dd) out = new Date(y, m - 1, dd).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  }
  if (t) {
    const ts = timeText(t);
    out = out ? out + " à " + ts : ts;
  }
  return out;
}
// "08:30" → "8h30"
function timeText(t) {
  const [h, mi] = t.split(":");
  return (+h) + "h" + (mi || "00");
}
// [label, value, emoji] in display order
export function infoRows() {
  const v = (id) => $(id).value.trim();
  const rows = [];
  const call = callText();
  if (call) rows.push(["Get-In", call, "\u{1F552}"]);
  st.planning.forEach((p) => { if (p.time) rows.push([p.label.trim() || "Horaire", timeText(p.time), "\u{1F552}"]); });
  const contact = [v("contactName"), v("contactPhone")].filter(Boolean).join(" — ");
  if (contact) rows.push(["Contact sur place", contact, "\u{1F464}"]);
  if (v("parking")) rows.push(["Parking", v("parking"), "\u{1F17F}\u{FE0F}"]);
  if (v("accessCode")) rows.push(["Code d’accès", v("accessCode"), "\u{1F511}"]);
  if (v("maxHeight")) rows.push(["Hauteur max", v("maxHeight"), "\u{26A0}\u{FE0F}"]);
  if (v("note")) rows.push(["Consignes d’accès", v("note").replace(/\s*\n\s*/g, " "), "\u{27A1}\u{FE0F}"]);
  return rows;
}
// White card with the practical info, bottom-aligned to `bottom`, starting at x.
function drawInfoCard(ctx, x, bottom, maxRight, s) {
  if (!$("infoOnSheet").checked) return;
  const rows = infoRows(), event = $("eventName").value.trim();
  if (!rows.length && !event) return;
  const pad = mmPx(3.6) * s, ls = mmPx(2.5) * s, vs = mmPx(3.6) * s, colGap = mmPx(3.5) * s, lh = 1.28, rowGap = mmPx(1.4) * s;
  const ts = mmPx(4.8) * s, titleFont = `600 ${ts}px ${SANS}`;
  const labelFont = `400 ${ls}px ${SANS}`, valueFont = `400 ${vs}px ${SANS}`;
  ctx.font = labelFont;
  const labels = rows.map((r) => r[0].toUpperCase());
  const labelW = rows.length ? Math.max(...labels.map((l) => ctx.measureText(l).width)) : 0;
  const maxValW = Math.max(mmPx(30) * s, Math.min(mmPx(88) * s, maxRight - x - pad * 2 - labelW - colGap));
  ctx.font = valueFont;
  const wrapped = rows.map((r) => wrap(ctx, r[1], maxValW).slice(0, 4));
  const valW = rows.length ? Math.max(...wrapped.flat().map((l) => ctx.measureText(l).width)) : 0;
  ctx.font = titleFont;
  const titleLines = event ? wrap(ctx, event, Math.max(labelW + colGap + maxValW, mmPx(60) * s)).slice(0, 2) : [];
  const titleW = titleLines.length ? Math.max(...titleLines.map((l) => ctx.measureText(l).width)) : 0;
  const titleH = titleLines.length * ts * 1.2 + (titleLines.length && rows.length ? mmPx(2.2) * s : 0);
  const h = pad * 2 + titleH + wrapped.reduce((a, ls2) => a + ls2.length * vs * lh, 0) + rowGap * Math.max(0, rows.length - 1);
  const w = pad * 2 + Math.max(rows.length ? labelW + colGap + valW : 0, titleW);
  const y = bottom - h, r = mmPx(3) * s;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = mmPx(2.5) * s; ctx.shadowOffsetY = mmPx(0.6) * s;
  roundRect(ctx, x, y, w, h, r); ctx.fillStyle = "#fff"; ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  let cy = y + pad;
  titleLines.forEach((l) => { ctx.font = titleFont; ctx.fillStyle = "#111"; ctx.fillText(l, x + pad, cy + ts * 0.6); cy += ts * 1.2; });
  if (titleLines.length && rows.length) cy += mmPx(2.2) * s;
  rows.forEach((row, i) => {
    const mid = cy + vs * lh / 2;
    ctx.font = labelFont; ctx.fillStyle = "#6b7480";
    ctx.fillText(labels[i], x + pad, mid);
    ctx.font = valueFont; ctx.fillStyle = "#111";
    wrapped[i].forEach((l, j) => ctx.fillText(l, x + pad + labelW + colGap, mid + j * vs * lh));
    cy += wrapped[i].length * vs * lh + rowGap;
  });
  ctx.restore();
}
function drawArrow(ctx, pts, s) {
  if (pts.length < 2) return;
  const w = mmPx(1.7) * s, head = w * 3.4;
  // direction at the tip, from a point about one head-length back
  const tip = pts[pts.length - 1];
  let back = pts[0];
  for (let i = pts.length - 2; i >= 0; i--) { if (Math.hypot(tip[0] - pts[i][0], tip[1] - pts[i][1]) >= head) { back = pts[i]; break; } }
  const ang = Math.atan2(tip[1] - back[1], tip[0] - back[0]);
  const base = [tip[0] - Math.cos(ang) * head * 0.8, tip[1] - Math.sin(ang) * head * 0.8];
  // trim the line so it ends under the head
  const line = pts.filter((p) => Math.hypot(tip[0] - p[0], tip[1] - p[1]) > head * 0.8);
  line.push(base);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = w * 0.8;
  ctx.strokeStyle = "#e5402a"; ctx.fillStyle = "#e5402a"; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(line[0][0], line[0][1]);
  for (let i = 1; i < line.length - 1; i++) {
    const mx = (line[i][0] + line[i + 1][0]) / 2, my = (line[i][1] + line[i + 1][1]) / 2;
    ctx.quadraticCurveTo(line[i][0], line[i][1], mx, my);
  }
  ctx.lineTo(base[0], base[1]); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tip[0], tip[1]);
  ctx.lineTo(tip[0] - Math.cos(ang - 0.45) * head, tip[1] - Math.sin(ang - 0.45) * head);
  ctx.lineTo(tip[0] - Math.cos(ang + 0.45) * head, tip[1] - Math.sin(ang + 0.45) * head);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function message(ctx, W, H, text) {
  ctx.fillStyle = "#3b463d"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#dfe6df"; ctx.font = `400 ${Math.round(W * 0.018)}px ${SANS}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  wrap(ctx, text, W * 0.6).forEach((l, i, a) => ctx.fillText(l, W / 2, H * 0.42 + (i - (a.length - 1) / 2) * W * 0.026));
}

// Draws the whole sheet at W×H. With wait=true it waits for every map tile (export).
export async function drawSheet(ctx, W, H, wait) {
  const s = W / SHEET.W;
  let failed = 0;
  ctx.save();
  if (st.bg === "sat") {
    if (!st.center) message(ctx, W, H, "Placez le lieu sur la carte : cliquez sur Chercher l’adresse, ou saisissez des coordonnées.");
    else {
      const v = view(W, H);
      const layers = mapLayers(v);
      if (wait) await Promise.all(layers.flat().map((i) => i.t.p));
      ctx.fillStyle = "#4a5547"; ctx.fillRect(0, 0, W, H);
      layers.forEach((list) => list.forEach((i) => { if (i.t.ok) ctx.drawImage(i.t.img, i.x, i.y, i.w, i.h); else if (i.t.err) failed++; }));
      st.arrows.sat.forEach((a) => drawArrow(ctx, a.map((p) => toOut(v, p)), s));
      if (st.live && st.bg === "sat") drawArrow(ctx, st.live.map((p) => toOut(v, p)), s);
      placedPois().forEach((t) => {
        const pt = st.pois[t.key], dp = toOut(v, project(pt.lat, pt.lng));
        pinLabel(ctx, dp, drawPin(ctx, dp[0], dp[1], s, { fill: poiColor(t), stroke: darken(poiColor(t), 0.32), dot: "#ffffff" }), poiLabel(t), s);
      });
      if (st.pin && st.place) {
        const pp = toOut(v, project(st.place.lat, st.place.lng));
        const pin = drawPin(ctx, pp[0], pp[1], s);
        pinLabel(ctx, pp, pin, els.name.value.trim() || els.addr.value.trim().split(/\n|,/)[0], s);
      }
      const as = mmPx(2.4) * s;
      haloText(ctx, "Imagerie © Esri, Maxar, Earthstar Geographics", W - mmPx(4) * s, H - mmPx(3) * s, as, "right");
    }
  } else {
    if (!st.shot) message(ctx, W, H, "Choisissez une capture, collez-la avec ⌘V, ou déposez une image ici.");
    else {
      const iw = st.shot.naturalWidth, ih = st.shot.naturalHeight, sc = Math.max(W / iw, H / ih);
      ctx.drawImage(st.shot, (W - iw * sc) / 2, (H - ih * sc) / 2, iw * sc, ih * sc);
    }
    const v = { W, H };
    st.arrows.shot.forEach((a) => drawArrow(ctx, a.map((p) => toOut(v, p)), s));
    if (st.live && st.bg === "shot") drawArrow(ctx, st.live.map((p) => toOut(v, p)), s);
  }
  // QR card, top-left, true print size
  const L = current.sheetLabel, q = qrCardRect(W);
  const m = mmPx(5) * s;
  drawInfoCard(ctx, m, H - m, W - m, s); // practical info: bottom-left
  if (L) {
    const [x, y, cw, ch] = q, r = mmPx(3) * s; // QR card: top-left
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = mmPx(2.5) * s; ctx.shadowOffsetY = mmPx(0.6) * s;
    roundRect(ctx, x, y, cw, ch, r); ctx.fillStyle = "#fff"; ctx.fill();
    ctx.restore();
    ctx.save(); roundRect(ctx, x, y, cw, ch, r); ctx.clip();
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(L.canvas, x, y, cw, ch);
    ctx.restore();
  }
  drawLogo(ctx, W, s);
  ctx.restore();
  return failed;
}
// QR card on a sheet W px wide: [x, y, width, height], or null without a label (also used for the PDF link)
export function qrCardRect(W) {
  const L = current.sheetLabel, s = W / SHEET.W, m = mmPx(5) * s;
  return L ? [m, m, L.W * s, L.H * s] : null;
}
// Logo, top-right: height in mm from the size setting, width capped so long logos stay reasonable
function drawLogo(ctx, W, s) {
  const img = st.logo;
  if (!img) return;
  const [iw, ih] = imgSize(img);
  let h = mmPx(st.logoMm) * s, w = h * iw / ih;
  const maxW = mmPx(90) * s;
  if (w > maxW) { h *= maxW / w; w = maxW; }
  const m = mmPx(5) * s, pad = st.logoCard ? mmPx(3) * s : 0;
  const x = W - m - w - pad * 2, y = m;
  if (st.logoCard) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = mmPx(2.5) * s; ctx.shadowOffsetY = mmPx(0.6) * s;
    roundRect(ctx, x, y, w + pad * 2, h + pad * 2, mmPx(3) * s); ctx.fillStyle = "#fff"; ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, x + pad, y + pad, w, h);
  ctx.restore();
}

// Preview canvas
let raf = 0;
export function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; drawPreview(); }); }
function drawPreview() {
  const c = els.sheet, rect = c.getBoundingClientRect();
  if (!rect.width) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.round(rect.width * dpr), H = Math.round(W * SHEET.H / SHEET.W);
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  drawSheet(c.getContext("2d"), W, H, false);
  $("zoomVal").textContent = st.zoom;
  $("undo").disabled = !st.arrows[st.bg].length;
  $("clear").disabled = !st.arrows[st.bg].length;
  autosave(); refreshFiche();
}

// Pointer: move map or draw arrows
let drag = null;
function canvasPt(e) {
  const r = els.sheet.getBoundingClientRect();
  return [(e.clientX - r.left) * els.sheet.width / r.width, (e.clientY - r.top) * els.sheet.height / r.height];
}
function curView() { return st.bg === "sat" ? view(els.sheet.width, els.sheet.height) : { W: els.sheet.width, H: els.sheet.height }; }
// Which pin (if any) is under canvas point p: the head of the red pin or of a useful point
function pinHit(p) {
  if (st.bg !== "sat" || !st.center) return null;
  const v = curView(), s = els.sheet.width / SHEET.W, h = mmPx(9) * s, r = h * 0.36;
  const near = (pt) => {
    const q = toOut(v, project(pt.lat, pt.lng));
    return Math.hypot(p[0] - q[0], p[1] - (q[1] - h + r)) <= Math.max(r * 1.7, 14) ? q : null;
  };
  let q;
  if (st.pin && st.place && (q = near(st.place))) return { mode: "main", off: [q[0] - p[0], q[1] - p[1]] };
  for (const t of [...placedPois()].reverse()) if ((q = near(st.pois[t.key]))) return { mode: "poi", key: t.key, off: [q[0] - p[0], q[1] - p[1]] };
  return null;
}
function pointAt(p, off) {
  const w = fromOut(curView(), p[0] + off[0], p[1] + off[1]);
  return unproject(w[0], w[1]);
}
function endDrag() {
  if (!drag) return;
  if (drag.mode === "arrow" && st.live && st.live.length >= 3) st.arrows[st.bg].push(st.live);
  if (drag.mode === "pan") guideMark("pin"); // the plan has been looked at
  if (drag.mode === "poi") {
    const t = POI_TYPES.find((x) => x.key === drag.key);
    guideMark("pin"); guideMark("pois");
    st.placing = null; setTool("pan"); syncPois();
    updateMessage();
    say("Point placé : " + t.name + ". Faites-le glisser pour l’ajuster.", "ok");
  }
  if (drag.mode === "main") {
    guideMark("pin");
    st.placing = null; setTool("pan"); syncPois();
    els.coords.value = st.place.lat.toFixed(7) + ", " + st.place.lng.toFixed(7);
    render(); // updates the Waze QR, the coordinates and the team message
    say("Repère du lieu déplacé. Les liens du message et le QR Waze pointent maintenant ici.", "ok");
  }
  st.live = null; drag = null;
  els.sheet.classList.remove("dragging");
  schedule();
}
function setZoom(z) { st.zoom = Math.max(MINZ, Math.min(MAXZ, z)); schedule(); }
export function setTool(v) {
  st.tool = v;
  $("toolSeg").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.v === v)));
  syncTool();
}
export function syncTool() { els.sheet.classList.toggle("drawing", st.tool === "arrow" || st.tool === "poi" || st.bg === "shot"); }
export function syncPois() {
  const custom = POI_TYPES.some((t) => poiColor(t).toLowerCase() !== t.fill.toLowerCase());
  if ($("poiColorsReset")) $("poiColorsReset").disabled = !custom;
  const mp = $("movePin");
  if (mp) { mp.textContent = st.placing === "main" ? "Touchez le plan…" : "Déplacer le repère"; mp.setAttribute("aria-pressed", String(st.placing === "main")); }
  POI_TYPES.forEach((t) => {
    const placing = st.placing === t.key, b = $("poiPlace-" + t.key);
    b.textContent = placing ? "Touchez le plan…" : st.pois[t.key] ? "Déplacer" : "Placer";
    b.setAttribute("aria-pressed", String(placing));
    $("poiClear-" + t.key).disabled = !st.pois[t.key];
  });
}

// Câblage de la page (écouteurs, état de départ) : appelé par main.js, dans l'ordre
export function init() {
  st.poiColors = {};
  try { st.poiColors = JSON.parse(localStorage.getItem("easyroute.poiColors") || "{}") || {}; } catch (_) {}
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(els.sheet); else window.addEventListener("resize", schedule);
  els.sheet.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || shared.ficheMode) return; // team view: the plan is not editable; a tap opens it in full screen
    const p = canvasPt(e), v = curView();
    const hit = st.tool === "pan" ? pinHit(p) : null;
    if (st.tool === "poi" && st.placing === "main") {
      if (st.bg !== "sat" || !st.center) return;
      st.place = pointAt(p, [0, 0]);
      drag = { mode: "main", off: [0, 0] };
      schedule();
    } else if (hit) {
      drag = hit;
      els.sheet.classList.add("dragging");
    } else if (st.tool === "poi" && st.placing) {
      if (st.bg !== "sat" || !st.center) return;
      const w = fromOut(v, p[0], p[1]);
      st.pois[st.placing] = unproject(w[0], w[1]);
      drag = { mode: "poi", key: st.placing };
      syncPois(); schedule();
    } else if (st.tool === "arrow") {
      if (st.bg === "sat" && !st.center) return;
      st.live = [fromOut(v, p[0], p[1])];
      drag = { mode: "arrow", last: p };
    } else {
      if (st.bg !== "sat" || !st.center) return;
      drag = { mode: "pan", start: p, c0: project(st.center.lat, st.center.lng), k: v.k };
      els.sheet.classList.add("dragging");
    }
    els.sheet.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  els.sheet.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = canvasPt(e);
    if (drag.mode === "pan") {
      st.center = unproject(drag.c0[0] - (p[0] - drag.start[0]) / drag.k, drag.c0[1] - (p[1] - drag.start[1]) / drag.k);
    } else if (drag.mode === "main") {
      st.place = pointAt(p, drag.off);
    } else if (drag.mode === "poi") {
      st.pois[drag.key] = pointAt(p, drag.off || [0, 0]);
    } else {
      const minStep = els.sheet.width * 0.006;
      if (Math.hypot(p[0] - drag.last[0], p[1] - drag.last[1]) < minStep) return;
      drag.last = p; st.live.push(fromOut(curView(), p[0], p[1]));
    }
    schedule();
  });
  els.sheet.addEventListener("pointerup", endDrag);
  els.sheet.addEventListener("pointermove", (e) => {
    if (drag || st.tool !== "pan") return;
    els.sheet.style.cursor = pinHit(canvasPt(e)) ? "move" : "";
  });
  els.sheet.addEventListener("pointercancel", endDrag);
  els.sheet.addEventListener("wheel", (e) => {
    if (st.bg !== "sat" || !st.center) return;
    e.preventDefault();
    if (Math.abs(e.deltaY) < 4) return;
    setZoom(st.zoom + (e.deltaY < 0 ? 1 : -1));
  }, { passive: false });

  $("zoomIn").addEventListener("click", () => setZoom(st.zoom + 1));
  $("zoomOut").addEventListener("click", () => setZoom(st.zoom - 1));
  $("undo").addEventListener("click", () => { st.arrows[st.bg].pop(); schedule(); });
  $("clear").addEventListener("click", () => { st.arrows[st.bg] = []; schedule(); });
  $("roads").addEventListener("change", (e) => { st.roads = e.target.checked; schedule(); });
  $("pin").addEventListener("change", (e) => { st.pin = e.target.checked; schedule(); });
  $("recenter").addEventListener("click", () => { if (st.place) { st.center = { ...st.place }; schedule(); } });
  $("movePin").addEventListener("click", () => {
    if (st.placing === "main") { st.placing = null; setTool("pan"); }
    else {
      if (!st.center) { say("Placez d’abord le lieu sur la carte.", "warn"); return; }
      st.placing = "main"; st.tool = "poi";
      $("toolSeg").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "false"));
      syncTool();
      say("Touchez le plan à l’endroit exact du lieu. Vous pouvez aussi faire glisser le repère rouge.");
    }
    syncPois();
  });

  segment("bgSeg", (v) => {
    st.bg = v; $("satOpts").hidden = v !== "sat"; $("poiOpts").hidden = v !== "sat"; $("shotOpts").hidden = v !== "shot"; $("zoomGroup").hidden = v !== "sat";
    if (v !== "sat" && st.tool === "poi") { st.placing = null; setTool("pan"); syncPois(); }
    syncTool(); schedule();
  });
  segment("toolSeg", (v) => { st.tool = v; st.placing = null; syncPois(); syncTool(); });
  // One row per kind of point: colour, editable label, Placer/Déplacer, Retirer
  POI_TYPES.forEach((t) => {
    const row = document.createElement("div");
    row.className = "poirow";
    row.innerHTML = `<input type="color" class="poicolor" id="poiColor-${t.key}" value="${poiColor(t)}" title="Changer la couleur" aria-label="Couleur du point ${t.name}">`
      + `<input type="text" id="poiLabel-${t.key}" aria-label="Libellé du point ${t.name}">`
      + `<button type="button" class="btn sm" id="poiPlace-${t.key}" aria-pressed="false"></button>`
      + `<button type="button" class="btn sm" id="poiClear-${t.key}">Retirer</button>`;
    $("poiList").appendChild(row);
    $("poiLabel-" + t.key).value = t.label;
    $("poiColor-" + t.key).addEventListener("input", (e) => {
      st.poiColors[t.key] = e.target.value;
      try { localStorage.setItem("easyroute.poiColors", JSON.stringify(st.poiColors)); } catch (_) {}
      syncPois(); syncLinkGrid(); schedule(); autosave();
    });
    $("poiLabel-" + t.key).addEventListener("input", () => { updateMessage(); schedule(); });
    $("poiPlace-" + t.key).addEventListener("click", () => {
      if (st.placing === t.key) { st.placing = null; setTool("pan"); }
      else {
        if (!st.center) { say("Placez d’abord le lieu sur la carte.", "warn"); return; }
        st.placing = t.key; st.tool = "poi";
        $("toolSeg").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "false"));
        syncTool();
        say("Touchez le plan à l’endroit : " + poiLabel(t) + ".");
      }
      syncPois();
    });
    $("poiClear-" + t.key).addEventListener("click", () => {
      delete st.pois[t.key];
      if (st.placing === t.key) { st.placing = null; setTool("pan"); }
      syncPois(); updateMessage(); schedule(); say("Point retiré : " + t.name + ".");
    });
  });
  $("poiColorsReset").addEventListener("click", () => {
    st.poiColors = {};
    try { localStorage.removeItem("easyroute.poiColors"); } catch (_) {}
    POI_TYPES.forEach((t) => { $("poiColor-" + t.key).value = t.fill; });
    syncPois(); syncLinkGrid(); schedule(); autosave();
    say("Couleurs par défaut rétablies.");
  });
  segment("layout", (v) => { shared.layout = v; render(); });
}
