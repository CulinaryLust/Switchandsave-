// Betreiber-Anmeldung: Passwort plus zweiter Faktor (TOTP). Mit einfacher Sperre gegen Durchprobieren.
import { createHash, timingSafeEqual } from "node:crypto";
import { totpPruefen } from "./totp";

const FENSTER_MS = 15 * 60 * 1000;
const MAX_VERSUCHE = 5;
const versuche = new Map<string, { anzahl: number; seit: number }>();

export interface AnmeldeKonfiguration {
  benutzer: string;
  passwort: string;
  totpGeheimnis?: string;
  /** Im Entwicklungsbetrieb ohne TOTP-Geheimnis ist der zweite Faktor aus (mit Warnhinweis). */
  zweiterFaktorAktiv: boolean;
  fehler?: string;
}

export function anmeldeKonfiguration(): AnmeldeKonfiguration {
  const prod = process.env.NODE_ENV === "production";
  const benutzer = process.env.ADMIN_USER ?? "admin";
  const passwort = process.env.ADMIN_PASSWORD ?? (prod ? "" : "switchandsave");
  const totpGeheimnis = process.env.ADMIN_TOTP_SECRET || undefined;
  let fehler: string | undefined;
  if (prod && (!passwort || passwort === "switchandsave" || passwort === "bitte-aendern")) fehler = "ADMIN_PASSWORD ist nicht gesetzt oder unsicher.";
  if (prod && !totpGeheimnis) fehler = "ADMIN_TOTP_SECRET fehlt. Im Livebetrieb ist der zweite Faktor Pflicht.";
  return { benutzer, passwort, totpGeheimnis, zweiterFaktorAktiv: !!totpGeheimnis, fehler };
}

const hash = (s: string) => createHash("sha256").update(s).digest();

export type AnmeldeErgebnis = { ok: true; benutzer: string } | { ok: false; fehler: string };

export function anmelden(eingabe: { benutzer: string; passwort: string; code: string; schluessel: string }, jetzt = Date.now()): AnmeldeErgebnis {
  const k = anmeldeKonfiguration();
  if (k.fehler) return { ok: false, fehler: `Anmeldung gesperrt: ${k.fehler}` };

  const v = versuche.get(eingabe.schluessel);
  if (v && jetzt - v.seit < FENSTER_MS && v.anzahl >= MAX_VERSUCHE) return { ok: false, fehler: "Zu viele Fehlversuche. Bitte 15 Minuten warten." };

  const benutzerOk = timingSafeEqual(hash(eingabe.benutzer), hash(k.benutzer));
  const passwortOk = timingSafeEqual(hash(eingabe.passwort), hash(k.passwort));
  const codeOk = !k.totpGeheimnis || totpPruefen(k.totpGeheimnis, eingabe.code, jetzt);
  if (benutzerOk && passwortOk && codeOk) {
    versuche.delete(eingabe.schluessel);
    return { ok: true, benutzer: k.benutzer };
  }
  const neu = v && jetzt - v.seit < FENSTER_MS ? { anzahl: v.anzahl + 1, seit: v.seit } : { anzahl: 1, seit: jetzt };
  versuche.set(eingabe.schluessel, neu);
  return { ok: false, fehler: "Benutzer, Passwort oder Code falsch." };
}

/** Nur für Tests. */
export function sperrenZuruecksetzen() {
  versuche.clear();
}
