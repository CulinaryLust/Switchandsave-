// Verschlüsselung sensibler Felder (IBAN) mit AES-256-GCM. Der Schlüssel kommt aus DATA_KEY (32 Byte, base64).
// Ohne DATA_KEY wird im Entwicklungsbetrieb ein lokaler Schlüssel in data/ erzeugt; im Livebetrieb ist DATA_KEY Pflicht.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const VERSION = "v1";
let cache: Buffer | undefined;

function schluesselAusText(text: string, quelle: string): Buffer {
  const k = Buffer.from(text.trim(), "base64");
  if (k.length !== 32) throw new Error(`${quelle} muss 32 Byte (base64) lang sein. Mit "npm run einrichten" erzeugen.`);
  return k;
}

function schluessel(): Buffer {
  if (cache) return cache;
  const env = process.env.DATA_KEY;
  if (env) return (cache = schluesselAusText(env, "DATA_KEY"));
  if (process.env.NODE_ENV === "production") throw new Error("DATA_KEY fehlt. Im Livebetrieb ist ein Schlüssel für die IBAN-Verschlüsselung Pflicht.");
  const datei = path.join(path.dirname(process.env.DB_PATH ?? path.join(process.cwd(), "data", "switchandsave.db")), "entwicklungsschluessel");
  if (!existsSync(datei)) {
    mkdirSync(path.dirname(datei), { recursive: true });
    writeFileSync(datei, randomBytes(32).toString("base64"), { mode: 0o600 });
    console.warn(`[sicherheit] DATA_KEY fehlt, lokaler Entwicklungsschlüssel erzeugt: ${datei}`);
  }
  return (cache = schluesselAusText(readFileSync(datei, "utf8"), datei));
}

/** Nur für Tests: Schlüssel neu laden. */
export function schluesselZuruecksetzen() {
  cache = undefined;
}

export function verschluesseln(klartext: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", schluessel(), iv);
  const daten = Buffer.concat([c.update(klartext, "utf8"), c.final()]);
  return [VERSION, iv.toString("base64url"), c.getAuthTag().toString("base64url"), daten.toString("base64url")].join(":");
}

export function entschluesseln(geheim: string): string {
  const [version, iv, tag, daten] = geheim.split(":");
  if (version !== VERSION || !iv || !tag || daten === undefined) throw new Error("Unbekanntes Format verschlüsselter Daten.");
  const d = createDecipheriv("aes-256-gcm", schluessel(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(daten, "base64url")), d.final()]).toString("utf8");
}
