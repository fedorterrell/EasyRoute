const { test, expect, placePoint, message } = require("./helpers");

test("premiers pas : le guide s'affiche à la première visite et se coche au fil du travail", async ({ page }) => {
  const guide = page.locator("#guide");
  await expect(guide).toBeVisible();
  await expect(page.locator("#guideOpen")).toBeHidden();
  const step = (k) => guide.locator(`[data-step="${k}"]`);
  await expect(guide.locator(".done")).toHaveCount(0);

  // 1. Le lieu : nouvelle position
  await page.fill("#coords", "45.893094, 6.135404");
  await page.dispatchEvent("#coords", "change");
  await expect(step("place")).toHaveClass(/done/);
  // 2 et 3. Un point utile placé coche aussi la vérification du plan
  await placePoint(page, "dock", 0.6, 0.6);
  await expect(step("pin")).toHaveClass(/done/);
  await expect(step("pois")).toHaveClass(/done/);
  // 4. Envoi : Copier dans « Message équipe »
  await step("send").click();
  await expect(page.locator("#paneMsg")).toBeVisible();
  await page.click("#msgCopy"); // premier toucher : la fiche part en ligne
  await expect(page.locator("#status")).toHaveText(/Touchez à nouveau/);
  await page.click("#msgCopy");
  await expect(step("send")).toHaveClass(/done/);
  await expect(guide).toHaveClass(/complete/);
  await expect(page.locator("#guideLead")).toContainText("Bravo");

  // Fermé, il le reste ; « Premiers pas » le rouvre, étapes conservées
  await page.click("#guideClose");
  await expect(guide).toBeHidden();
  await page.reload();
  await expect(guide).toBeHidden();
  await page.click("#guideOpen");
  await expect(guide).toBeVisible();
  await expect(guide.locator(".done")).toHaveCount(4);
});

test("un utilisateur qui a déjà une session ne voit pas le guide, mais peut l'ouvrir", async ({ page }) => {
  // Appareil déjà utilisé avant l'arrivée du guide (posé avant le chargement de la page)
  await page.context().addInitScript(() => {
    if (sessionStorage.getItem("prepared")) return;
    sessionStorage.setItem("prepared", "1");
    localStorage.removeItem("easyroute.guide");
    localStorage.setItem("easyroute.session", JSON.stringify({ v: 1, fields: { name: "Salle déjà connue" } }));
  });
  await page.reload();
  await expect(page.locator("#name")).toHaveValue("Salle déjà connue");
  await expect(page.locator("#guide")).toBeHidden();
  await page.click("#guideOpen");
  await expect(page.locator("#guide")).toBeVisible();
});

test("« Voir un exemple » charge une fiche complète, avec confirmation si du travail est en cours", async ({ page }) => {
  // Exemple de départ intact : chargement direct
  await page.click("#guideDemo");
  await expect(page.locator("#eventName")).toHaveValue(/Exemple/);
  await expect(page.locator("#poiPlace-dock")).toHaveText("Déplacer");
  await expect(page.locator("#poiPlace-parking")).toHaveText("Déplacer");
  await expect(page.locator("#poiPlace-loges")).not.toHaveText("Déplacer");
  await expect(page.locator("#poiLabel-dock")).toHaveValue("Quai de déchargement");
  await page.click("#tabMsg");
  const msg = await message(page);
  expect(msg).toContain("Quai de déchargement");
  expect(msg).toContain("Camille (régie)");
  // Les étapes du guide ne sont pas cochées par l'exemple
  await expect(page.locator("#guide .done")).toHaveCount(0);

  // Travail en cours : il faut confirmer
  await page.fill("#eventName", "Mon concert");
  await page.click("#guideDemo");
  await expect(page.locator("#guideDemo")).toHaveText("Remplacer mon travail en cours ?");
  await expect(page.locator("#eventName")).toHaveValue("Mon concert");
  await page.click("#guideDemo");
  await expect(page.locator("#eventName")).toHaveValue(/Exemple/);
  await expect(page.locator("#guideDemo")).toHaveText("Voir un exemple");
});

test("la fiche équipe n'affiche pas le guide", async ({ page, context }) => {
  const { openAsTeam, publishFiche } = require("./helpers");
  const url = await publishFiche(page);
  const team = await openAsTeam(context.browser(), url);
  await expect(team.locator("#ficheView")).toBeVisible();
  await expect(team.locator("#guide")).toBeHidden();
  await expect(team.locator("#guideOpen")).toBeHidden();
  await team.close();
});
