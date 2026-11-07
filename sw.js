// Easy Route ! — service worker : le site et les fiches déjà ouvertes restent utilisables sans réseau
// (quai de déchargement, sous-sol…). Enregistré par js/main.js.
//
// - Pages et fichiers du site : réseau d'abord (toujours la dernière version en ligne), copie gardée
//   pour le hors ligne. À l'installation, la page et tous les fichiers qu'elle cite (?v= compris) sont
//   mis en mémoire, pour que le premier passage suffise.
// - Fiches lues sur le service des liens courts (GET /f/<id>) : réseau d'abord, sinon la dernière copie,
//   marquée par l'en-tête X-Easyroute-Offline pour que la page le signale.
// - Tuiles de carte et polices : mémoire d'abord (elles ne changent pas), dans la limite de TILE_MAX tuiles.
// Rien d'autre n'est intercepté (géocodage, envois de fiches, .ics…).
const SITE = "easyroute-site-v1", TILES = "easyroute-tiles-v1";
const TILE_MAX = 1500;
const API = "https://api.easyroute.cloud";
const SCOPE = new URL("./", self.location).href;

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(SITE);
    try {
      const page = await fetch(SCOPE, { cache: "no-cache" });
      if (!page.ok) return;
      const html = await page.clone().text();
      await cache.put(SCOPE, page);
      // Fichiers du site cités par la page : href/src relatifs et URL de l'import map
      const urls = new Set();
      for (const m of html.matchAll(/(?:href|src)="([^"#:]+)"|"(\.\/[^"#]+)"\s*[,}\n]/g)) urls.add(new URL(m[1] || m[2], SCOPE).href);
      await Promise.all([...urls].map(async (u) => {
        try { const r = await fetch(u, { cache: "no-cache" }); if (r.ok) await cache.put(u, r); } catch (_) {}
      }));
    } catch (_) {} // hors ligne à l'installation : le cache se remplira au prochain passage
  })().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== SITE && k !== TILES) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Garde la réponse, et retire les anciennes versions du même fichier (autre ?v=)
async function keep(cache, key, res) {
  const url = new URL(key);
  for (const old of await cache.keys()) {
    const o = new URL(old.url);
    if (o.origin === url.origin && o.pathname === url.pathname && o.search !== url.search) await cache.delete(old);
  }
  await cache.put(key, res);
}

async function site(req) {
  const cache = await caches.open(SITE);
  const nav = req.mode === "navigate";
  const path = new URL(req.url).pathname, home = new URL(SCOPE).pathname;
  const isPage = nav && (path === home || path === home + "index.html");
  try {
    const res = await fetch(req);
    if (res.ok && (!nav || isPage)) await keep(cache, isPage ? SCOPE : req.url, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(isPage || nav ? SCOPE : req.url);
    if (hit) return hit;
    throw err;
  }
}

async function fiche(req) {
  const cache = await caches.open(SITE);
  try {
    const res = await fetch(req);
    if (res.ok) await cache.put(req.url, res.clone());
    else if (res.status === 404) await cache.delete(req.url); // supprimée ou expirée : on n'en garde rien
    return res;
  } catch (err) {
    const hit = await cache.match(req.url);
    if (!hit) throw err;
    const headers = new Headers(hit.headers);
    headers.set("X-Easyroute-Offline", "1");
    return new Response(await hit.blob(), { status: hit.status, headers });
  }
}

let trimming = null;
async function stored(req) {
  const cache = await caches.open(TILES);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") {
    await cache.put(req, res.clone());
    if (!trimming) trimming = (async () => { // les plus anciennes d'abord
      const keys = await cache.keys();
      for (let i = 0; i < keys.length - TILE_MAX; i++) await cache.delete(keys[i]);
    })().finally(() => { trimming = null; });
  }
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) e.respondWith(site(req));
  else if (url.origin === API && /^\/f\/[0-9A-Za-z]{6,16}$/.test(url.pathname)) e.respondWith(fiche(req));
  else if (url.hostname === "server.arcgisonline.com" || url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") e.respondWith(stored(req));
});
