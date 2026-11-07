const { test, expect, placePoint, message, openAsTeam, publishFiche } = require("./helpers");

async function fillInfos(page) {
  await page.fill("#eventName", "Concert Test");
  await page.fill("#callDate", "2026-10-24");
  await page.fill("#callTime", "08:30");
  await page.fill("#contactName", "Julien");
  await page.fill("#contactPhone", "06 12 34 56 78");
  await page.fill("#accessCode", "1234A, portail; nord");
}

test("infos pratiques et événement dans le message et l’objet de l’e-mail", async ({ page }) => {
  await fillInfos(page);
  await page.click("#tabMsg");
  const msg = await message(page);
  expect(msg.split("\n")[0]).toBe("🎫 Concert Test");
  expect(msg).toContain("🕒 Get-In : samedi 24 octobre à 8h30");
  expect(msg).toContain("👤 Contact sur place : Julien — 06 12 34 56 78");
  const href = await page.getAttribute("#msgMail", "href");
  expect(decodeURIComponent(href.split("subject=")[1].split("&")[0]))
    .toBe("Concert Test — Espace Culturel du Bois-Des-Arts — samedi 24 octobre à 8h30");
});

test("liens d’itinéraire choisis point par point", async ({ page }) => {
  await placePoint(page, "dock", 0.3, 0.3);
  await page.click("#tabMsg");
  let msg = await message(page);
  expect(msg).toContain("🚚 Accès technique / déchargement :");
  await page.uncheck("#lk-main-a");
  await page.uncheck("#lk-dock-g");
  await page.uncheck("#lk-dock-w");
  msg = await message(page);
  expect(msg).not.toContain("Plans (Apple)");
  expect(msg).not.toContain("🚚");
  expect(msg).toContain("Google Maps :\nhttps://www.google.com/maps/search/?api=1&query=46.18");
});

test("agenda : lien Google Agenda et fichier .ics à l’heure de Paris", async ({ page }) => {
  await page.click("#tabMsg");
  await expect(page.locator("#msgIcs")).toBeDisabled();
  await fillInfos(page);
  await page.selectOption("#callDur", "6");
  const msg = await message(page);
  expect(msg).toContain("📅 Ajouter à Google Agenda :");
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#msgIcs")]);
  const ics = Buffer.concat(await (await download.createReadStream()).toArray()).toString();
  expect(ics).toContain("DTSTART:20261024T063000Z");
  expect(ics).toContain("DTEND:20261024T123000Z");
  expect(ics).toContain("SUMMARY:Get-In — Concert Test");
  expect(ics).toContain("TRIGGER:-PT1H");
  for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  // Durée de 10 h
  await page.selectOption("#callDur", "10");
  const [d10] = await Promise.all([page.waitForEvent("download"), page.click("#msgIcs")]);
  expect(Buffer.concat(await (await d10.createReadStream()).toArray()).toString()).toContain("DTEND:20261024T163000Z");
  // Sans heure : journée entière
  await page.fill("#callTime", "");
  await page.dispatchEvent("#callTime", "change");
  await expect(page.locator("#calHint")).toContainText("journée entière");
  await page.uncheck("#lkCal");
  expect(await message(page)).not.toContain("Google Agenda");
});

test("le bouton WhatsApp transmet le message avec ses emojis, encodés en UTF-8", async ({ page }) => {
  await page.fill("#eventName", "Concert Test");
  await page.click("#tabMsg");
  const href = await page.getAttribute("#msgWa", "href");
  expect(href.startsWith("https://api.whatsapp.com/send?text=")).toBe(true);
  expect(decodeURIComponent(href.split("text=")[1])).toBe(await message(page));
  expect(href).toContain("%F0%9F%8E%AB"); // 🎫 encodé sur 4 octets
});

test("le lien agenda du message est court et redirige vers Google Agenda", async ({ page, context }) => {
  await fillInfos(page);
  await page.selectOption("#callDur", "6");
  await page.click("#tabMsg");
  // Avant l'envoi : lien Google Agenda complet (rien n'est encore en ligne)
  expect(await message(page)).toContain("https://calendar.google.com/calendar/render?action=TEMPLATE");
  const id = (await publishFiche(page)).split("#s=")[1];
  await expect.poll(() => message(page)).toContain("📅 Ajouter à Google Agenda :\nhttp://localhost:4173/#a=" + id);
  // L'équipier ouvre le lien agenda : Easy Route le renvoie vers Google Agenda, événement pré-rempli
  const ctx = await context.browser().newContext();
  const { setupRoutes } = require("./helpers");
  await setupRoutes(ctx);
  await ctx.route(/calendar\.google\.com/, (r) => r.fulfill({ contentType: "text/html", body: "<p>Google Agenda</p>" }));
  const team = await ctx.newPage();
  await team.goto("/#a=" + id);
  await team.waitForURL(/calendar\.google\.com/);
  const u = new URL(team.url());
  expect(u.searchParams.get("dates")).toBe("20261024T063000Z/20261024T123000Z");
  expect(u.searchParams.get("text")).toBe("Get-In — Concert Test");
  await ctx.close();
});

test.describe("service des liens courts injoignable", () => {
  test.use({ workerDown: true });
  test("le message garde le lien Google Agenda complet", async ({ page }) => {
    await fillInfos(page);
    await page.click("#tabMsg");
    await page.click("#msgCopy");
    await expect(page.locator("#ficheState")).toHaveText(/injoignable/);
    expect(await message(page)).toContain("https://calendar.google.com/calendar/render?action=TEMPLATE");
  });
});

test("le message contient aussi un lien .ics court, qui suit les modifications", async ({ page }) => {
  await fillInfos(page);
  const id = (await publishFiche(page)).split("#s=")[1];
  const icsUrl = `https://api.easyroute.cloud/ics/${id}`;
  await expect.poll(() => message(page)).toContain("📆 Ajouter au calendrier (iPhone, Mac, Outlook) :\n" + icsUrl);
  const get = () => page.evaluate((u) => fetch(u).then((r) => r.text()), icsUrl);
  let ics = await get();
  expect(ics).toContain("DTSTART:20261024T063000Z");
  expect(ics).toContain(`UID:${id}@easyroute`);
  expect(ics).toContain(`#s=${id}`); // la description renvoie vers la fiche courte
  // Changement d'heure après l'envoi : le même lien .ics donne la nouvelle heure
  await page.fill("#callTime", "10:00");
  await page.dispatchEvent("#callTime", "change");
  await expect(page.locator("#ficheState")).toHaveText(/Modifications pas encore en ligne/);
  await page.click("#ficheSync");
  await expect(page.locator("#ficheState")).toHaveText(/Fiche en ligne à jour/);
  await expect.poll(get).toContain("DTSTART:20261024T080000Z");
  // La case « liens agenda » retire les deux liens
  await page.uncheck("#lkCal");
  const msg = await message(page);
  expect(msg).not.toContain("/ics/");
  expect(msg).not.toContain("Google Agenda");
});

test.describe("ancienne version du Worker (sans .ics)", () => {
  test.use({ legacyWorker: true });
  test("pas de lien .ics dans le message", async ({ page }) => {
    await fillInfos(page);
    await publishFiche(page);
    await page.waitForTimeout(500);
    expect(await message(page)).not.toContain("/ics/");
  });
});
