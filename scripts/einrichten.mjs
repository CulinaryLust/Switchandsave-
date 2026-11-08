// Erzeugt fehlende Geheimnisse in .env.local und richtet den zweiten Faktor für den Betreiberbereich ein.
// Vorhandene Werte bleiben unverändert. Aufruf: npm run einrichten  (neuer TOTP-Code: npm run einrichten -- --neuer-code)
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import QRCode from "qrcode";

const DATEI = ".env.local";
const zeilen = existsSync(DATEI) ? readFileSync(DATEI, "utf8").split("\n") : [];
const werte = new Map(zeilen.filter((z) => /^[A-Z_]+=/.test(z)).map((z) => [z.slice(0, z.indexOf("=")), z.slice(z.indexOf("=") + 1)]));
const neu = [];

function setzen(name, wert, ueberschreiben = false) {
  if (werte.get(name) && !ueberschreiben) return false;
  werte.set(name, wert);
  neu.push(name);
  return true;
}

const base32 = (buf) => {
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, wert = 0, aus = "";
  for (const b of buf) {
    wert = (wert << 8) | b;
    bits += 8;
    while (bits >= 5) { aus += a[(wert >>> (bits - 5)) & 31]; bits -= 5; }
  }
  return bits > 0 ? aus + a[(wert << (5 - bits)) & 31] : aus;
};

const unsicher = ["", "bitte-aendern", "switchandsave"];
let passwortNeu;
if (unsicher.includes(werte.get("ADMIN_PASSWORD") ?? "")) {
  passwortNeu = randomBytes(12).toString("base64url");
  setzen("ADMIN_PASSWORD", passwortNeu, true);
}
setzen("ADMIN_USER", "admin");
setzen("SESSION_SECRET", randomBytes(32).toString("base64url"));
if (unsicher.includes(werte.get("CRON_SECRET") ?? "")) setzen("CRON_SECRET", randomBytes(24).toString("base64url"), true);
// Vorhandenen Entwicklungsschlüssel übernehmen, damit bereits gespeicherte IBANs lesbar bleiben.
const devKey = "data/entwicklungsschluessel";
setzen("DATA_KEY", existsSync(devKey) ? readFileSync(devKey, "utf8").trim() : randomBytes(32).toString("base64"));
const totpNeu = setzen("ADMIN_TOTP_SECRET", base32(randomBytes(20)), process.argv.includes("--neuer-code"));

const bekannt = new Set();
const aus = zeilen.map((z) => {
  const name = /^[A-Z_]+=/.test(z) ? z.slice(0, z.indexOf("=")) : null;
  if (!name) return z;
  bekannt.add(name);
  return `${name}=${werte.get(name)}`;
});
for (const [name, wert] of werte) if (!bekannt.has(name)) aus.push(`${name}=${wert}`);
writeFileSync(DATEI, aus.join("\n").replace(/\n*$/, "\n"), { mode: 0o600 });

console.log(neu.length ? `\n${DATEI} ergänzt: ${neu.join(", ")}` : `\n${DATEI} ist vollständig, nichts geändert.`);
if (passwortNeu) console.log(`\nNeues Admin-Passwort (bitte im Passwortmanager speichern):\n  Benutzer: ${werte.get("ADMIN_USER")}\n  Passwort: ${passwortNeu}`);
if (totpNeu) {
  const benutzer = werte.get("ADMIN_USER");
  const geheimnis = werte.get("ADMIN_TOTP_SECRET");
  const uri = `otpauth://totp/${encodeURIComponent(`Switchandsave:${benutzer}`)}?secret=${geheimnis}&issuer=Switchandsave&algorithm=SHA1&digits=6&period=30`;
  console.log("\nZweiter Faktor: QR-Code mit einer Authenticator-App scannen (z.B. Google Authenticator, 1Password, Authy):\n");
  console.log(await QRCode.toString(uri, { type: "terminal", small: true }));
  console.log(`Oder Schlüssel von Hand eingeben: ${geheimnis}`);
}
console.log("\nDanach den Server neu starten (npm run dev), damit die Werte gelten.\n");
