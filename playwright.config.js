// Tests automatiques d'Easy Route : `npm test` (après `npm install` et `npx playwright install chromium`).
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:4173",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    acceptDownloads: true,
    // Les requêtes d'un service worker échappent aux faux services des tests (page.route) : sw.js est
    // donc bloqué partout, sauf dans tests/horsligne.spec.js qui l'autorise exprès.
    serviceWorkers: "block",
  },
  // Le site est un fichier statique : un simple serveur HTTP suffit.
  webServer: {
    command: "python3 -m http.server 4173",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "ignore",
  },
  projects: [
    { name: "ordinateur", use: { ...devices["Desktop Chrome"], viewport: { width: 1300, height: 1100 } }, testIgnore: /telephone/ },
    { name: "telephone", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" }, testMatch: /telephone/ },
  ],
});
