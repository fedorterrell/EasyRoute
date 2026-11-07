// Outils communs aux tests : page sans réseau extérieur, et quelques gestes sur le plan.
const path = require("path");
const { test: base, expect } = require("@playwright/test");

// Faux service des liens courts (remplace le Worker Cloudflare pendant les tests)
const shortStore = new Map();
const WORKER = /^https:\/\/api\.easyroute\.cloud\//;
async function setupRoutes(context, { workerDown = false, legacyWorker = false } = {}) {
  // Pas d'appel aux services extérieurs pendant les tests : tuiles, géocodage, polices Google.
  await context.route(/arcgisonline|nominatim|photon|fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await context.route(WORKER, async (r) => {
    if (workerDown) return r.abort();
    const req = r.request(), url = new URL(req.url()), cors = { "Access-Control-Allow-Origin": "*" };
    const reply = (status, body) => r.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(body) });
    if (req.method() === "OPTIONS") return r.fulfill({ status: 204, headers: { ...cors, "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
    if (req.method() === "POST" && url.pathname === "/f") {
      const d = JSON.parse(req.postData()).d;
      const id = "T" + require("crypto").randomBytes(5).toString("hex").slice(0, 9);
      if (legacyWorker) { shortStore.set(id, { d }); return reply(200, { id }); } // première version : pas de clé
      const key = "K" + require("crypto").randomBytes(8).toString("hex");
      shortStore.set(id, { d, key, ics: JSON.parse(req.postData()).ics || null });
      return reply(200, { id, key, ics: true });
    }
    const m = url.pathname.match(/^\/f\/(.+)$/);
    if (req.method() === "PUT" && m && !legacyWorker) {
      const row = shortStore.get(m[1]), body = JSON.parse(req.postData());
      if (!row) return reply(404, { error: "introuvable" });
      if (!row.key || row.key !== body.key) return reply(403, { error: "clé" });
      row.d = body.d; row.ics = body.ics || null; return reply(200, { id: m[1], ics: true });
    }
    if (req.method() === "DELETE" && m && !legacyWorker) {
      const row = shortStore.get(m[1]), body = JSON.parse(req.postData() || "{}");
      if (!row) return reply(404, { error: "introuvable", gone: true });
      if (!row.key || row.key !== body.key) return reply(403, { error: "clé" });
      shortStore.delete(m[1]); return reply(200, { deleted: true });
    }
    if (req.method() === "GET" && m && shortStore.has(m[1])) return reply(200, { d: shortStore.get(m[1]).d });
    const mi = url.pathname.match(/^\/ics\/(.+)$/);
    if (req.method() === "GET" && mi && shortStore.has(mi[1]) && shortStore.get(mi[1]).ics)
      return r.fulfill({ status: 200, headers: cors, contentType: "text/calendar; charset=utf-8", body: shortStore.get(mi[1]).ics.replace(/\r\n[ \t]/g, "").replace(/__EASYROUTE_ID__/g, mi[1]) });
    return r.fulfill({ status: 404, headers: cors, contentType: "application/json", body: '{"error":"introuvable"}' });
  });
}

const test = base.extend({
  workerDown: [false, { option: true }],
  legacyWorker: [false, { option: true }],
  page: async ({ page, workerDown, legacyWorker }, use) => {
    await setupRoutes(page.context(), { workerDown, legacyWorker });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await expect(page.locator("#url")).not.toBeEmpty();
    await use(page);
    expect(errors, "erreurs JavaScript dans la page").toEqual([]);
  },
});

const fixture = (name) => path.join(__dirname, "fixtures", name);

// Toucher le plan à une position relative (0..1)
async function tapSheet(page, fx, fy) {
  await page.locator("#sheet").scrollIntoViewIfNeeded();
  const box = await page.locator("#sheet").boundingBox();
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

async function placePoint(page, key, fx, fy) {
  await page.click(`#poiPlace-${key}`);
  await tapSheet(page, fx, fy);
  await expect(page.locator(`#poiPlace-${key}`)).toHaveText("Déplacer");
}

const message = (page) => page.locator("#msg").inputValue();

// La fiche ne part en ligne qu'au moment d'un envoi : premier toucher de « Copier le lien de la fiche ».
// Renvoie le lien court.
async function publishFiche(page) {
  await page.click("#tabMsg");
  await page.waitForTimeout(400); // état du lien recalculé après la dernière saisie
  await page.click("#ficheCopy");
  await expect(page.locator("#ficheState")).toHaveText(/Fiche en ligne à jour|Lien court prêt|existait déjà/);
  await expect(page.locator("#ficheOpen")).toHaveAttribute("href", /#s=T[0-9a-f]{9}$/);
  return page.getAttribute("#ficheOpen", "href");
}

// Requêtes qui écrivent sur le service des liens courts (création, mise à jour, suppression)
function trackWrites(target) {
  const sent = [];
  target.on("request", (req) => { if (/api\.easyroute\.cloud\/f/.test(req.url()) && req.method() !== "GET") sent.push(req.method()); });
  return sent;
}

// Ouvre un lien de fiche comme un équipier : autre navigateur, rien d'enregistré
async function openAsTeam(browser, url) {
  const ctx = await browser.newContext();
  await setupRoutes(ctx);
  const team = await ctx.newPage();
  await team.goto(url.replace(/^https?:\/\/[^/]+\/(easyroute\/)?/, "/"));
  return team;
}

module.exports = { test, expect, fixture, tapSheet, placePoint, message, setupRoutes, openAsTeam, shortStore, publishFiche, trackWrites };
