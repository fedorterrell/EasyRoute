const { test, expect, fixture, tapSheet, placePoint, message } = require("./helpers");

test("points utiles : placer, déplacer, retirer", async ({ page }) => {
  await placePoint(page, "dock", 0.3, 0.3);
  await placePoint(page, "loges", 0.6, 0.6);
  await expect(page.locator("#poiClear-dock")).toBeEnabled();
  await page.click("#poiClear-dock");
  await expect(page.locator("#poiPlace-dock")).toHaveText("Placer");
  await page.click("#tabMsg");
  const msg = await message(page);
  expect(msg).toContain("Loges :");
  expect(msg).not.toContain("Accès technique");
});

test("couleurs des points : choix, puis retour aux couleurs par défaut", async ({ page }) => {
  await expect(page.locator("#poiColor-loges")).toHaveValue("#f4b400");
  await expect(page.locator("#poiColorsReset")).toBeDisabled();
  await page.locator("#poiColor-dock").fill("#000000");
  await expect(page.locator("#poiColorsReset")).toBeEnabled();
  await page.click("#poiColorsReset");
  await expect(page.locator("#poiColor-dock")).toHaveValue("#1a73e8");
});

test("le repère rouge se déplace en le faisant glisser, et les liens suivent", async ({ page }) => {
  await page.click('#appSeg [data-v="waze"]');
  const before = await page.inputValue("#coords");
  await page.locator("#sheet").scrollIntoViewIfNeeded();
  const box = await page.locator("#sheet").boundingBox();
  const x = box.x + box.width / 2, headY = box.y + box.height / 2 - box.width * (9 * 0.64 / 297);
  await page.mouse.move(x, headY);
  await page.mouse.down();
  await page.mouse.move(x + 60, headY + 40, { steps: 6 });
  await page.mouse.up();
  const after = await page.inputValue("#coords");
  expect(after).not.toBe(before);
  const [lat, lng] = after.split(",").map((v) => (+v).toFixed(6));
  await expect(page.locator("#url")).toHaveText(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`);
});

test("« Déplacer le repère » puis un toucher place le lieu", async ({ page }) => {
  const before = await page.inputValue("#coords");
  await page.click("#movePin");
  await expect(page.locator("#movePin")).toHaveText("Touchez le plan…");
  await tapSheet(page, 0.3, 0.4);
  await expect(page.locator("#movePin")).toHaveText("Déplacer le repère");
  expect(await page.inputValue("#coords")).not.toBe(before);
});

test("le plan A4 se télécharge en JPG", async ({ page }) => {
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#sheetJpg")]);
  expect(download.suggestedFilename()).toMatch(/^plan-.+\.jpg$/);
});

test("le plan A4 se télécharge en PDF, avec la carte QR cliquable", async ({ page }) => {
  await page.fill("#eventName", "Concert Été");
  const qrUrl = await page.locator("#url").textContent();
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#sheetPdf")]);
  expect(download.suggestedFilename()).toMatch(/^plan-.+\.pdf$/);
  const pdf = Buffer.concat(await (await download.createReadStream()).toArray());
  const txt = pdf.toString("latin1");
  expect(txt.startsWith("%PDF-1.4\n")).toBe(true);
  expect(txt.trimEnd().endsWith("%%EOF")).toBe(true);
  expect(txt).toContain("/MediaBox [0 0 841.89 595.28]");
  expect(txt).toContain("/Width 3508 /Height 2480");
  // Table des objets : chaque position pointe bien sur « n 0 obj »
  const start = +txt.match(/startxref\n(\d+)\n%%EOF/)[1];
  expect(txt.slice(start, start + 4)).toBe("xref");
  const lines = txt.slice(start).split("\n"), count = +lines[1].split(" ")[1];
  for (let i = 1; i < count; i++) expect(txt.slice(+lines[2 + i].slice(0, 10)).startsWith(i + " 0 obj")).toBe(true);
  // Lien sur la carte QR, en haut à gauche (5 mm du bord = 14,17 pt), vers la même adresse que le QR
  const link = txt.match(/\/Rect \[([\d. ]+)\][^\n]*\/URI \(([^)]*)\)/);
  expect(link[2]).toBe(qrUrl);
  const [x1, , , y2] = link[1].split(" ").map(Number);
  expect(x1).toBeCloseTo(14.17, 1);
  expect(y2).toBeCloseTo(595.28 - 14.17, 1);
  // Titre du document (UTF-16 : « Concert Été — plan d’accès »)
  const hex = [..."Concert Été — plan d’accès"].map((c) => c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")).join("");
  expect(txt).toContain("/Title <FEFF" + hex + ">");
});

test("logo : sur le plan, et en option sur l’étiquette", async ({ page }) => {
  await page.click("#tabLabel");
  await expect(page.locator("#logoOnLabel")).toBeDisabled();
  await page.setInputFiles("#logoFile", fixture("logo-marges.png"));
  await expect(page.locator("#status")).toHaveText(/Logo ajouté/);
  const h0 = await page.locator("#out").evaluate((img) => img.naturalHeight);
  await page.click('#layout [data-v="stack"]');
  await page.check("#logoOnLabel");
  await expect.poll(() => page.locator("#out").evaluate((img) => img.naturalHeight)).toBeGreaterThan(h0);
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#dlSvg")]);
  const svg = await (await download.createReadStream()).toArray().then((b) => Buffer.concat(b).toString());
  expect(svg).toContain("<image ");
});

test("logo SVG accepté", async ({ page }) => {
  await page.setInputFiles("#logoFile", fixture("logo.svg"));
  await expect(page.locator("#status")).toHaveText(/Logo ajouté/);
  await expect(page.locator("#logoClear")).toBeEnabled();
});

test("police : Barlow par défaut", async ({ page }) => {
  await expect(page.locator("#fontState")).toHaveText("Police par défaut : Barlow.");
  await expect(page.locator("#fontReset")).toBeHidden();
});
