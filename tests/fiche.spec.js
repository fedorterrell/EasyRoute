const { test, expect, placePoint, message, openAsTeam, setupRoutes, shortStore, publishFiche, trackWrites } = require("./helpers");

const ficheLink = publishFiche;

test("rien n’est envoyé en ligne pendant la saisie : la fiche part au moment de l’envoi", async ({ page }) => {
  const sent = trackWrites(page);
  await page.fill("#contactName", "Julien");
  await page.fill("#accessCode", "1234");
  await page.click("#tabMsg");
  await expect(page.locator("#ficheState")).toHaveText(/Rien n’est encore en ligne/);
  expect(await message(page)).toContain("🔗 Fiche complète (plan, accès, itinéraires) :\n(lien créé à l’envoi)");
  await expect(page.locator("#ficheOpen")).toHaveAttribute("href", /#fiche=/); // aperçu sans serveur
  await page.waitForTimeout(2000);
  expect(sent).toEqual([]);
  // Premier toucher : la fiche part en ligne, le message prend le lien court
  await page.click("#msgCopy");
  await expect(page.locator("#status")).toHaveText(/Touchez à nouveau « Copier le message »/);
  expect(sent).toEqual(["POST"]);
  const url = await page.getAttribute("#ficheOpen", "href");
  expect(url).toMatch(/#s=T[0-9a-f]{9}$/);
  expect(await message(page)).toContain("🔗 Fiche complète (plan, accès, itinéraires) :\n" + url);
  // Second toucher : copie, sans nouvel envoi
  await page.click("#msgCopy");
  await expect(page.locator("#status")).not.toHaveText(/Touchez à nouveau/);
  // Une modification ne part pas toute seule…
  await page.fill("#contactName", "Marie");
  await expect(page.locator("#ficheState")).toHaveText(/Modifications pas encore en ligne/);
  await expect(page.locator("#ficheSync")).toBeVisible();
  await page.waitForTimeout(2000);
  expect(sent).toEqual(["POST"]);
  // … mais au prochain envoi, ou avec « Mettre à jour la fiche en ligne »
  await page.click("#ficheSync");
  await expect(page.locator("#ficheState")).toHaveText(/Fiche en ligne à jour/);
  await expect(page.locator("#ficheSync")).toBeHidden();
  expect(sent).toEqual(["POST", "PUT"]);
});

test("le lien de fiche figure dans le message et ouvre la fiche en lecture seule", async ({ page, context }) => {
  await page.fill("#eventName", "Concert Test");
  await page.fill("#callDate", "2026-10-24");
  await page.fill("#callTime", "08:30");
  await page.fill("#contactName", "Julien");
  await page.fill("#contactPhone", "06 12 34 56 78");
  await page.fill("#poiLabel-loges", "Loges — porte B");
  await placePoint(page, "loges", 0.6, 0.6);
  const url = await ficheLink(page);
  expect(url.length).toBeLessThan(60);
  expect(await message(page)).toContain("🔗 Fiche complète (plan, accès, itinéraires) :\n" + url);

  // Un équipier ouvre le lien sur son propre téléphone (autre navigateur, rien d'enregistré)
  const team = await openAsTeam(context.browser(), url);
  await expect(team.locator("#ficheView")).toBeVisible();
  await expect(team.locator(".wrap > .grid")).toBeHidden();
  await expect(team.locator("#fTitle")).toHaveText("Concert Test");
  await expect(team.locator("#fPlace")).toHaveText("Espace Culturel du Bois-Des-Arts");
  await expect(team.locator("#fInfos")).toContainText("samedi 24 octobre à 8h30");
  await expect(team.locator('#fInfos a[href^="tel:"]')).toHaveAttribute("href", "tel:0612345678");
  await expect(team.locator("#fRoutes .froute")).toHaveCount(2);
  await expect(team.locator("#fRoutes .froute").nth(1)).toContainText("Loges — porte B");
  await expect(team.locator("#fRoutes a", { hasText: "Waze" }).first()).toHaveAttribute("href", /^https:\/\/waze\.com\/ul\?ll=46\.18/);
  await expect(team.locator("#fCal a").first()).toHaveAttribute("href", /calendar\.google\.com/);
  // Le bouton .ics pointe sur le fichier servi par le Worker (ouvre Calendrier, pas la fenêtre de partage)
  await expect(team.locator("#fCal a", { hasText: ".ics" })).toHaveAttribute("href", "https://api.easyroute.cloud/ics/" + url.split("#s=")[1]);
  await expect(team.locator("#fSheetSlot #sheet")).toBeVisible();
  // La fiche n'écrase pas la session de l'appareil
  expect(await team.evaluate(() => localStorage.getItem("easyroute.session"))).toBeNull();
  // Ouvrir dans l'éditeur (confirmation en deux touches)
  await team.click("#fEdit"); await team.click("#fEdit");
  await expect(team.locator("#ficheView")).toBeHidden();
  await expect(team.locator("#name")).toHaveValue("Espace Culturel du Bois-Des-Arts");
  await expect(team.locator("#contactName")).toHaveValue("Julien");
  await expect(team.locator("#poiLabel-loges")).toHaveValue("Loges — porte B");
  expect(await team.evaluate(() => location.hash)).toBe("");
  await team.close();
});

test("un lien de fiche abîmé affiche un message et l’éditeur normal", async ({ page }) => {
  await page.goto("/#fiche=1abc"); // même onglet : la page se recharge d'elle-même
  await expect(page.locator("#status")).toHaveText(/lien de fiche est incomplet/);
  await expect(page.locator("#ficheView")).toBeHidden();
});

test("on peut retirer le lien de fiche du message", async ({ page }) => {
  await ficheLink(page);
  await page.uncheck("#lkFiche");
  expect(await message(page)).not.toContain("Fiche complète");
});

test("case « Lien de la fiche » décochée : rien n’est envoyé en ligne", async ({ browser }) => {
  const ctx = await browser.newContext();
  await setupRoutes(ctx);
  await ctx.addInitScript(() => { try { localStorage.setItem("easyroute.ficheLink", "0"); } catch (_) {} });
  const sent = [];
  ctx.on("request", (req) => { if (/api\.easyroute\.cloud\/f/.test(req.url()) && req.method() !== "GET") sent.push(req.method()); });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.fill("#contactName", "Julien");
  await page.click("#tabMsg");
  await expect(page.locator("#ficheState")).toHaveText(/Rien n’est envoyé en ligne/);
  await expect(page.locator("#ficheOpen")).toHaveAttribute("href", /#fiche=/);
  // Même au moment de l'envoi
  await page.click("#msgCopy");
  await page.waitForTimeout(1000);
  expect(sent).toEqual([]);
  expect(await message(page)).not.toContain("api.easyroute.cloud/ics/");
  // Recocher la case : le lien court est créé au prochain envoi
  await page.check("#lkFiche");
  await expect(page.locator("#ficheState")).toHaveText(/Rien n’est encore en ligne/);
  expect(sent).toEqual([]);
  await page.click("#msgCopy");
  await expect(page.locator("#ficheOpen")).toHaveAttribute("href", /#s=T[0-9a-f]{9}$/);
  expect(sent).toEqual(["POST"]);
  await ctx.close();
});

test("lien court existant : il peut encore être mis à jour, « Nouveau lien » arrête l’envoi", async ({ page }) => {
  const url = await ficheLink(page);
  await page.uncheck("#lkFiche");
  await page.fill("#contactName", "Marie");
  await expect(page.locator("#ficheState")).toHaveText(/Modifications pas encore en ligne/);
  await page.click("#ficheSync");
  await expect(page.locator("#ficheState")).toHaveText(/existait déjà/);
  await expect(page.locator("#ficheOpen")).toHaveAttribute("href", url);
  const sent = trackWrites(page);
  await page.click("#ficheNew"); await page.click("#ficheNew");
  await expect(page.locator("#ficheState")).toHaveText(/Rien n’est envoyé en ligne/);
  await page.fill("#contactName", "Paul");
  await page.click("#msgCopy");
  await page.waitForTimeout(1000);
  expect(sent).toEqual([]);
});

test("« Supprimer la fiche en ligne » efface la fiche, et rien n’est renvoyé", async ({ page, context }) => {
  const url = await ficheLink(page), id = url.split("#s=")[1];
  expect(shortStore.has(id)).toBe(true);
  await expect(page.locator("#ficheDel")).toBeVisible();
  await page.click("#ficheDel"); await page.click("#ficheDel");
  await expect(page.locator("#status")).toHaveText(/Fiche en ligne supprimée/);
  expect(shortStore.has(id)).toBe(false);
  await expect(page.locator("#lkFiche")).not.toBeChecked();
  await expect(page.locator("#ficheDel")).toBeHidden();
  await expect(page.locator("#ficheOpen")).toHaveAttribute("href", /#fiche=/);
  // Plus aucun envoi ensuite, même en partageant
  const sent = trackWrites(page);
  await page.fill("#contactName", "Paul");
  await page.click("#msgCopy");
  await page.waitForTimeout(1000);
  expect(sent).toEqual([]);
  // L'équipe qui ouvre l'ancien lien voit qu'il a expiré
  const team = await openAsTeam(context.browser(), url);
  await expect(team.locator("#status")).toHaveText(/introuvable ou a expiré/);
  await team.context().close();
});

test("lien court inconnu ou expiré : message clair", async ({ page }) => {
  await page.goto("/#s=Tinconnu00");
  await expect(page.locator("#status")).toHaveText(/introuvable ou a expiré/);
  await expect(page.locator("#ficheView")).toBeHidden();
});

test.describe("service des liens courts injoignable", () => {
  test.use({ workerDown: true });
  test("le message garde le lien long, qui ouvre la fiche", async ({ page, context }) => {
    await page.fill("#contactName", "Julien");
    await page.click("#tabMsg");
    await page.click("#msgCopy");
    await expect(page.locator("#ficheState")).toHaveText(/injoignable/);
    await expect(page.locator("#status")).toHaveText(/Touchez à nouveau/);
    const url = await page.getAttribute("#ficheOpen", "href");
    expect(url).toMatch(/#fiche=1/);
    expect(await message(page)).toContain(url);
    const team = await openAsTeam(context.browser(), url);
    await expect(team.locator("#ficheView")).toBeVisible();
    await expect(team.locator("#fInfos")).toContainText("Julien");
    await team.context().close();
  });
});

const shortId = async (page) => (await publishFiche(page)).split("#s=")[1];

test("modifier la fiche garde le même lien, et l’équipe voit la nouvelle version", async ({ page, context }) => {
  await page.fill("#contactName", "Julien");
  const id = await shortId(page);
  const url = await page.getAttribute("#ficheOpen", "href");
  await page.fill("#contactName", "Marie");
  expect(await shortId(page)).toBe(id);
  const team = await openAsTeam(context.browser(), url);
  await expect(team.locator("#fInfos")).toContainText("Marie");
  await team.context().close();
  // La session garde le lien après réouverture
  await page.waitForTimeout(800);
  await page.reload();
  await page.click("#tabMsg");
  await expect(page.locator("#ficheState")).toHaveText(/Fiche en ligne à jour/); // la version en ligne est mémorisée
  await expect(page.locator("#ficheOpen")).toHaveAttribute("href", url);
  await expect(page.locator("#ficheNew")).toBeVisible();
});

test("« Nouveau lien » et « Nouveau lieu » donnent un autre lien", async ({ page }) => {
  const id1 = await shortId(page);
  await page.click("#ficheNew"); await page.click("#ficheNew");
  await expect(page.locator("#ficheOpen")).not.toHaveAttribute("href", new RegExp(id1));
  const id2 = await shortId(page);
  expect(id2).not.toBe(id1);
  await page.click("#venueNew"); await page.click("#venueNew");
  await page.fill("#addr", "1 rue du Test, 73000 Chambéry");
  await page.fill("#coords", "45.5666, 5.9212"); await page.locator("#coords").blur();
  const id3 = await shortId(page);
  expect(id3).not.toBe(id2);
});

test.describe("ancienne version du Worker (sans clé)", () => {
  test.use({ legacyWorker: true });
  test("chaque version de la fiche a son lien court, qui s’ouvre", async ({ page, context }) => {
    await page.fill("#contactName", "Julien");
    const id1 = await shortId(page);
    await page.fill("#contactName", "Marie");
    const url = await publishFiche(page);
    expect(url.split("#s=")[1]).not.toBe(id1);
    const team = await openAsTeam(context.browser(), url);
    await expect(team.locator("#fInfos")).toContainText("Marie");
    await team.context().close();
  });
});

test("fiche équipe : le plan s’ouvre en grand, avec zoom", async ({ page, context }) => {
  const url = await publishFiche(page);
  const team = await openAsTeam(context.browser(), url);
  await expect(team.locator("#ficheView")).toBeVisible();
  await expect(team.locator("#sheet")).toHaveCSS("touch-action", "manipulation"); // la page défile au-dessus du petit plan
  await team.locator("#sheet").click();
  await expect(team.locator("#planZoom")).toBeVisible();
  await expect(team.locator("#pzCanvas")).toBeVisible();
  const w0 = await team.locator("#pzCanvas").evaluate((c) => c.offsetWidth);
  await team.click("#pzIn");
  expect(await team.locator("#pzCanvas").evaluate((c) => c.offsetWidth)).toBeGreaterThan(w0 * 1.5);
  await expect(team.locator("#pzOut")).toBeEnabled();
  await team.keyboard.press("Escape");
  await expect(team.locator("#planZoom")).toBeHidden();
  await team.click("#fZoom");
  await expect(team.locator("#planZoom")).toBeVisible();
  await team.click("#pzClose");
  await expect(team.locator("#planZoom")).toBeHidden();
  await team.context().close();
});

test("la fiche ne montre que les liens d'itinéraire choisis pour le message", async ({ page, context }) => {
  await placePoint(page, "loges", 0.6, 0.6);
  await page.click("#tabMsg");
  // Lieu : aucun lien ; loges : Google Maps et GPS seulement
  for (const c of ["g", "w", "a"]) await page.locator(`#lk-main-${c}`).setChecked(false);
  await page.locator("#lk-loges-w").setChecked(false);
  await page.locator("#lk-loges-gps").setChecked(true);
  const url = await ficheLink(page);
  await expect(page.locator("#ficheState")).toHaveText(/Fiche en ligne à jour|Lien court prêt/);
  const msg = await message(page);
  expect(msg).not.toContain("Itinéraire :");
  expect(msg).not.toContain("waze.com");

  const team = await openAsTeam(context.browser(), url);
  await expect(team.locator("#fRoutes .froute")).toHaveCount(1);
  const row = team.locator("#fRoutes .froute");
  await expect(row).toContainText("Loges");
  await expect(row.locator("a")).toHaveText(["Google Maps"]);
  await expect(row.locator(".gps")).toContainText("GPS : 46.");
  await team.close();

  // Plus aucun lien : la rubrique Itinéraires disparaît de la fiche (même lien, mis à jour)
  const stored = () => page.evaluate((id) => fetch("https://api.easyroute.cloud/f/" + id).then((r) => r.text()), url.split("#s=")[1]);
  const before = await stored();
  for (const c of ["g", "gps"]) await page.locator(`#lk-loges-${c}`).setChecked(false);
  await publishFiche(page);
  await expect.poll(stored).not.toBe(before);
  const team2 = await openAsTeam(context.browser(), url);
  await expect(team2.locator("#ficheView")).toBeVisible();
  await expect(team2.locator("#fRoutes")).toBeHidden();
  await team2.close();
});

test.describe("fiche créée avec l'ancien Worker (sans .ics en ligne)", () => {
  test.use({ legacyWorker: true });
  test("le bouton .ics de la fiche télécharge le fichier", async ({ page, context }) => {
    await page.fill("#callDate", "2026-10-24");
    await page.fill("#callTime", "08:30");
    const url = await ficheLink(page);
    const team = await openAsTeam(context.browser(), url);
    const btn = team.locator("#fCal a", { hasText: ".ics" });
    await team.waitForTimeout(500);
    await expect(btn).toHaveAttribute("href", "#");
    const [download] = await Promise.all([team.waitForEvent("download"), btn.click()]);
    const ics = Buffer.concat(await (await download.createReadStream()).toArray()).toString();
    expect(ics).toContain("DTSTART:20261024T063000Z");
    await team.close();
  });
});
