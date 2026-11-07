// Easy Route ! — message équipe, liens d'itinéraire et agenda (.ics, Google Agenda).
import { $, current, els, POI_TYPES, say, shared, SHORT_API, st } from "./core.js";
import { callText, infoRows, placedPois, poiColor, poiLabel, schedule } from "./sheet.js";
import { deliver } from "./export.js";
import { canShorten, ficheOnline, hasPlace, refreshFiche, siteBase } from "./fiche.js";

// Route links to a point (or to a text search when there is no point)
// Which links each point gets in the message: key -> { g: Google Maps, w: Waze, a: Plans, gps: coordinates }
export const LINK_COLS = [["g", "Google", "Google Maps"], ["w", "Waze", "Waze"], ["a", "Plans", "Plans (Apple)"], ["gps", "GPS", "Coordonnées GPS"]];
export const linkSel = { main: { g: true, w: true, a: true, gps: false } };
export function syncLinkGrid() {
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
export function messageText(forCalendar) {
  const name = els.name.value.trim(), addr = els.addr.value.trim().replace(/\s*\n\s*/g, ", ");
  const lines = [], event = $("eventName").value.trim();
  if (event) lines.push("\u{1F3AB} " + event, "");
  // The fiche link also goes into the .ics description
  // Short link not created yet: it is created when sharing, and replaces this placeholder before the message leaves
  const ficheLink = shared.ficheUrl || (!forCalendar && ficheOnline() && canShorten() && hasPlace() ? "(lien créé à l’envoi)" : "");
  const ficheLine = $("lkFiche").checked && ficheLink ? ["", "\u{1F517} Fiche complète (plan, accès, itinéraires) :", ficheLink] : [];
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
export function updateMessage() {
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

// ---------- Calendar (Get-In) ----------
// Event from the Get-In date/time: timed event of the chosen duration, or all-day without a time.
export function calEvent() {
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
  const m = (shared.ficheUrl || "").match(/#s=([0-9A-Za-z]{6,16})$/);
  return m && st.share && st.share.ics && st.share.id === m[1] ? SHORT_API + "/ics/" + m[1] : "";
}
// .ics sent along with the fiche: the Worker replaces __EASYROUTE_ID__ by the fiche's id
export function icsForUpload() {
  const ev = calEvent();
  if (!ev) return undefined;
  const saved = shared.ficheUrl;
  shared.ficheUrl = siteBase() + "#s=__EASYROUTE_ID__";
  try { return icsText(ev, "__EASYROUTE_ID__@easyroute"); } finally { shared.ficheUrl = saved; }
}
function calLink(ev) {
  const m = (shared.ficheUrl || "").match(/#s=([0-9A-Za-z]{6,16})$/);
  return m ? siteBase() + "#a=" + m[1] : googleCalUrl(ev);
}
export function googleCalUrl(ev) {
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
export async function icsDownload() {
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

// Câblage de la page (écouteurs, état de départ) : appelé par main.js, dans l'ordre
export function init() {
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
  ["eventName", "callDate", "callTime", "callDur", "contactName", "contactPhone", "parking", "accessCode", "maxHeight", "note", "infoOnSheet"].forEach((id) =>
    $(id).addEventListener(/^(callDate|callTime|callDur|infoOnSheet)$/.test(id) ? "change" : "input", () => { updateMessage(); schedule(); }));
  try { $("lkCal").checked = localStorage.getItem("easyroute.cal") !== "0"; } catch (_) {}
  $("lkCal").addEventListener("change", (e) => { try { localStorage.setItem("easyroute.cal", e.target.checked ? "1" : "0"); } catch (_) {} updateMessage(); });
  $("msgIcs").addEventListener("click", () => icsDownload());
  $("msgCopy").addEventListener("click", () => {
    const ta = $("msg"), sel = () => { ta.focus(); ta.select(); say("Message sélectionné. Appuyez sur ⌘C pour copier."); };
    try { navigator.clipboard.writeText(ta.value).then(() => say("Message copié. Collez-le dans WhatsApp ou votre e-mail.", "ok"), sel); } catch (_) { sel(); }
  });
}
