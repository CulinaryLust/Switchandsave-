import { randomBytes, randomUUID } from "node:crypto";
import type { Fristen } from "@/domain/fristen";
import type { AbschlusskanalId, BestandsVertrag, Kostenaufstellung, Verbrauchsstelle } from "@/domain/types";
import type { Akteur, Modus, Status } from "@/domain/wechselfall";
import { getDb } from "./db";

export interface Kunde {
  id: string;
  token: string;
  anrede: string;
  vorname: string;
  nachname: string;
  email: string;
  telefon?: string;
  geburtsdatum: string;
  /** IBAN wird nur maskiert gespeichert und erst bei Übermittlung im Vollmachtsmodus benötigt. */
  ibanMaskiert?: string;
  iban?: string;
  modus: Modus;
  /** Dauerauftrag: Kundenfreigabe erfolgt automatisch, wenn die Ersparnis mindestens so hoch ist */
  autoFreigabeAbEur?: number;
  einwilligungen: { agb: string; datenschutz: string; vollmacht?: string; werbung?: string };
  erstelltAm: string;
}

export interface Vertrag {
  id: string;
  kundeId: string;
  aktiv: boolean;
  stelle: Verbrauchsstelle;
  bestand: BestandsVertrag;
  /** Gesetzt, wenn der Vertrag über uns abgeschlossen wurde */
  tarifId?: string;
  preiserhoehungZum?: string;
}

export interface Fall {
  id: string;
  vertragId: string;
  kundeId: string;
  modus: Modus;
  status: Status;
  tarifId: string;
  kanal: AbschlusskanalId;
  kosten: Kostenaufstellung;
  bestandskosten: number;
  ersparnisErstesJahr: number;
  fristen: Fristen;
  externeReferenz?: string;
  deeplink?: string;
  erstelltAm: string;
  aktualisiertAm: string;
}

export interface ProtokollEintrag {
  id: number;
  kundeId: string | null;
  fallId: string | null;
  typ: string;
  akteur: Akteur | "betreiber" | "system";
  data: Record<string, unknown>;
  zeitpunkt: string;
}

export interface Nachricht {
  id: number;
  kundeId: string;
  an: string;
  betreff: string;
  text: string;
  zeitpunkt: string;
}

const jetzt = () => new Date().toISOString();
type Row = Record<string, unknown>;

// Kunden

export function kundeAnlegen(daten: Omit<Kunde, "id" | "token" | "erstelltAm">): Kunde {
  const kunde: Kunde = { ...daten, id: randomUUID(), token: randomBytes(24).toString("base64url"), erstelltAm: jetzt() };
  getDb().prepare("INSERT INTO kunden (id, token, data, erstellt_am) VALUES (?, ?, ?, ?)").run(kunde.id, kunde.token, JSON.stringify(kunde), kunde.erstelltAm);
  return kunde;
}

export function kundeSpeichern(kunde: Kunde) {
  getDb().prepare("UPDATE kunden SET data = ? WHERE id = ?").run(JSON.stringify(kunde), kunde.id);
}

export function kundeById(id: string): Kunde | undefined {
  const r = getDb().prepare("SELECT data FROM kunden WHERE id = ?").get(id) as Row | undefined;
  return r ? (JSON.parse(r.data as string) as Kunde) : undefined;
}

export function kundeByToken(token: string): Kunde | undefined {
  const r = getDb().prepare("SELECT data FROM kunden WHERE token = ?").get(token) as Row | undefined;
  return r ? (JSON.parse(r.data as string) as Kunde) : undefined;
}

export function alleKunden(): Kunde[] {
  return (getDb().prepare("SELECT data FROM kunden ORDER BY erstellt_am DESC").all() as Row[]).map((r) => JSON.parse(r.data as string));
}

// Verträge

export function vertragAnlegen(daten: Omit<Vertrag, "id">): Vertrag {
  const v: Vertrag = { ...daten, id: randomUUID() };
  getDb().prepare("INSERT INTO vertraege (id, kunde_id, sparte, aktiv, data) VALUES (?, ?, ?, ?, ?)").run(v.id, v.kundeId, v.stelle.sparte, v.aktiv ? 1 : 0, JSON.stringify(v));
  return v;
}

export function vertragSpeichern(v: Vertrag) {
  getDb().prepare("UPDATE vertraege SET aktiv = ?, data = ? WHERE id = ?").run(v.aktiv ? 1 : 0, JSON.stringify(v), v.id);
}

export function vertragById(id: string): Vertrag | undefined {
  const r = getDb().prepare("SELECT data FROM vertraege WHERE id = ?").get(id) as Row | undefined;
  return r ? JSON.parse(r.data as string) : undefined;
}

export function vertraegeVonKunde(kundeId: string): Vertrag[] {
  return (getDb().prepare("SELECT data FROM vertraege WHERE kunde_id = ? ORDER BY aktiv DESC").all(kundeId) as Row[]).map((r) => JSON.parse(r.data as string));
}

export function aktiveVertraege(): Vertrag[] {
  return (getDb().prepare("SELECT data FROM vertraege WHERE aktiv = 1").all() as Row[]).map((r) => JSON.parse(r.data as string));
}

// Wechselfälle

export function fallAnlegen(daten: Omit<Fall, "id" | "erstelltAm" | "aktualisiertAm">): Fall {
  const f: Fall = { ...daten, id: randomUUID(), erstelltAm: jetzt(), aktualisiertAm: jetzt() };
  getDb()
    .prepare("INSERT INTO wechselfaelle (id, vertrag_id, kunde_id, modus, status, data, erstellt_am, aktualisiert_am) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(f.id, f.vertragId, f.kundeId, f.modus, f.status, JSON.stringify(f), f.erstelltAm, f.aktualisiertAm);
  return f;
}

export function fallSpeichern(f: Fall) {
  f.aktualisiertAm = jetzt();
  getDb().prepare("UPDATE wechselfaelle SET status = ?, data = ?, aktualisiert_am = ? WHERE id = ?").run(f.status, JSON.stringify(f), f.aktualisiertAm, f.id);
}

export function fallById(id: string): Fall | undefined {
  const r = getDb().prepare("SELECT data FROM wechselfaelle WHERE id = ?").get(id) as Row | undefined;
  return r ? JSON.parse(r.data as string) : undefined;
}

export function faelleNachStatus(status: Status[]): Fall[] {
  const platzhalter = status.map(() => "?").join(",");
  return (getDb().prepare(`SELECT data FROM wechselfaelle WHERE status IN (${platzhalter}) ORDER BY erstellt_am`).all(...status) as Row[]).map((r) => JSON.parse(r.data as string));
}

export function faelleVonKunde(kundeId: string): Fall[] {
  return (getDb().prepare("SELECT data FROM wechselfaelle WHERE kunde_id = ? ORDER BY erstellt_am DESC").all(kundeId) as Row[]).map((r) => JSON.parse(r.data as string));
}

export function alleFaelle(): Fall[] {
  return (getDb().prepare("SELECT data FROM wechselfaelle ORDER BY aktualisiert_am DESC").all() as Row[]).map((r) => JSON.parse(r.data as string));
}

// Vollmachten

export function vollmachtSpeichern(kundeId: string, version: string, text: string, nachweis: Record<string, unknown>) {
  getDb().prepare("INSERT INTO vollmachten (id, kunde_id, version, text, nachweis, erteilt_am) VALUES (?, ?, ?, ?, ?, ?)").run(randomUUID(), kundeId, version, text, JSON.stringify(nachweis), jetzt());
}

export function aktiveVollmacht(kundeId: string) {
  return getDb().prepare("SELECT * FROM vollmachten WHERE kunde_id = ? AND widerrufen_am IS NULL ORDER BY erteilt_am DESC").get(kundeId) as
    | { id: string; version: string; text: string; nachweis: string; erteilt_am: string }
    | undefined;
}

export function vollmachtWiderrufen(kundeId: string) {
  getDb().prepare("UPDATE vollmachten SET widerrufen_am = ? WHERE kunde_id = ? AND widerrufen_am IS NULL").run(jetzt(), kundeId);
}

// Protokoll und Postausgang

export function protokolliere(e: { kundeId?: string; fallId?: string; typ: string; akteur: string; data?: Record<string, unknown> }) {
  getDb().prepare("INSERT INTO protokoll (kunde_id, fall_id, typ, akteur, data, zeitpunkt) VALUES (?, ?, ?, ?, ?, ?)").run(e.kundeId ?? null, e.fallId ?? null, e.typ, e.akteur, JSON.stringify(e.data ?? {}), jetzt());
}

export function protokollVon(filter: { kundeId?: string; limit?: number } = {}): ProtokollEintrag[] {
  const rows = filter.kundeId
    ? getDb().prepare("SELECT * FROM protokoll WHERE kunde_id = ? ORDER BY id DESC LIMIT ?").all(filter.kundeId, filter.limit ?? 100)
    : getDb().prepare("SELECT * FROM protokoll ORDER BY id DESC LIMIT ?").all(filter.limit ?? 100);
  return (rows as Row[]).map((r) => ({
    id: r.id as number,
    kundeId: r.kunde_id as string | null,
    fallId: r.fall_id as string | null,
    typ: r.typ as string,
    akteur: r.akteur as Akteur,
    data: JSON.parse(r.data as string),
    zeitpunkt: r.zeitpunkt as string,
  }));
}

export function nachrichtSenden(kundeId: string, an: string, betreff: string, text: string) {
  // MVP: kein echter Versand. Ein E-Mail-Dienst (EU-Anbieter) wird hier angebunden.
  getDb().prepare("INSERT INTO postausgang (kunde_id, an, betreff, text, zeitpunkt) VALUES (?, ?, ?, ?, ?)").run(kundeId, an, betreff, text, jetzt());
}

export function postausgang(kundeId?: string, limit = 50): Nachricht[] {
  const rows = kundeId
    ? getDb().prepare("SELECT * FROM postausgang WHERE kunde_id = ? ORDER BY id DESC LIMIT ?").all(kundeId, limit)
    : getDb().prepare("SELECT * FROM postausgang ORDER BY id DESC LIMIT ?").all(limit);
  return (rows as Row[]).map((r) => ({ id: r.id as number, kundeId: r.kunde_id as string, an: r.an as string, betreff: r.betreff as string, text: r.text as string, zeitpunkt: r.zeitpunkt as string }));
}

// Einstellungen

export function einstellung(key: string): string | undefined {
  const r = getDb().prepare("SELECT value FROM einstellungen WHERE key = ?").get(key) as Row | undefined;
  return r?.value as string | undefined;
}

export function einstellungSetzen(key: string, value: string | null) {
  if (value === null) getDb().prepare("DELETE FROM einstellungen WHERE key = ?").run(key);
  else getDb().prepare("INSERT INTO einstellungen (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}
