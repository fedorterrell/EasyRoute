// Tests du vrai code du Worker (worker/easyroute-fiches.js), avec une base SQLite en mémoire.
// Lancement : npm run test:worker (Node 22.13 ou plus récent, sans installation).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fakeD1, freshWorker } from "./fake-d1.mjs";

const SITE = "https://easyroute.cloud";
const FICHE = "1abcDEF_-xyz"; // forme d'une fiche compressée (chiffre de format, puis base64url)
let worker, env;

beforeEach(async () => {
  worker = await freshWorker();
  env = { DB: fakeD1() };
});

function call(method, path, { body, origin = SITE } = {}) {
  const headers = {};
  if (origin) headers.Origin = origin;
  if (body !== undefined) headers["Content-Type"] = "text/plain";
  const init = { method, headers };
  if (body !== undefined) init.body = typeof body === "string" ? body : JSON.stringify(body);
  return worker.fetch(new Request("https://api.easyroute.cloud" + path, init), env);
}
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
async function create(body = { d: FICHE }) {
  const r = await call("POST", "/f", { body });
  assert.equal(r.status, 200);
  return r.json();
}

// ---------- CORS et adresses ----------

test("préflight CORS : méthodes autorisées, origine renvoyée si elle est autorisée", async () => {
  const r = await call("OPTIONS", "/f/abcdef1234");
  assert.equal(r.status, 204);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), SITE);
  assert.equal(r.headers.get("Access-Control-Allow-Methods"), "GET, POST, PUT, DELETE, OPTIONS");
  const other = await call("OPTIONS", "/f", { origin: "https://pirate.example" });
  assert.equal(other.headers.get("Access-Control-Allow-Origin"), SITE); // jamais l'origine inconnue
  const local = await call("OPTIONS", "/f", { origin: "http://localhost:4173" });
  assert.equal(local.headers.get("Access-Control-Allow-Origin"), "http://localhost:4173");
});

test("/health répond, une adresse inconnue donne 404, une base absente 500", async () => {
  assert.equal(await (await call("GET", "/health")).text(), "ok");
  assert.equal((await call("GET", "/autre")).status, 404);
  assert.equal((await call("GET", "/f/ab")).status, 404); // identifiant trop court
  const r = await worker.fetch(new Request("https://api.easyroute.cloud/f/abcdef1234"), {});
  assert.equal(r.status, 500);
});

test("ALLOWED_ORIGINS remplace la liste des sites autorisés", async () => {
  env.ALLOWED_ORIGINS = "https://autre.example, https://encore.example";
  assert.equal((await call("POST", "/f", { body: { d: FICHE } })).status, 403);
  assert.equal((await call("POST", "/f", { body: { d: FICHE }, origin: "https://encore.example" })).status, 200);
});

// ---------- Création ----------

test("création : identifiant et clé aléatoires, la base ne garde que l'empreinte de la clé", async () => {
  const { id, key, ics } = await create();
  assert.match(id, /^[0-9A-Za-z]{10}$/);
  assert.match(key, /^[0-9A-Za-z]{24}$/);
  assert.equal(ics, true);
  const row = env.DB.raw.prepare("SELECT * FROM fiches WHERE id = ?").get(id);
  assert.equal(row.data, FICHE);
  assert.equal(row.key_hash, sha256(key));
  assert.ok(!JSON.stringify(row).includes(key), "la clé elle-même n'est jamais stockée");
  const again = await create();
  assert.notEqual(again.id, id);
  assert.notEqual(again.key, key);
});

test("création refusée hors d'Easy Route (en-tête Origin absent ou inconnu)", async () => {
  assert.equal((await call("POST", "/f", { body: { d: FICHE }, origin: null })).status, 403);
  assert.equal((await call("POST", "/f", { body: { d: FICHE }, origin: "https://pirate.example" })).status, 403);
  assert.equal(env.DB.raw.prepare("SELECT name FROM sqlite_master WHERE name = 'fiches'").get(), undefined);
});

test("création refusée : corps vide, JSON invalide, fiche mal formée ou trop grande", async () => {
  const bad = async (body, status) => assert.equal((await call("POST", "/f", { body })).status, status, JSON.stringify(body).slice(0, 40));
  await bad("", 413);
  await bad("pas du json", 400);
  await bad({}, 400);
  await bad({ d: 12 }, 400);
  await bad({ d: "abc" }, 400); // doit commencer par un chiffre
  await bad({ d: "1<script>" }, 400);
  await bad({ d: "1" + "a".repeat(48 * 1024) }, 413);
});

// ---------- Lecture et mise à jour ----------

test("lecture : la fiche, sans cache ; 404 si elle n'existe pas", async () => {
  const { id } = await create();
  const r = await call("GET", "/f/" + id, { origin: null }); // n'importe qui peut lire avec le lien
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { d: FICHE });
  assert.equal(r.headers.get("Cache-Control"), "no-store");
  assert.equal((await call("GET", "/f/Tinconnu00")).status, 404);
});

test("mise à jour : même lien avec la bonne clé, refusée sinon", async () => {
  const { id, key } = await create();
  const put = (body, origin) => call("PUT", "/f/" + id, { body, origin });
  assert.equal((await put({ d: "1nouvelle", key: "mauvaise" })).status, 403);
  assert.equal((await put({ d: "1nouvelle" })).status, 403); // sans clé
  assert.equal((await put({ d: "1nouvelle", key }, "https://pirate.example")).status, 403);
  assert.deepEqual(await (await call("GET", "/f/" + id)).json(), { d: FICHE }, "rien n'a changé");
  const ok = await put({ d: "1nouvelle", key });
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { id, ics: true });
  assert.deepEqual(await (await call("GET", "/f/" + id)).json(), { d: "1nouvelle" });
  assert.equal((await call("PUT", "/f/Tinconnu00", { body: { d: FICHE, key } })).status, 404);
});

// ---------- Suppression ----------

test("suppression : avec la clé seulement, puis le lien et son .ics ne marchent plus", async () => {
  const ics = "BEGIN:VCALENDAR\r\nUID:__EASYROUTE_ID__@easyroute\r\nEND:VCALENDAR";
  const { id, key } = await create({ d: FICHE, ics });
  const del = (body, origin) => call("DELETE", "/f/" + id, { body, origin });
  assert.equal((await del({ key: "mauvaise" })).status, 403);
  assert.equal((await del({})).status, 403);
  assert.equal((await del("pas du json")).status, 403);
  assert.equal((await del({ key }, "https://pirate.example")).status, 403);
  assert.equal((await call("GET", "/f/" + id)).status, 200, "toujours là après les refus");
  const ok = await del({ key });
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { deleted: true });
  assert.equal((await call("GET", "/f/" + id)).status, 404);
  assert.equal((await call("GET", "/ics/" + id)).status, 404);
  // Déjà supprimée : 404 avec « gone », pour que le site sache que c'est fait
  const again = await del({ key });
  assert.equal(again.status, 404);
  assert.equal((await again.json()).gone, true);
});

// ---------- Agenda (.ics) ----------

test(".ics : identifiant remplacé, lignes de 75 octets au plus (RFC 5545), accents intacts", async () => {
  const long = "DESCRIPTION:Fiche complète : https://easyroute.cloud/#s=__EASYROUTE_ID__ — accès décharge côté rue, ".repeat(3);
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", "UID:__EASYROUTE_ID__@easyroute", long, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const { id } = await create({ d: FICHE, ics });
  const r = await call("GET", "/ics/" + id, { origin: null });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("Content-Type"), /^text\/calendar/);
  assert.equal(r.headers.get("Cache-Control"), "no-store");
  const text = await r.text();
  for (const line of text.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75, "ligne trop longue : " + line);
  assert.ok(!text.includes("__EASYROUTE_ID__"));
  assert.equal(text.replace(/\r\n[ \t]/g, ""), ics.replaceAll("__EASYROUTE_ID__", id), "dépliée, l'agenda est intact");
  assert.equal((await call("GET", "/ics/" + id + ".ics")).status, 200); // avec l'extension aussi
});

test(".ics : ignoré s'il ne commence pas par BEGIN:VCALENDAR ; une mise à jour sans .ics le retire", async () => {
  const { id: noIcs } = await create({ d: FICHE, ics: "<html>" });
  assert.equal((await call("GET", "/ics/" + noIcs)).status, 404);
  const { id, key } = await create({ d: FICHE, ics: "BEGIN:VCALENDAR\r\nEND:VCALENDAR" });
  assert.equal((await call("GET", "/ics/" + id)).status, 200);
  await call("PUT", "/f/" + id, { body: { d: FICHE, key } }); // plus de date de Get-In
  assert.equal((await call("GET", "/ics/" + id)).status, 404);
});

// ---------- Base ----------

test("ménage : une création efface de temps en temps les fiches non modifiées depuis 400 jours", async (t) => {
  await create(); // crée la table
  const day = 864e5, now = Date.now();
  const insert = env.DB.raw.prepare("INSERT INTO fiches (id, data, created, updated) VALUES (?, ?, ?, ?)");
  insert.run("vieille0001", FICHE, now - 500 * day, now - 401 * day);
  insert.run("recente0001", FICHE, now - 500 * day, now - 10 * day); // ancienne mais modifiée récemment
  t.mock.method(Math, "random", () => 0); // force le ménage (2 % des créations)
  await create();
  assert.equal((await call("GET", "/f/vieille0001")).status, 404);
  assert.equal((await call("GET", "/f/recente0001")).status, 200);
});

test("ancienne base (avant les clés) : colonnes ajoutées, anciennes fiches lisibles mais pas modifiables", async () => {
  env.DB.raw.exec("CREATE TABLE fiches (id TEXT PRIMARY KEY, data TEXT NOT NULL, created INTEGER NOT NULL)");
  env.DB.raw.prepare("INSERT INTO fiches (id, data, created) VALUES (?, ?, ?)").run("ancienne01", FICHE, Date.now());
  assert.deepEqual(await (await call("GET", "/f/ancienne01")).json(), { d: FICHE });
  const cols = env.DB.raw.prepare("PRAGMA table_info(fiches)").all().map((c) => c.name);
  assert.deepEqual(cols, ["id", "data", "created", "key_hash", "updated", "ics"]);
  assert.equal((await call("PUT", "/f/ancienne01", { body: { d: FICHE, key: "x" } })).status, 403);
  assert.equal((await call("DELETE", "/f/ancienne01", { body: { key: "x" } })).status, 403);
  await create(); // et les nouvelles fiches fonctionnent
});
