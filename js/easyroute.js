// Easy Route ! — tout le fonctionnement de la page (index.html).
// Chargé en fin de page : le HTML est déjà là quand ce code s'exécute.
(function () {
  const $ = (id) => document.getElementById(id);
  const els = { name: $("name"), addr: $("addr"), useName: $("useName"), custom: $("custom"), coords: $("coords"), qrmm: $("qrmm"), dpi: $("dpi"), showUrl: $("showUrl"), url: $("url"), open: $("open"), out: $("out"), meta: $("meta"), status: $("status"), sheet: $("sheet") };

  const SANS = '"CustomLabelFont", "Barlow", system-ui, sans-serif';
  const MONO = '"JetBrains Mono", ui-monospace, monospace';

  let layout = "side";
  let app = "google";
  const current = { url: "", label: null, sheetLabel: null, base: "address" };

  function say(msg, cls) {
    [els.status, document.getElementById("fStatus")].forEach((el) => { if (el) { el.textContent = msg; el.className = "status " + (cls || ""); } });
  }

  // ---------- Link + label ----------
  function mapsUrl() {
    const custom = els.custom.value.trim();
    if (custom) return custom;
    if (app === "waze") {
      if (st.place) return "https://waze.com/ul?ll=" + st.place.lat.toFixed(6) + "," + st.place.lng.toFixed(6) + "&navigate=yes";
      return "https://waze.com/ul?q=" + encodeURIComponent(els.addr.value.trim().replace(/\s*\n\s*/g, ", ")) + "&navigate=yes";
    }
    const addr = els.addr.value.trim().replace(/\s*\n\s*/g, ", ");
    const name = els.name.value.trim();
    const q = (els.useName.checked && name ? name + ", " : "") + addr;
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
  }

  function wrap(ctx, text, maxW) {
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
      textW: layout === "side" ? Math.round(qrPx * 1.7) : qrPx + px(10),
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
      lgH = Math.round(qrPx * (layout === "side" ? 0.38 : 0.32)); lgW = Math.round(lgH * iw / ih);
      const maxW = layout === "side" ? s.textW : Math.round(qrPx * 1.4);
      if (lgW > maxW) { lgH = Math.round(lgH * maxW / lgW); lgW = maxW; }
      if (layout === "side") { textH += lgH + (blocks.length ? lgGap : 0); textW = Math.max(textW, lgW); }
    }
    const hasText = blocks.length || (logo && layout === "side");

    let W, H, qx, qy, tx, ty;
    if (layout === "side") {
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
      if (layout === "side") { lgX = tx + (textW - lgW) / 2; lgY = ty; y = ty + lgH + (blocks.length ? lgGap : 0); } // centred over the text column
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

  function render() {
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

  // ---------- Map sheet ----------
  const SHEET = { dpi: 300, W: 3508, H: 2480 };
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

  const st = {
    place: null, center: null, zoom: 18, roads: true, pin: true, bg: "sat", tool: "pan",
    arrows: { sat: [], shot: [] }, shot: null, live: null,
    pois: {},      // key -> { lat, lng } for each useful point placed on the map
    placing: null, // key of the point being placed
  };
  // Useful points: add a line here to offer another kind of point.
  const POI_TYPES = [
    { key: "dock", name: "Accès technique", label: "Accès technique / déchargement", emoji: "\u{1F69A}", fill: "#1a73e8", stroke: "#0b4ea2" },
    { key: "staff", name: "Accès personnel", label: "Accès personnel", emoji: "\u{1F6AA}", fill: "#188038", stroke: "#0d5a26" },
    { key: "catering", name: "Catering", label: "Catering", emoji: "\u{1F37D}\u{FE0F}", fill: "#e8710a", stroke: "#a34f06" },
    { key: "parking", name: "Parking personnel", label: "Parking personnel", emoji: "\u{1F17F}\u{FE0F}", fill: "#8e24aa", stroke: "#5c1570" },
    { key: "loges", name: "Loges", label: "Loges", emoji: "\u{1F3AD}", fill: "#f4b400", stroke: "#a57900" },
  ];
  const poiLabel = (t) => ($("poiLabel-" + t.key) ? $("poiLabel-" + t.key).value.trim() : "") || t.label;
  const placedPois = () => POI_TYPES.filter((t) => st.pois[t.key]);
  // Point colours: chosen by the user (remembered on the device and in each saved venue), else the default
  st.poiColors = {};
  try { st.poiColors = JSON.parse(localStorage.getItem("easyroute.poiColors") || "{}") || {}; } catch (_) {}
  const poiColor = (t) => (/^#[0-9a-f]{6}$/i.test(st.poiColors[t.key] || "") ? st.poiColors[t.key] : t.fill);
  function darken(hex, k) {
    const n = parseInt(hex.slice(1), 16), f = (v) => Math.round(v * (1 - k)).toString(16).padStart(2, "0");
    return "#" + f(n >> 16) + f((n >> 8) & 255) + f(n & 255);
  }

  function project(lat, lng) {
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

  const imgSize = (img) => [img.naturalWidth || img.width || 300, img.naturalHeight || img.height || 150];
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
  function callText() {
    const d = $("callDate").value, t = $("callTime").value;
    let out = "";
    if (d) {
      const [y, m, dd] = d.split("-").map(Number);
      if (y && m && dd) out = new Date(y, m - 1, dd).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    }
    if (t) {
      const [h, mi] = t.split(":");
      const ts = (+h) + "h" + (mi || "00");
      out = out ? out + " à " + ts : ts;
    }
    return out;
  }
  // [label, value, emoji] in display order
  function infoRows() {
    const v = (id) => $(id).value.trim();
    const rows = [];
    const call = callText();
    if (call) rows.push(["Get-In", call, "\u{1F552}"]);
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
  async function drawSheet(ctx, W, H, wait) {
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
    const L = current.sheetLabel;
    const m = mmPx(5) * s;
    drawInfoCard(ctx, m, H - m, W - m, s); // practical info: bottom-left
    if (L) {
      const cw = L.W * s, ch = L.H * s, x = m, y = m, r = mmPx(3) * s; // QR card: top-left
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
  function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; drawPreview(); }); }
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
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(els.sheet); else window.addEventListener("resize", schedule);

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
  els.sheet.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || ficheMode) return; // team view: the plan is not editable; a tap opens it in full screen
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

  function setZoom(z) { st.zoom = Math.max(MINZ, Math.min(MAXZ, z)); schedule(); }
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

  function segment(id, cb) {
    $(id).addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      $(id).querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      cb(b.dataset.v);
    });
  }
  segment("bgSeg", (v) => {
    st.bg = v; $("satOpts").hidden = v !== "sat"; $("poiOpts").hidden = v !== "sat"; $("shotOpts").hidden = v !== "shot"; $("zoomGroup").hidden = v !== "sat";
    if (v !== "sat" && st.tool === "poi") { st.placing = null; setTool("pan"); syncPois(); }
    syncTool(); schedule();
  });
  segment("toolSeg", (v) => { st.tool = v; st.placing = null; syncPois(); syncTool(); });
  function setTool(v) {
    st.tool = v;
    $("toolSeg").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.v === v)));
    syncTool();
  }
  function syncTool() { els.sheet.classList.toggle("drawing", st.tool === "arrow" || st.tool === "poi" || st.bg === "shot"); }
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
  function syncPois() {
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
  segment("layout", (v) => { layout = v; render(); });

  // Location
  function parseCoords(text) {
    const t = text.trim();
    let m = t.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) || t.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) || t.match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
    if (!m) return null;
    const lat = +m[1], lng = +m[2];
    return Math.abs(lat) <= 85 && Math.abs(lng) <= 180 ? { lat, lng } : null;
  }
  function setPlace(p, note) {
    if (st.place) {
      const a = project(st.place.lat, st.place.lng), b = project(p.lat, p.lng);
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) * Math.pow(2, 18) > 1500) { st.arrows.sat = []; st.pois = {}; syncPois(); } // moved far: old arrows and points no longer apply
    }
    st.place = p; st.center = { ...p };
    guideMark("place");
    render();
    els.coords.value = p.lat.toFixed(7) + ", " + p.lng.toFixed(7);
    if (note) say(note, "ok");
    schedule();
  }
  els.coords.addEventListener("change", () => {
    const p = parseCoords(els.coords.value);
    if (p) setPlace(p); else say("Coordonnées illisibles. Utilisez la forme 46.18793, 6.19892.", "warn");
  });
  els.custom.addEventListener("change", async () => {
    const link = els.custom.value.trim(), p = parseCoords(link);
    if (!p) return;
    setPlace(p, "Position reprise du lien Google Maps.");
    // Name from …/maps/place/<Nom+du+lieu>/…, address from the position
    const m = link.match(/\/maps\/place\/([^/@?]+)/);
    let filled = false;
    if (m) {
      const nm = decodeURIComponent(m[1].replace(/\+/g, " ")).trim();
      if (nm && !/^-?\d/.test(nm)) { els.name.value = nm; filled = true; }
    }
    const addr = await reverseAddress(p);
    if (addr) { els.addr.value = addr; filled = true; }
    if (filled) {
      $("exampleTag").hidden = true; exampleShown = false;
      clearTimeout(lookupTimer);
      lastLookup = els.addr.value.trim() + "|" + els.name.value.trim();
      render(); autosave();
      say("Nom, adresse et position repris du lien Google Maps. Vérifiez-les.", "ok");
    }
  });

  async function geocode(q) {
    try {
      const r = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" + encodeURIComponent(q), { headers: { "Accept-Language": "fr,en" } });
      const j = await r.json();
      if (j && j[0]) return { lat: +j[0].lat, lng: +j[0].lon, label: j[0].display_name };
    } catch (_) {}
    try {
      const r = await fetch("https://photon.komoot.io/api/?limit=1&q=" + encodeURIComponent(q));
      const j = await r.json();
      const f = j && j.features && j.features[0];
      if (f) return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
    } catch (_) {}
    return null;
  }
  let lastLookup = (els.addr.value.trim() + "|" + els.name.value.trim()), lookupSeq = 0, lookupTimer = 0;
  async function lookup(auto) {
    const addr = els.addr.value.trim().replace(/\s*\n\s*/g, ", "), name = els.name.value.trim();
    if (!addr && !name) { if (!auto) say("Saisissez d’abord une adresse.", "warn"); return; }
    lastLookup = els.addr.value.trim() + "|" + name;
    const seq = ++lookupSeq;
    say("Recherche de l’adresse…");
    const hit = (addr && await geocode(addr)) || (name && await geocode(name + (addr ? ", " + addr : "")));
    if (seq !== lookupSeq) return; // a newer lookup started while this one ran
    if (hit) setPlace(hit, "Carte centrée sur l’adresse. Faites-la glisser pour ajuster, puis vérifiez le repère.");
    else say("Adresse introuvable pour l’instant. Essayez rue, code postal et ville, ou collez des coordonnées.", "warn");
  }
  $("find").addEventListener("click", () => { clearTimeout(lookupTimer); lookup(false); });
  function autoLookup() {
    clearTimeout(lookupTimer);
    lookupTimer = setTimeout(() => {
      if (els.addr.value.trim() + "|" + els.name.value.trim() !== lastLookup) lookup(true);
    }, 1200);
  }
  els.addr.addEventListener("input", autoLookup);
  // ---------- Venue suggestions: typing a name proposes places; picking one fills the address and the position ----------
  // Source: Photon (OpenStreetMap data). Countries where the number follows the street name:
  const NUMBER_AFTER = ["ch", "de", "at", "it", "es", "nl", "be", "lu", "pt", "pl", "cz", "dk", "se", "no", "fi"];
  function formatAddress(a) {
    // a: { house, street, postcode, city, country, cc }
    const cc = (a.cc || "").toLowerCase();
    const line1 = a.street ? (a.house ? (NUMBER_AFTER.includes(cc) ? a.street + " " + a.house : a.house + " " + a.street) : a.street) : "";
    const line2 = [a.postcode, a.city].filter(Boolean).join(" ");
    return [line1, line2, cc && cc !== "fr" ? a.country : ""].filter(Boolean).join(", ");
  }
  let suggestAbort = null, suggestTimer = 0, suggestions = [], suggestIndex = -1, lastNominatim = 0;
  const sugBox = $("nameSuggest");
  function closeSuggest() { sugBox.hidden = true; els.name.setAttribute("aria-expanded", "false"); suggestIndex = -1; }
  function showSuggest() {
    sugBox.textContent = "";
    suggestions.forEach((sg, i) => {
      const li = document.createElement("li");
      li.id = "sug-" + i; li.setAttribute("role", "option"); li.setAttribute("aria-selected", String(i === suggestIndex));
      const n = document.createElement("span"); n.className = "sn"; n.textContent = sg.name;
      const a = document.createElement("span"); a.className = "sa"; a.textContent = sg.address || sg.kind || "";
      li.append(n, a);
      li.addEventListener("mousedown", (e) => { e.preventDefault(); pickSuggestion(i); });
      sugBox.appendChild(li);
    });
    const src = document.createElement("li"); src.className = "src"; src.setAttribute("role", "presentation"); src.textContent = "Données © contributeurs OpenStreetMap";
    sugBox.appendChild(src);
    sugBox.hidden = !suggestions.length;
    els.name.setAttribute("aria-expanded", String(!!suggestions.length));
    els.name.setAttribute("aria-activedescendant", suggestIndex >= 0 ? "sug-" + suggestIndex : "");
  }
  async function fetchSuggestions(q) {
    if (suggestAbort) suggestAbort.abort();
    suggestAbort = new AbortController();
    const signal = suggestAbort.signal;
    const c = st.center || st.place;
    const bias = c ? "&lat=" + c.lat.toFixed(4) + "&lon=" + c.lng.toFixed(4) : "&lat=46.2&lon=6.1";
    let list = [];
    // 1. Photon: fast, typo-tolerant, but rebuilt from OSM with a delay of several days
    try {
      const r = await fetch("https://photon.komoot.io/api/?limit=6&lang=fr" + bias + "&q=" + encodeURIComponent(q), { signal });
      const j = await r.json();
      list = (j.features || []).filter((f) => f.properties && f.properties.name).map((f) => {
        const p = f.properties;
        return {
          name: p.name,
          address: formatAddress({ house: p.housenumber, street: p.street, postcode: p.postcode, city: p.city || p.town || p.village || p.district, country: p.country, cc: p.countrycode }),
          lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0],
        };
      });
    } catch (e) { if (e && e.name === "AbortError") return; }
    // 2. Nominatim fallback: up to date within minutes, so recently added places show up.
    // Photon is typo-tolerant and almost always returns something ("Sixthemes" gives Sixt, Saint-Sixt…),
    // so the fallback runs whenever no Photon name contains what was typed, not only when the list is short.
    const norm = (t) => (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    const nq = norm(q);
    const matches = (name) => norm(name).includes(nq);
    if (list.length < 3 || !list.some((s) => matches(s.name))) {
      try {
        // Nominatim allows one request per second: wait if the previous one was too recent
        const wait = lastNominatim + 1100 - Date.now();
        if (wait > 0) await new Promise((res) => setTimeout(res, wait));
        if (signal.aborted) return;
        lastNominatim = Date.now();
        const found = [];
        const r = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=fr,ch,it&q=" + encodeURIComponent(q), { signal, headers: { "Accept-Language": "fr" } });
        const j = await r.json();
        for (const h of j || []) {
          if (!h.name) continue;
          const lat = +h.lat, lng = +h.lon;
          if (list.some((s) => s.name === h.name && Math.abs(s.lat - lat) < 0.001 && Math.abs(s.lng - lng) < 0.001)) continue;
          const a = h.address || {};
          found.push({
            name: h.name,
            address: formatAddress({ house: a.house_number, street: a.road, postcode: a.postcode, city: a.city || a.town || a.village || a.municipality, country: a.country, cc: a.country_code }),
            lat, lng,
          });
        }
        // Places whose name matches what was typed come first, before Photon's approximate guesses
        list = found.filter((x) => matches(x.name)).concat(list.filter((x) => matches(x.name)), found.filter((x) => !matches(x.name)), list.filter((x) => !matches(x.name)));
      } catch (e) { if (e && e.name === "AbortError") return; }
    }
    if (signal.aborted) return;
    suggestions = list.slice(0, 6);
    suggestIndex = -1;
    if (document.activeElement === els.name && suggestions.length) showSuggest(); else closeSuggest();
  }
  function pickSuggestion(i) {
    const sg = suggestions[i];
    if (!sg) return;
    closeSuggest();
    els.name.value = sg.name;
    if (sg.address) els.addr.value = sg.address;
    $("exampleTag").hidden = true; exampleShown = false;
    clearTimeout(lookupTimer);
    lastLookup = els.addr.value.trim() + "|" + els.name.value.trim(); // already positioned: no extra lookup
    setPlace({ lat: sg.lat, lng: sg.lng }, sg.address ? "Adresse et position remplies. Vérifiez le repère sur le plan." : "Position remplie ; ce lieu n’a pas d’adresse complète, complétez-la si besoin.");
    render(); autosave();
  }
  els.name.addEventListener("input", () => {
    clearTimeout(suggestTimer);
    const q = els.name.value.trim();
    if (q.length < 3) { closeSuggest(); return; }
    suggestTimer = setTimeout(() => fetchSuggestions(q), 350);
  });
  els.name.addEventListener("keydown", (e) => {
    if (sugBox.hidden) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      suggestIndex = (suggestIndex + (e.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length;
      showSuggest();
    } else if (e.key === "Enter" && suggestIndex >= 0) { e.preventDefault(); pickSuggestion(suggestIndex); }
    else if (e.key === "Escape") closeSuggest();
  });
  els.name.addEventListener("blur", () => setTimeout(closeSuggest, 150));

  // A full Google Maps link pasted in "Lien personnalisé": take the place name from it and look up the address
  async function reverseAddress(p) {
    try {
      const r = await fetch("https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=" + p.lat + "&lon=" + p.lng, { headers: { "Accept-Language": "fr" } });
      const a = (await r.json()).address || {};
      return formatAddress({ house: a.house_number, street: a.road || a.pedestrian || a.footway, postcode: a.postcode, city: a.city || a.town || a.village || a.municipality, country: a.country, cc: a.country_code });
    } catch (_) { return ""; }
  }
  els.addr.addEventListener("blur", () => { if (els.addr.value.trim() + "|" + els.name.value.trim() !== lastLookup) { clearTimeout(lookupTimer); lookup(true); } });

  // Logo
  // The last logo used is remembered on this device (IndexedDB), with its settings (localStorage).
  st.logo = null; st.logoData = ""; st.logoMm = 20; st.logoCard = true; st.logoOnLabel = false;
  try { Object.assign(st, JSON.parse(localStorage.getItem("easyroute.logo") || "{}")); } catch (_) {}
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
  function useLogo(blob, quiet) {
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

  // Screenshot background
  function useShot(file) {
    if (!file || !/^image\//.test(file.type)) return;
    const img = new Image();
    img.onload = () => { st.shot = img; if (st.bg !== "shot") $("bgSeg").querySelector('[data-v="shot"]').click(); schedule(); say("Capture chargée.", "ok"); };
    img.onerror = () => say("Impossible d’ouvrir cette image.", "warn");
    img.src = URL.createObjectURL(file);
  }
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

  // Tabs
  function tab(which) {
    [["sheet", "tabSheet", "paneSheet"], ["label", "tabLabel", "paneLabel"], ["msg", "tabMsg", "paneMsg"]].forEach(([k, t, p]) => {
      $(t).setAttribute("aria-selected", String(k === which)); $(p).hidden = k !== which;
    });
    if (which === "sheet") schedule();
    if (which === "msg") updateMessage();
  }
  $("tabSheet").addEventListener("click", () => tab("sheet"));
  $("tabLabel").addEventListener("click", () => tab("label"));
  $("tabMsg").addEventListener("click", () => tab("msg"));

  // ---------- Team message ----------
  // Route links to a point (or to a text search when there is no point)
  // Which links each point gets in the message: key -> { g: Google Maps, w: Waze, a: Plans, gps: coordinates }
  const LINK_COLS = [["g", "Google", "Google Maps"], ["w", "Waze", "Waze"], ["a", "Plans", "Plans (Apple)"], ["gps", "GPS", "Coordonnées GPS"]];
  const linkSel = { main: { g: true, w: true, a: true, gps: false } };
  POI_TYPES.forEach((t) => { linkSel[t.key] = { g: true, w: true, a: false, gps: false }; });
  try { const saved = JSON.parse(localStorage.getItem("easyroute.links") || "null"); if (saved) Object.keys(linkSel).forEach((k) => Object.assign(linkSel[k], saved[k] || {})); } catch (_) {}
  (function buildLinkGrid() {
    const g = $("linkGrid");
    g.insertAdjacentHTML("beforeend", "<span></span>" + LINK_COLS.map((c) => `<span class="lh" title="${c[2]}">${c[1]}</span>`).join(""));
    [{ key: "main", name: "Lieu", dot: "#ea4335" }, ...POI_TYPES.map((t) => ({ key: t.key, name: t.name, dot: poiColor(t) }))].forEach((r) => {
      const cells = [`<span class="ln" data-row="${r.key}"><span class="poidot" data-dot="${r.key}" style="background:${r.dot}"></span><span data-name="${r.key}">${r.name}</span></span>`]
        .concat(LINK_COLS.map((c) => `<input type="checkbox" id="lk-${r.key}-${c[0]}" data-row="${r.key}" aria-label="${c[2]} pour ${r.name}"${linkSel[r.key][c[0]] ? " checked" : ""}>`));
      g.insertAdjacentHTML("beforeend", cells.join(""));
      LINK_COLS.forEach((c) => $(`lk-${r.key}-${c[0]}`).addEventListener("change", (e) => {
        linkSel[r.key][c[0]] = e.target.checked;
        try { localStorage.setItem("easyroute.links", JSON.stringify(linkSel)); } catch (_) {}
        updateMessage();
      }));
    });
  })();
  function syncLinkGrid() {
    POI_TYPES.forEach((t) => {
      const placed = !!st.pois[t.key];
      $("linkGrid").querySelectorAll(`[data-row="${t.key}"]`).forEach((el) => { el.hidden = !placed; });
      const n = $("linkGrid").querySelector(`[data-name="${t.key}"]`); if (n) n.textContent = poiLabel(t);
      const d = $("linkGrid").querySelector(`[data-dot="${t.key}"]`); if (d) d.style.background = poiColor(t);
    });
  }
  const anyLink = (sel) => sel.g || sel.w || sel.a || sel.gps;
  function routeLines(p, title, search, sel) {
    const out = [];
    const ll = p ? p.lat.toFixed(6) + "," + p.lng.toFixed(6) : "";
    const links = sel.g || sel.w || sel.a;
    if (sel.g) out.push("", "Google Maps :", "https://www.google.com/maps/search/?api=1&query=" + (p ? ll : encodeURIComponent(search)));
    if (sel.w) out.push("", "Waze :", p ? "https://waze.com/ul?ll=" + ll + "&navigate=yes" : "https://waze.com/ul?q=" + encodeURIComponent(search) + "&navigate=yes");
    if (sel.a) out.push("", "Plans (Apple) :", p ? "https://maps.apple.com/?ll=" + ll + "&q=" + encodeURIComponent(title || "Lieu") : "https://maps.apple.com/?q=" + encodeURIComponent(search));
    if (sel.gps && p) out.push(...(links ? [""] : []), "Coordonnées GPS : " + p.lat.toFixed(6) + ", " + p.lng.toFixed(6));
    return out;
  }
  function messageText(forCalendar) {
    const name = els.name.value.trim(), addr = els.addr.value.trim().replace(/\s*\n\s*/g, ", ");
    const lines = [], event = $("eventName").value.trim();
    if (event) lines.push("\u{1F3AB} " + event, "");
    // The fiche link also goes into the .ics description
    const ficheLine = $("lkFiche").checked && ficheUrl ? ["", "\u{1F517} Fiche complète (plan, accès, itinéraires) :", ficheUrl] : [];
    if (name) lines.push("\u{1F4CD} " + name);
    if (addr) lines.push(name ? addr : "\u{1F4CD} " + addr);
    lines.push(...ficheLine);
    const info = infoRows();
    if (info.length) lines.push("", ...info.map(([k, v, icon]) => icon + " " + k + " : " + v));
    const cal = calEvent();
    if (cal && !forCalendar && $("lkCal").checked) {
      lines.push("", "\u{1F4C5} Ajouter à Google Agenda :", calLink(cal));
      const icsUrl = icsLink();
      if (icsUrl) lines.push("", "\u{1F4C6} Ajouter au calendrier (iPhone, Mac, Outlook) :", icsUrl);
    }
    lines.push("");
    if (anyLink(linkSel.main)) lines.push("Itinéraire :", ...routeLines(st.place, name || addr, (name ? name + ", " : "") + addr, linkSel.main));
    placedPois().forEach((t) => {
      if (!anyLink(linkSel[t.key])) return;
      const r = routeLines(st.pois[t.key], poiLabel(t), "", linkSel[t.key]);
      if (r.length) lines.push("", t.emoji + " " + poiLabel(t) + " :", ...r);
    });
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    return lines.join("\n");
  }
  function updateMessage() {
    if (!$("msg")) return;
    refreshFiche();
    syncCal();
    syncLinkGrid();
    const text = messageText();
    $("msg").value = text;
    // api.whatsapp.com rather than wa.me: the wa.me redirect is known to mangle some emoji
    $("msgWa").href = "https://api.whatsapp.com/send?text=" + encodeURIComponent(text);
    const call = callText();
    const event = $("eventName").value.trim(), place = els.name.value.trim() || els.addr.value.trim().split(/\n/)[0];
    const subject = (event ? event + " — " + (place || "lieu") : "Adresse : " + (place || "lieu de rendez-vous")) + (call ? " — " + call : "");
    $("msgMail").href = "mailto:?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(text);
    $("msgHint").textContent = st.place
      ? "Les liens pointent sur le repère du plan : tout le monde arrive au même endroit." + (placedPois().length ? " Chaque point utile a ses propres liens." : "")
      : "Aucune position sur la carte : les liens recherchent l’adresse. Placez le lieu pour un point exact.";
  }
  ["eventName", "callDate", "callTime", "callDur", "contactName", "contactPhone", "parking", "accessCode", "maxHeight", "note", "infoOnSheet"].forEach((id) =>
    $(id).addEventListener(/^(callDate|callTime|callDur|infoOnSheet)$/.test(id) ? "change" : "input", () => { updateMessage(); schedule(); }));

  // ---------- Calendar (Get-In) ----------
  // Event from the Get-In date/time: timed event of the chosen duration, or all-day without a time.
  function calEvent() {
    const d = $("callDate").value;
    if (!d) return null;
    const [y, m, dd] = d.split("-").map(Number);
    if (!y || !m || !dd) return null;
    const t = $("callTime").value, name = els.name.value.trim(), addr = els.addr.value.trim().replace(/\s*\n\s*/g, ", ");
    const event = $("eventName").value.trim();
    const ev = {
      title: "Get-In — " + (event || name || addr.split(",")[0] || "Lieu"),
      location: [name, addr].filter(Boolean).join(", "),
      allDay: !t,
      start: new Date(y, m - 1, dd), end: new Date(y, m - 1, dd + 1),
    };
    if (t) {
      const [h, mi] = t.split(":").map(Number);
      ev.start = new Date(y, m - 1, dd, h, mi || 0);
      ev.end = new Date(ev.start.getTime() + (+$("callDur").value || 4) * 3600e3);
    }
    return ev;
  }
  const utcStamp = (dt) => dt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dayStamp = (dt) => dt.getFullYear() + String(dt.getMonth() + 1).padStart(2, "0") + String(dt.getDate()).padStart(2, "0");
  // Short calendar link when the fiche has a short link (…/#a=<id>: Easy Route redirects to Google Calendar),
  // otherwise the full Google Calendar link
  // .ics served by the Worker for the fiche's short link (only once the Worker has confirmed it stores it)
  function icsLink() {
    const m = (ficheUrl || "").match(/#s=([0-9A-Za-z]{6,16})$/);
    return m && st.share && st.share.ics && st.share.id === m[1] ? SHORT_API + "/ics/" + m[1] : "";
  }
  // .ics sent along with the fiche: the Worker replaces __EASYROUTE_ID__ by the fiche's id
  function icsForUpload() {
    const ev = calEvent();
    if (!ev) return undefined;
    const saved = ficheUrl;
    ficheUrl = siteBase() + "#s=__EASYROUTE_ID__";
    try { return icsText(ev, "__EASYROUTE_ID__@easyroute"); } finally { ficheUrl = saved; }
  }
  function calLink(ev) {
    const m = (ficheUrl || "").match(/#s=([0-9A-Za-z]{6,16})$/);
    return m ? siteBase() + "#a=" + m[1] : googleCalUrl(ev);
  }
  function googleCalUrl(ev) {
    const dates = ev.allDay ? dayStamp(ev.start) + "/" + dayStamp(ev.end) : utcStamp(ev.start) + "/" + utcStamp(ev.end);
    // Short description (infos only) to keep the link reasonably short; the location opens the map
    const details = infoRows().filter((r) => r[0] !== "Get-In").map(([k, v]) => k + " : " + v).join("\n");
    return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(ev.title)
      + "&dates=" + dates + (ev.location ? "&location=" + encodeURIComponent(ev.location) : "")
      + (details ? "&details=" + encodeURIComponent(details) : "");
  }
  function icsText(ev, uid) {
    const esc = (v) => String(v).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
    const enc = new TextEncoder();
    const fold = (line) => { // RFC 5545: lines of at most 75 octets
      const out = []; let cur = "";
      for (const ch of line) {
        if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ch; } else cur += ch;
      }
      out.push(cur);
      return out.join("\r\n ");
    };
    const lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Easy Route//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:" + (uid || Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + "@easyroute"),
      "DTSTAMP:" + utcStamp(new Date()),
      ev.allDay ? "DTSTART;VALUE=DATE:" + dayStamp(ev.start) : "DTSTART:" + utcStamp(ev.start),
      ev.allDay ? "DTEND;VALUE=DATE:" + dayStamp(ev.end) : "DTEND:" + utcStamp(ev.end),
      "SUMMARY:" + esc(ev.title),
    ];
    if (ev.location) lines.push("LOCATION:" + esc(ev.location));
    if (st.place) lines.push("GEO:" + st.place.lat.toFixed(6) + ";" + st.place.lng.toFixed(6));
    lines.push("DESCRIPTION:" + esc(messageText(true)));
    if (!ev.allDay) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + esc(ev.title), "TRIGGER:-PT1H", "END:VALARM");
    lines.push("END:VEVENT", "END:VCALENDAR");
    return lines.map(fold).join("\r\n") + "\r\n";
  }
  function syncCal() {
    const ev = calEvent();
    $("msgIcs").disabled = !ev;
    $("calHint").textContent = ev
      ? (ev.allDay ? "Événement sur la journée entière (pas d’heure de Get-In)." : "Rappel 1 h avant dans le fichier .ics.") + " Le fichier .ics s’ouvre sur iPhone, Mac, Outlook et la plupart des Android ; le lien Google Agenda fonctionne partout."
      : "Renseignez la date du Get-In (infos pratiques, à gauche) pour créer l’événement d’agenda.";
  }
  try { $("lkCal").checked = localStorage.getItem("easyroute.cal") !== "0"; } catch (_) {}
  $("lkCal").addEventListener("change", (e) => { try { localStorage.setItem("easyroute.cal", e.target.checked ? "1" : "0"); } catch (_) {} updateMessage(); });
  $("msgIcs").addEventListener("click", () => icsDownload());
  async function icsDownload() {
    const ev = calEvent();
    if (!ev) return;
    const name = "get-in-" + current.base + ".ics";
    const blob = new Blob([icsText(ev)], { type: "text/calendar" });
    const file = new File([blob], name, { type: "text/calendar" });
    // Share sheet on phones only: on a Mac it would open the share window instead of Calendar
    if (matchMedia("(pointer: coarse)").matches && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: ev.title }); say("Événement partagé.", "ok"); return; }
      catch (e) { if (e && e.name === "AbortError") { say("Partage annulé."); return; } }
    }
    deliver(blob, name);
  }
  $("msgCopy").addEventListener("click", () => {
    const ta = $("msg"), sel = () => { ta.focus(); ta.select(); say("Message sélectionné. Appuyez sur ⌘C pour copier."); };
    try { navigator.clipboard.writeText(ta.value).then(() => say("Message copié. Collez-le dans WhatsApp ou votre e-mail.", "ok"), sel); } catch (_) { sel(); }
  });

  // ---------- Saving ----------
  function browserDownload(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function deliver(blob, filename) { browserDownload(blob, filename); say("Téléchargé : " + filename, "ok"); }
  const toBlob = (c, type) => new Promise((res, rej) => { try { c.toBlob((b) => b ? res(b) : rej(new Error("empty")), type, 0.92); } catch (err) { rej(err); } });

  async function saveLabel(kind) {
    const L = current.label;
    if (kind === "svg") return deliver(new Blob([L.svg], { type: "image/svg+xml" }), "qr-" + current.base + ".svg");
    try { deliver(await toBlob(L.canvas, kind === "jpg" ? "image/jpeg" : "image/png"), "qr-" + current.base + "." + kind); }
    catch (_) { say("Impossible de créer l’image.", "warn"); }
  }
  $("dlPng").addEventListener("click", () => saveLabel("png"));
  $("dlJpg").addEventListener("click", () => saveLabel("jpg"));
  $("dlSvg").addEventListener("click", () => saveLabel("svg"));

  async function saveSheet(kind) {
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
  $("sheetJpg").addEventListener("click", () => saveSheet("jpg"));

  // ---------- Share (iPhone / Android share sheet) ----------
  const canShareFiles = (() => {
    try { return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [new File([new Blob(["x"], { type: "image/jpeg" })], "t.jpg", { type: "image/jpeg" })] })); }
    catch (_) { return false; }
  })();
  const canShareText = !!navigator.share;
  if (canShareText) {
    document.querySelectorAll(".share").forEach((el) => {
      if ((el.id === "sheetShare" || el.htmlFor === "msgWithSheet") && !canShareFiles) return;
      el.hidden = false;
    });
    if (!$("msgShare").hidden) $("msgCopy").classList.remove("primary");
  }
  function shareSig() {
    return JSON.stringify([current.url, els.name.value, els.addr.value, els.qrmm.value, layout, els.showUrl.checked, st.place, st.center, st.zoom, st.roads, st.pin, st.bg, st.arrows, !!st.shot && st.shot.src, st.logoData.length, st.logoMm, st.logoCard, st.pois, POI_TYPES.map(poiLabel), $("infoOnSheet").checked, infoRows(), $("eventName").value]);
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
  $("sheetShare").addEventListener("click", (e) => shareNow(true, e.currentTarget));
  $("msgShare").addEventListener("click", (e) => shareNow(canShareFiles && $("msgWithSheet").checked, e.currentTarget));
  $("sheetPng").addEventListener("click", () => saveSheet("png"));

  // ---------- Misc inputs ----------
  $("copy").addEventListener("click", () => {
    const sel = () => { const r = document.createRange(); r.selectNodeContents(els.url); const s = getSelection(); s.removeAllRanges(); s.addRange(r); say("Lien sélectionné. Appuyez sur ⌘C pour copier."); };
    try { navigator.clipboard.writeText(current.url).then(() => say("Lien copié", "ok"), sel); } catch (_) { sel(); }
  });

  let exampleShown = true;
  ["name", "addr", "custom"].forEach((id) => $(id).addEventListener("input", () => {
    if (exampleShown && id !== "custom") { $("exampleTag").hidden = true; exampleShown = false; }
    render();
  }));
  ["useName", "qrmm", "dpi", "showUrl"].forEach((id) => $(id).addEventListener("change", render));
  segment("appSeg", (v) => {
    app = v;
    $("useNameRow").hidden = v === "waze";
    $("appHint").textContent = v === "waze" ? "Ouvre Waze et lance le guidage vers le repère de la carte. Sans l’app, le site Waze s’ouvre." : "Ouvre le lieu dans Google Maps, sur n’importe quel téléphone.";
    render();
  });
  $("form").addEventListener("submit", (e) => e.preventDefault());

  // Font
  // Label font: Barlow by default; a custom font file can be loaded and is remembered on this device only.
  let loadedFont = "", customFace = null;
  function fontState() {
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
  async function fontDbDo(mode, fn) {
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

  // ---------- Session & saved venues ----------
  // Everything describing the job (not the device settings) is captured in a snapshot.
  const JOB_FIELDS = ["name", "addr", "custom", "coords", "useName", "qrmm", "showUrl", "roads", "pin",
    "eventName", "callDate", "callTime", "callDur", "contactName", "contactPhone", "parking", "accessCode", "maxHeight", "note", "infoOnSheet"];
  function snapshot() {
    const fields = {};
    JOB_FIELDS.forEach((id) => { const el = $(id); fields[id] = el.type === "checkbox" ? el.checked : el.value; });
    return {
      v: 1, fields, app, layout,
      place: st.place, center: st.center, zoom: st.zoom, pois: st.pois, arrows: st.arrows.sat,
      poiLabels: Object.fromEntries(POI_TYPES.map((t) => [t.key, $("poiLabel-" + t.key).value])),
      poiColors: { ...st.poiColors },
      share: st.share || null, // owned short link { id, key } of this job
    };
  }
  function applyState(d) {
    st.share = d.share && d.share.id && d.share.key ? { id: d.share.id, key: d.share.key, ics: !!d.share.ics } : null;
    const f = d.fields || {};
    JOB_FIELDS.forEach((id) => { if (!(id in f)) return; const el = $(id); if (el.type === "checkbox") el.checked = !!f[id]; else el.value = f[id]; });
    st.roads = $("roads").checked; st.pin = $("pin").checked;
    st.place = d.place || null; st.center = d.center || (d.place ? { ...d.place } : null); st.zoom = d.zoom || 18;
    if (st.place) els.coords.value = st.place.lat.toFixed(7) + ", " + st.place.lng.toFixed(7);
    st.pois = d.pois || {}; st.arrows.sat = d.arrows || []; st.placing = null;
    POI_TYPES.forEach((t) => { $("poiLabel-" + t.key).value = (d.poiLabels && d.poiLabels[t.key]) || t.label; });
    if (d.poiColors) st.poiColors = { ...d.poiColors };
    POI_TYPES.forEach((t) => { $("poiColor-" + t.key).value = poiColor(t); });
    const clickSeg = (id, v) => { const b = v && $(id).querySelector(`[data-v="${v}"]`); if (b) b.click(); };
    clickSeg("appSeg", d.app); clickSeg("layout", d.layout);
    lastLookup = els.addr.value.trim() + "|" + els.name.value.trim(); // don't re-geocode a restored place
    $("exampleTag").hidden = true; exampleShown = false;
    setTool("pan"); syncPois(); render(); updateMessage(); schedule();
  }
  let sessionReady = false, saveTimer = 0;
  function saveNow() { clearTimeout(saveTimer); if (sessionReady) try { localStorage.setItem("easyroute.session", JSON.stringify(snapshot())); } catch (_) {} }
  function autosave() {
    if (!sessionReady) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 600);
  }
  // Save right away when the page is hidden or closed (switching apps on iPhone, closing the tab)
  window.addEventListener("pagehide", saveNow);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveNow(); });
  document.addEventListener("input", autosave);
  document.addEventListener("change", autosave);

  // Two-step confirmation for destructive buttons (no browser dialogs)
  function confirmClick(btn, label, action) {
    const orig = btn.textContent;
    btn.addEventListener("click", () => {
      if (btn.dataset.armed) { clearTimeout(+btn.dataset.armed); delete btn.dataset.armed; btn.textContent = orig; btn.classList.remove("confirm"); action(); return; }
      btn.textContent = label; btn.classList.add("confirm");
      btn.dataset.armed = String(setTimeout(() => { delete btn.dataset.armed; btn.textContent = orig; btn.classList.remove("confirm"); }, 4000));
    });
  }
  confirmClick($("venueNew"), "Tout effacer ?", () => {
    applyState({ fields: { name: "", addr: "", custom: "", coords: "", eventName: "", callDate: "", callTime: "", contactName: "", contactPhone: "", parking: "", accessCode: "", maxHeight: "", note: "" } });
    st.arrows.shot = []; $("venueSel").value = ""; syncVenueButtons(); saveNow();
    els.name.focus();
    say("Nouveau lieu : saisissez le nom et l’adresse.");
  });

  // Saved venues: one IndexedDB record holding the list (the logo is kept with each venue)
  let venues = [];
  const venueTitle = () => els.name.value.trim() || els.addr.value.trim().split(/\n|,/)[0].trim();
  function fillVenueSelect(selectId) {
    const sel = $("venueSel");
    sel.innerHTML = venues.length ? '<option value="">Choisir un lieu…</option>' : '<option value="">Aucun lieu enregistré</option>';
    [...venues].sort((a, b) => a.title.localeCompare(b.title, "fr")).forEach((v) => {
      const o = document.createElement("option"); o.value = v.id; o.textContent = v.title; sel.appendChild(o);
    });
    sel.value = selectId || "";
    syncVenueButtons();
  }
  function syncVenueButtons() { $("venueDel").disabled = !$("venueSel").value; $("venueExport").disabled = !venues.length; }
  async function storeVenues() { await fontDbDo("readwrite", (s) => s.put(venues, "venues")); }
  function dataUrlToBlob(url) {
    const [head, b64] = url.split(","), type = (head.match(/data:([^;]+)/) || [])[1] || "image/png";
    const bin = atob(b64), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type });
  }
  $("venueSave").addEventListener("click", async () => {
    const title = venueTitle();
    if (!title) { say("Saisissez au moins un nom ou une adresse avant d’enregistrer.", "warn"); return; }
    const existing = venues.find((v) => v.title.toLowerCase() === title.toLowerCase());
    const data = snapshot(); delete data.share; // a saved venue is reused for other dates: it gets its own new link
    const rec = { id: existing ? existing.id : Date.now().toString(36), title, savedAt: Date.now(), data, logoData: st.logoData || "" };
    venues = existing ? venues.map((v) => (v.id === rec.id ? rec : v)) : venues.concat(rec);
    try { await storeVenues(); fillVenueSelect(rec.id); say((existing ? "Lieu mis à jour : " : "Lieu enregistré : ") + title + ".", "ok"); }
    catch (_) { say("Impossible d’enregistrer sur cet appareil (navigation privée ?).", "warn"); }
  });
  $("venueSel").addEventListener("change", async () => {
    syncVenueButtons();
    const v = venues.find((x) => x.id === $("venueSel").value);
    if (!v) return;
    applyState(v.data);
    if (v.logoData) {
      const blob = dataUrlToBlob(v.logoData);
      if (await useLogo(blob, true)) { try { await fontDbDo("readwrite", (s) => s.put({ name: v.title, blob }, "logo")); } catch (_) {} }
    }
    say("Lieu chargé : " + v.title + ".", "ok");
  });
  // Export / import: one JSON file with every saved venue (logos included), to move them between devices
  $("venueExport").addEventListener("click", () => {
    if (!venues.length) return;
    const file = { app: "easyroute", v: 1, exportedAt: new Date().toISOString(), venues };
    const blob = new Blob([JSON.stringify(file)], { type: "application/json" });
    const day = new Date().toISOString().slice(0, 10);
    deliver(blob, "easyroute-lieux-" + day + ".json");
  });
  $("venueImport").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    let list;
    try {
      const data = JSON.parse(await f.text());
      list = data && data.app === "easyroute" && Array.isArray(data.venues) ? data.venues : null;
    } catch (_) { list = null; }
    if (!list) { say("Ce fichier n’est pas un export de lieux Easy Route.", "warn"); return; }
    let added = 0, updated = 0, kept = 0;
    list.forEach((v) => {
      if (!v || typeof v.title !== "string" || !v.data) return;
      const same = venues.find((x) => x.title.toLowerCase() === v.title.toLowerCase());
      if (!same) { venues.push({ ...v, id: v.id && !venues.some((x) => x.id === v.id) ? v.id : Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }); added++; }
      else if ((v.savedAt || 0) > (same.savedAt || 0)) { venues = venues.map((x) => (x === same ? { ...v, id: same.id } : x)); updated++; }
      else kept++;
    });
    try { await storeVenues(); } catch (_) { say("Impossible d’enregistrer sur cet appareil (navigation privée ?).", "warn"); return; }
    fillVenueSelect("");
    const parts = [];
    if (added) parts.push(added + " ajouté" + (added > 1 ? "s" : ""));
    if (updated) parts.push(updated + " mis à jour");
    if (kept) parts.push(kept + " déjà à jour");
    say("Import terminé : " + (parts.join(", ") || "aucun lieu dans le fichier") + ".", added || updated ? "ok" : "");
  });
  confirmClick($("venueDel"), "Supprimer ?", async () => {
    const v = venues.find((x) => x.id === $("venueSel").value);
    if (!v) return;
    venues = venues.filter((x) => x.id !== v.id);
    try { await storeVenues(); } catch (_) {}
    fillVenueSelect(""); say("Lieu supprimé : " + v.title + ".");
  });

  // ---------- Shared fiche: the whole job packed into the link (…/#fiche=…), no server ----------
  const SITE_URL = "https://easyroute.cloud/";
  let ficheUrl = "", ficheTimer = 0, ficheMode = false, ficheLinks = null;
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
    return { v: 1, fields: f, app, layout, place: rPt(st.place), center: rPt(st.center), zoom: st.zoom, pois,
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
  const siteBase = () => (/^https?:$/.test(location.protocol) ? location.origin + location.pathname : SITE_URL);
  // Short links: the fiche is stored by our Cloudflare Worker, the link only carries its id (…/#s=k7Qp2xA9bC).
  // If the Worker can't be reached, the long self-contained link (…/#fiche=…) is used instead.
  const SHORT_API = "https://api.easyroute.cloud";
  const shortIds = new Map(); // packed fiche -> id (links that can't be updated: older Worker without keys)
  let currentPacked = "", syncedPacked = "", shortTimer = 0, shortFailed = false;
  st.share = null; // { id, key }: the link of this job, kept with the session, updated in place
  const canShorten = () => ["easyroute.cloud", "www.easyroute.cloud", "fedorterrell.github.io", "localhost"].includes(location.hostname);
  function setFicheUrl(url, state) {
    $("ficheOpen").href = url || "#";
    $("ficheCopy").disabled = !url;
    $("ficheState").textContent = state || "";
    if (url !== ficheUrl) { ficheUrl = url; updateMessage(); }
  }
  const shortUrl = (id) => siteBase() + "#s=" + id;
  const SYNCED = "Fiche en ligne à jour. Si vous avez déjà envoyé ce lien, l’équipe voit cette version.";
  const SYNCED_KEPT = "Ce lien court existait déjà (il a pu être envoyé) : il reste à jour. « Nouveau lien » pour ne plus rien envoyer en ligne.";
  const LOCAL_ONLY = "Rien n’est envoyé en ligne : le lien long ci-dessus contient toute la fiche.";
  // Unticking « Lien de la fiche » stops new fiches from being stored by the Worker
  // (an existing short link keeps being updated: the team may already have it)
  const ficheOnline = () => $("lkFiche").checked;
  // Create the job's link, or update it in place (same link) once it exists
  async function shorten(packed, note) {
    const offline = () => {
      shortFailed = true;
      if (packed !== currentPacked) return;
      if (st.share) setFicheUrl(siteBase() + "#fiche=" + packed, "Pas de réseau : la fiche en ligne n’est pas à jour. Le lien ci-dessus (long) contient la version actuelle.");
      else $("ficheState").textContent = "Service des liens courts injoignable : le lien long fonctionne aussi.";
    };
    try {
      if (st.share) {
        const r = await fetch(SHORT_API + "/f/" + st.share.id, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ d: packed, key: st.share.key, ics: icsForUpload() }) });
        if (r.ok) {
          const res = await r.json().catch(() => ({}));
          if (!!res.ics !== !!st.share.ics) { st.share.ics = !!res.ics; autosave(); updateMessage(); }
          shortFailed = false; syncedPacked = packed;
          if (packed === currentPacked) setFicheUrl(shortUrl(st.share.id), ficheOnline() ? SYNCED : SYNCED_KEPT);
          return;
        }
        if (r.status !== 403 && r.status !== 404) return offline();
        st.share = null; // link no longer ours (expired, or older Worker): make a new one
        note = "Nouveau lien créé : l’ancien ne pouvait plus être mis à jour.";
      }
      if (!ficheOnline()) {
        syncFicheButtons(); autosave();
        if (packed === currentPacked) setFicheUrl(siteBase() + "#fiche=" + packed, LOCAL_ONLY);
        return;
      }
      const r = await fetch(SHORT_API + "/f", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ d: packed, ics: icsForUpload() }) });
      if (!r.ok) throw new Error(r.status);
      const { id, key, ics } = await r.json();
      if (!/^[0-9A-Za-z]{6,16}$/.test(id || "")) throw new Error("id");
      shortFailed = false;
      if (key) { st.share = { id, key, ics: !!ics }; syncedPacked = packed; autosave(); }
      else shortIds.set(packed, id); // older Worker: one link per version
      if (packed === currentPacked) setFicheUrl(shortUrl(id), note || (key ? "Lien court prêt. Il reste le même si vous modifiez la fiche." : "Lien court prêt."));
      syncFicheButtons();
    } catch (_) { offline(); }
  }
  function syncFicheButtons() { $("ficheNew").hidden = $("ficheDel").hidden = !st.share; }
  // Delete the fiche stored by the Worker (its key proves it is ours): the short link stops working.
  // « Lien de la fiche » is then unticked, so nothing is sent again.
  confirmClick($("ficheDel"), "Supprimer pour de bon ?", async () => {
    const share = st.share, btn = $("ficheDel");
    if (!share) return;
    clearTimeout(shortTimer);
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
    syncedPacked = ""; shortFailed = false;
    $("lkFiche").checked = false;
    try { localStorage.setItem("easyroute.ficheLink", "0"); } catch (_) {}
    syncFicheButtons(); autosave(); updateMessage(); refreshFiche();
    say("Fiche en ligne supprimée : son lien ne fonctionne plus. « Lien de la fiche » est décoché, rien n’est renvoyé en ligne.", "ok");
  });
  confirmClick($("ficheNew"), "Créer un nouveau lien ?", () => {
    st.share = null; syncedPacked = ""; syncFicheButtons(); autosave();
    say(ficheOnline() ? "Un nouveau lien va être créé. L’ancien garde la version déjà envoyée."
      : "L’ancien lien garde la version déjà envoyée. La fiche n’est plus envoyée en ligne.", "ok");
    refreshFiche();
  });
  function refreshFiche() {
    if (ficheMode) return;
    clearTimeout(ficheTimer);
    ficheTimer = setTimeout(async () => {
      if (!st.place && !els.addr.value.trim()) { currentPacked = ""; setFicheUrl("", ""); return; }
      const packed = await packFiche(ficheData());
      currentPacked = packed;
      syncFicheButtons();
      if (!canShorten()) { setFicheUrl(siteBase() + "#fiche=" + packed, ""); return; }
      if (st.share) {
        if (packed === syncedPacked) { setFicheUrl(shortUrl(st.share.id), ficheOnline() ? SYNCED : SYNCED_KEPT); return; }
        if (!shortFailed) setFicheUrl(shortUrl(st.share.id), "Mise à jour de la fiche en ligne…");
      } else {
        if (!ficheOnline()) { clearTimeout(shortTimer); setFicheUrl(siteBase() + "#fiche=" + packed, LOCAL_ONLY); return; }
        const id = shortIds.get(packed);
        if (id) { setFicheUrl(shortUrl(id), "Lien court prêt."); return; }
        setFicheUrl(siteBase() + "#fiche=" + packed, "Création du lien court…");
      }
      clearTimeout(shortTimer); shortTimer = setTimeout(() => shorten(packed), shortFailed ? 4000 : 1200);
    }, 300);
  }
  $("lkFiche").addEventListener("change", (e) => { try { localStorage.setItem("easyroute.ficheLink", e.target.checked ? "1" : "0"); } catch (_) {} updateMessage(); refreshFiche(); });
  try { $("lkFiche").checked = localStorage.getItem("easyroute.ficheLink") !== "0"; } catch (_) {}
  $("ficheCopy").addEventListener("click", () => {
    if (!ficheUrl) return;
    try { navigator.clipboard.writeText(ficheUrl).then(() => say("Lien de la fiche copié.", "ok"), () => say("Copie impossible ici : utilisez « Voir la fiche » puis copiez l’adresse.", "warn")); }
    catch (_) { say("Copie impossible ici : utilisez « Voir la fiche » puis copiez l’adresse.", "warn"); }
  });

  // Read-only view for the team
  function routeUrls(p, title, search) {
    const ll = p ? p.lat.toFixed(6) + "," + p.lng.toFixed(6) : "";
    return {
      google: "https://www.google.com/maps/search/?api=1&query=" + (p ? ll : encodeURIComponent(search)),
      waze: p ? "https://waze.com/ul?ll=" + ll + "&navigate=yes" : "https://waze.com/ul?q=" + encodeURIComponent(search) + "&navigate=yes",
      apple: p ? "https://maps.apple.com/?ll=" + ll + "&q=" + encodeURIComponent(title || "Lieu") : "https://maps.apple.com/?q=" + encodeURIComponent(search),
    };
  }
  function el(tag, attrs, text) {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
    if (text !== undefined) e.textContent = text;
    return e;
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
    ficheMode = on;
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
  async function openFiche(packed) {
    try {
      const d = await unpackFiche(packed);
      if (!d || d.v !== 1) throw new Error("format");
      ficheMode = true;
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
      ficheMode = false;
      return false;
    }
  }
  $("fJpg").addEventListener("click", () => saveSheet("jpg"));

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
  $("fZoom").addEventListener("click", openZoom);
  els.sheet.addEventListener("click", () => { if (ficheMode) openZoom(); });
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
    sessionReady = true; saveNow();
    updateMessage();
    say("Fiche ouverte dans l’éditeur. Elle remplace votre travail en cours.", "ok");
  });

  // ---------- First steps guide ----------
  // Shown to new users: four steps that tick themselves off as the job is done, plus a full example.
  const GUIDE_KEY = "easyroute.guide", GUIDE_STEPS = ["place", "pin", "pois", "send"];
  let guide = null;
  try { guide = JSON.parse(localStorage.getItem(GUIDE_KEY) || "null"); } catch (_) {}
  const guideSave = () => { try { localStorage.setItem(GUIDE_KEY, JSON.stringify(guide)); } catch (_) {} };
  function guideSync() {
    const g = guide || { done: [], closed: true };
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
  function guideMark(step) {
    if (!guide || guide.done.includes(step) || ficheMode) return;
    guide.done.push(step); guideSave(); guideSync();
  }
  function guideShow(on) {
    if (!guide) guide = { done: [], closed: true };
    guide.closed = !on; guideSave(); guideSync();
  }
  $("guideClose").addEventListener("click", () => { guideShow(false); $("guideOpen").focus(); });
  $("guideOpen").addEventListener("click", () => { guideShow(true); $("guide").scrollIntoView({ block: "nearest" }); });
  ["msgCopy", "msgWa", "msgMail", "msgShare"].forEach((id) => $(id).addEventListener("click", () => guideMark("send")));
  $("zoomIn").addEventListener("click", () => guideMark("pin"));
  $("zoomOut").addEventListener("click", () => guideMark("pin"));
  // A step takes you to where it is done
  const GUIDE_GO = {
    place: () => { els.name.scrollIntoView({ block: "center" }); els.name.focus(); },
    pin: () => { tab("sheet"); $("sheetBox").scrollIntoView({ block: "center" }); },
    pois: () => { tab("sheet"); $("poiOpts").scrollIntoView({ block: "center" }); },
    send: () => { tab("msg"); $("paneMsg").scrollIntoView({ block: "start" }); },
  };
  $("guide").querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => GUIDE_GO[b.dataset.step]()));

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
  $("guideDemo").addEventListener("click", () => {
    const btn = $("guideDemo");
    // Replacing real work needs a second tap (the untouched sample can go straight away)
    if (!exampleShown && !demoArmed) {
      btn.textContent = "Remplacer mon travail en cours ?"; btn.classList.add("confirm");
      demoArmed = setTimeout(() => { demoArmed = 0; btn.textContent = "Voir un exemple"; btn.classList.remove("confirm"); }, 4000);
      return;
    }
    clearTimeout(demoArmed); demoArmed = 0; btn.textContent = "Voir un exemple"; btn.classList.remove("confirm");
    applyState(demoState());
    st.arrows.shot = []; $("venueSel").value = ""; syncVenueButtons(); saveNow();
    tab("sheet"); $("sheetBox").scrollIntoView({ block: "center" });
    say("Exemple chargé : plan, points utiles, flèche et infos pratiques. Regardez aussi « Message équipe ». « Nouveau lieu » pour repartir de zéro.", "ok");
  });

  // ---------- Start ----------
  const start = parseCoords(els.coords.value);
  if (start) { st.place = start; st.center = { ...start }; }
  const ficheMatch = location.hash.match(/^#(fiche|s|a)=(.+)$/); // a = short calendar link
  const ficheHash = ficheMatch ? ficheMatch[2] : "";
  if (ficheHash) {
    // Team view: never touch this device's saved session
    (async () => {
      let packed = ficheHash, problem = "Ce lien de fiche est incomplet ou abîmé. Demandez un nouveau lien à l’expéditeur.";
      if (ficheMatch[1] === "a") say("Ouverture de Google Agenda…");
      if (ficheMatch[1] === "s" || ficheMatch[1] === "a") {
        packed = "";
        try {
          const r = await fetch(SHORT_API + "/f/" + encodeURIComponent(ficheHash));
          if (r.ok) packed = (await r.json()).d || "";
          else if (r.status === 404) problem = "Cette fiche est introuvable ou a expiré. Demandez un nouveau lien à l’expéditeur.";
        } catch (_) { problem = "Impossible de charger la fiche pour l’instant (pas de réseau ?). Réessayez dans un moment."; }
      }
      if (packed && await openFiche(packed)) {
        if (ficheMatch[1] !== "a") return;
        // Calendar link: go straight to Google Calendar with the event of the fiche (always its latest version)
        const ev = calEvent();
        if (ev) location.replace(googleCalUrl(ev));
        else say("Cette fiche n’a pas de date de Get-In : rien à ajouter à l’agenda.", "warn");
        return;
      }
      restoreSession(); sessionReady = true; guideSync();
      say(problem, "warn");
    })();
  } else {
    let firstVisit = true;
    try { firstVisit = !localStorage.getItem("easyroute.session"); } catch (_) {}
    restoreSession();
    sessionReady = true;
    // New users get the guide; people who already used Easy Route can open it with « Premiers pas »
    if (!guide) { guide = { done: [], closed: !firstVisit }; guideSave(); }
    guideSync();
  }
  // A fiche link opened in a tab where Easy Route is already open: reload to show it
  window.addEventListener("hashchange", () => { if (/^#(fiche|s|a)=/.test(location.hash)) location.reload(); });
  function restoreSession() {
    try {
      const saved = JSON.parse(localStorage.getItem("easyroute.session") || "null");
      if (saved && saved.v === 1) { applyState(saved); say("Dernière session reprise. « Nouveau lieu » pour repartir de zéro."); }
    } catch (_) {}
  }
  fontDbDo("readonly", (s) => s.get("venues")).then((list) => { venues = Array.isArray(list) ? list : []; fillVenueSelect(""); }).catch(() => {});
  syncTool(); syncPois();
  render(); fontState();
  if (!ficheHash) fontDbDo("readonly", (s) => s.get("logo")).then((saved) => { if (saved && saved.blob) useLogo(saved.blob, true); }).catch(() => {});
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('400 40px "Barlow"'), document.fonts.load('400 20px "JetBrains Mono"')]).then(() => { render(); fontState(); }, () => {});
  }
})();
