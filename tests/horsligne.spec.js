// Hors ligne : sw.js garde le site et les fiches sur l'appareil.
// Les autres tests bloquent le service worker (voir playwright.config.js) ; celui-ci l'autorise.
const { test, expect, setupRoutes } = require("./helpers");

async function siteCache(page) {
  return page.evaluate(async () => {
    const c = await caches.open("easyroute-site-v1");
    return (await c.keys()).map((r) => new URL(r.url).pathname + new URL(r.url).search);
  });
}

test("après une première visite, le site et une fiche s’ouvrent sans réseau", async ({ browser }) => {
  const ctx = await browser.newContext({ serviceWorkers: "allow" });
  await setupRoutes(ctx);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#url")).not.toBeEmpty();
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Dès l'installation : la page et tous les fichiers qu'elle cite, avec leur ?v=
  const html = await (await page.request.get("/")).text();
  const main = html.match(/js\/main\.js\?v=[^"]+/)[0];
  await expect.poll(() => siteCache(page)).toEqual(expect.arrayContaining(["/", "/" + main, "/js/core.js" + main.slice(main.indexOf("?")), "/js/qrcode.js?v=1.4.4"]));
  const cached = await siteCache(page);
  expect(cached.filter((u) => u.startsWith("/css/easyroute.css?v="))).toHaveLength(1);

  // Lien long de la fiche (rien en ligne), puis plus de réseau du tout
  await page.click("#tabMsg");
  await page.uncheck("#lkFiche");
  await expect(page.locator("#ficheOpen")).toHaveAttribute("href", /#fiche=/);
  const long = await page.getAttribute("#ficheOpen", "href");
  await ctx.setOffline(true);
  await page.reload();
  await expect(page.locator("#url")).toHaveText(/^https:\/\/www\.google\.com\/maps\//);
  await page.goto(long.replace(/^https?:\/\/[^/]+/, ""));
  await expect(page.locator("#ficheView")).toBeVisible();
  await expect(page.locator("#fRoutes .froute")).not.toHaveCount(0);
  expect(errors).toEqual([]);
  await ctx.close();
});
