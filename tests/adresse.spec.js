const { test, expect } = require("./helpers");

const PHOTON = {
  features: [
    { geometry: { coordinates: [6.1335, 45.9031] }, properties: { name: "Le Brise Glace", housenumber: "54 bis", street: "Rue des Marquisats", postcode: "74000", city: "Annecy", country: "France", countrycode: "FR" } },
    { geometry: { coordinates: [6.1989, 46.1879] }, properties: { name: "Espace Culturel du Bois-Des-Arts", housenumber: "62", street: "Chemin du Bois-Des-Arts", postcode: "1226", city: "Thônex", country: "Suisse", countrycode: "CH" } },
  ],
};

test("taper un nom de salle propose des lieux ; en choisir un remplit l’adresse et la position", async ({ page }) => {
  await page.context().route(/photon\.komoot\.io/, (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify(PHOTON) }));
  await page.fill("#name", "");
  await page.locator("#name").pressSequentially("Brise gl");
  await expect(page.locator("#nameSuggest li[role=option]")).toHaveCount(2);
  await expect(page.locator("#nameSuggest li").first()).toContainText("54 bis Rue des Marquisats, 74000 Annecy");
  await expect(page.locator("#nameSuggest li").nth(1)).toContainText("Chemin du Bois-Des-Arts 62, 1226 Thônex, Suisse");
  await page.locator("#name").press("ArrowDown");
  await page.locator("#name").press("Enter");
  await expect(page.locator("#nameSuggest")).toBeHidden();
  await expect(page.locator("#name")).toHaveValue("Le Brise Glace");
  await expect(page.locator("#addr")).toHaveValue("54 bis Rue des Marquisats, 74000 Annecy");
  await expect(page.locator("#coords")).toHaveValue("45.9031000, 6.1335000");
});

test("un clic sur une proposition la choisit aussi", async ({ page }) => {
  await page.context().route(/photon\.komoot\.io/, (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify(PHOTON) }));
  await page.fill("#name", "");
  await page.locator("#name").pressSequentially("Bois des arts");
  await page.locator("#nameSuggest li[role=option]").nth(1).click();
  await expect(page.locator("#addr")).toHaveValue("Chemin du Bois-Des-Arts 62, 1226 Thônex, Suisse");
});

test("un lien Google Maps complet remplit le nom, l’adresse et la position", async ({ page }) => {
  await page.context().route(/nominatim\.openstreetmap\.org\/reverse/, (r) => r.fulfill({ contentType: "application/json",
    body: JSON.stringify({ address: { house_number: "54 bis", road: "Rue des Marquisats", postcode: "74000", city: "Annecy", country: "France", country_code: "fr" } }) }));
  await page.fill("#custom", "https://www.google.com/maps/place/Le+Brise+Glace/@45.9,6.13,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d45.9031!4d6.1335");
  await page.locator("#custom").blur();
  await expect(page.locator("#name")).toHaveValue("Le Brise Glace");
  await expect(page.locator("#addr")).toHaveValue("54 bis Rue des Marquisats, 74000 Annecy");
  await expect(page.locator("#coords")).toHaveValue("45.9031000, 6.1335000");
});

test("sans réseau, pas de liste et pas d’erreur", async ({ page }) => {
  await page.fill("#name", "");
  await page.locator("#name").pressSequentially("Brise glace");
  await page.waitForTimeout(800);
  await expect(page.locator("#nameSuggest")).toBeHidden();
});

test("un lieu absent de Photon (ajouté récemment à OSM) est proposé via Nominatim", async ({ page }) => {
  await page.context().route(/photon\.komoot\.io/, (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ features: [] }) }));
  await page.context().route(/nominatim\.openstreetmap\.org\/search/, (r) => r.fulfill({ contentType: "application/json",
    body: JSON.stringify([{ name: "Sixthemes", lat: "46.0681082", lon: "6.4166651",
      address: { house_number: "175", road: "Rue du Lac", postcode: "74130", town: "Bonneville", country: "France", country_code: "fr" } }]) }));
  await page.fill("#name", "");
  await page.locator("#name").pressSequentially("Sixthemes");
  await expect(page.locator("#nameSuggest li[role=option]")).toHaveCount(1);
  await page.locator("#nameSuggest li[role=option]").first().click();
  await expect(page.locator("#addr")).toHaveValue("175 Rue du Lac, 74130 Bonneville");
  await expect(page.locator("#coords")).toHaveValue("46.0681082, 6.4166651");
});

test("Photon propose des lieux approchants (Sixt…) : Nominatim est quand même consulté et le bon lieu passe en tête", async ({ page }) => {
  const approx = (name, city) => ({ type: "Feature", geometry: { type: "Point", coordinates: [6.2, 46.0] }, properties: { name, city, country: "France", countrycode: "FR" } });
  await page.context().route(/photon\.komoot\.io/, (r) => r.fulfill({ contentType: "application/json",
    body: JSON.stringify({ features: [approx("Sixt", "Annecy"), approx("Saint-Sixt", "Saint-Sixt"), approx("Le Sixties", "Morzine"), approx("Sixt-Fer-à-Cheval", "Sixt")] }) }));
  let nominatimCalls = 0;
  await page.context().route(/nominatim\.openstreetmap\.org\/search/, (r) => { nominatimCalls++; r.fulfill({ contentType: "application/json",
    body: JSON.stringify([{ name: "Sixthemes", lat: "46.0681082", lon: "6.4166651",
      address: { house_number: "175", road: "Rue du Lac", postcode: "74130", town: "Bonneville", country: "France", country_code: "fr" } }]) }); });
  await page.fill("#name", "");
  await page.locator("#name").pressSequentially("Sixthemes");
  const first = page.locator("#nameSuggest li[role=option]").first();
  await expect(first).toContainText("Sixthemes");
  await expect(page.locator("#nameSuggest li[role=option]")).toHaveCount(5);
  await first.click();
  await expect(page.locator("#addr")).toHaveValue("175 Rue du Lac, 74130 Bonneville");
  expect(nominatimCalls).toBeGreaterThan(0);
});

test("Photon trouve le lieu tapé : pas d'appel à Nominatim", async ({ page }) => {
  const f = (name) => ({ type: "Feature", geometry: { type: "Point", coordinates: [5.9, 45.6] }, properties: { name, city: "Chambéry", country: "France", countrycode: "FR" } });
  await page.context().route(/photon\.komoot\.io/, (r) => r.fulfill({ contentType: "application/json",
    body: JSON.stringify({ features: [f("Le Phare"), f("Le Phare Chambéry"), f("Phare de la Baie")] }) }));
  let nominatimCalls = 0;
  await page.context().route(/nominatim\.openstreetmap\.org\/search/, (r) => { nominatimCalls++; r.fulfill({ contentType: "application/json", body: "[]" }); });
  await page.fill("#name", "");
  await page.locator("#name").pressSequentially("Le Phare");
  await expect(page.locator("#nameSuggest li[role=option]")).toHaveCount(3);
  await page.waitForTimeout(500);
  expect(nominatimCalls).toBe(0);
});
