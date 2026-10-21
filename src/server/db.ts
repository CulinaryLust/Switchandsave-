// Persistenz über das in Node integrierte SQLite (node:sqlite, ab Node 22.13 ohne Flag).
// Fachdaten liegen als JSON in `data`, damit das Schema im MVP schlank bleibt. Für den Livebetrieb
// ist ein Wechsel auf PostgreSQL vorgesehen; nur diese Datei und repo.ts sind davon betroffen.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS kunden (
  id TEXT PRIMARY KEY, token TEXT UNIQUE NOT NULL, data TEXT NOT NULL, erstellt_am TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS vertraege (
  id TEXT PRIMARY KEY, kunde_id TEXT NOT NULL, sparte TEXT NOT NULL, aktiv INTEGER NOT NULL, data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS wechselfaelle (
  id TEXT PRIMARY KEY, vertrag_id TEXT NOT NULL, kunde_id TEXT NOT NULL, modus TEXT NOT NULL,
  status TEXT NOT NULL, data TEXT NOT NULL, erstellt_am TEXT NOT NULL, aktualisiert_am TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS vollmachten (
  id TEXT PRIMARY KEY, kunde_id TEXT NOT NULL, version TEXT NOT NULL, text TEXT NOT NULL,
  nachweis TEXT NOT NULL, erteilt_am TEXT NOT NULL, widerrufen_am TEXT
);
CREATE TABLE IF NOT EXISTS protokoll (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kunde_id TEXT, fall_id TEXT, typ TEXT NOT NULL,
  akteur TEXT NOT NULL, data TEXT NOT NULL, zeitpunkt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS postausgang (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kunde_id TEXT NOT NULL, an TEXT NOT NULL, betreff TEXT NOT NULL,
  text TEXT NOT NULL, zeitpunkt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS einstellungen (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

let db: DatabaseSync | undefined;

export function getDb(): DatabaseSync {
  if (!db) {
    const file = process.env.DB_PATH ?? path.join(process.cwd(), "data", "switchandsave.db");
    if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
    db = new DatabaseSync(file);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec(SCHEMA);
  }
  return db;
}

/** Für Tests: frische In-Memory-Datenbank. */
export function resetDbForTests() {
  db = new DatabaseSync(":memory:");
  db.exec(SCHEMA);
}

export function transaction<T>(fn: () => T): T {
  const d = getDb();
  d.exec("BEGIN");
  try {
    const result = fn();
    d.exec("COMMIT");
    return result;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}
