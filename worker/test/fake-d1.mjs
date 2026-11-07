// Fausse base D1 pour les tests du Worker : une vraie base SQLite en mémoire (node:sqlite, Node 22.13+)
// derrière la même interface que D1 (prepare → bind → run / first / all).
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

export function fakeD1() {
  const raw = new DatabaseSync(":memory:");
  const norm = (v) => (v === undefined ? null : v); // SQLite n'accepte pas undefined
  return {
    raw, // accès direct pour préparer ou vérifier la base dans les tests
    prepare(sql) {
      let params = [];
      const statement = {
        bind(...p) { params = p.map(norm); return statement; },
        async run() { raw.prepare(sql).run(...params); return { success: true }; },
        async first() { return raw.prepare(sql).get(...params) ?? null; },
        async all() { return { results: raw.prepare(sql).all(...params) }; },
      };
      return statement;
    },
  };
}

// Charge une instance neuve du Worker (son état « table prête » repart de zéro à chaque appel)
const SOURCE = readFileSync(new URL("../easyroute-fiches.js", import.meta.url), "utf8");
let loads = 0;
export async function freshWorker() {
  const url = "data:text/javascript;charset=utf-8," + encodeURIComponent(SOURCE + "\n// instance " + ++loads);
  return (await import(url)).default;
}
