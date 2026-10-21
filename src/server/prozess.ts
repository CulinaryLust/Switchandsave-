// Geschäftsprozesse: Auftrag, Freigaben, Übermittlung und der tägliche Lauf, der den jährlichen
// Wechsel ohne manuelles Zutun vorbereitet. Einziger manueller Schritt: Freigabe durch den Betreiber.
import { addMonths, diffDays, formatDe, todayIso } from "@/domain/dates";
import { TARIFE, VERSORGER } from "@/domain/demoData";
import { berechneFristen, bonusFaelligkeit } from "@/domain/fristen";
import { berechneBestandskosten, berechneKosten } from "@/domain/kosten";
import { netzgebietById } from "@/domain/netzgebiet";
import type { BestandsVertrag, Empfehlung, Verbrauchsstelle } from "@/domain/types";
import { vergleiche } from "@/domain/vergleich";
import { naechsterStatus, OFFENE_STATUS, type Akteur, type Ereignis, type Modus } from "@/domain/wechselfall";
import { abschlusskanal, check24Deeplink } from "./kanaele";
import * as repo from "./repo";
import type { Fall, Kunde, Vertrag } from "./repo";
import { VOLLMACHT_VERSION, vollmachtText } from "./rechtstexte";

/** Unterhalb dieser Ersparnis wird kein Wechsel vorgeschlagen (Aufwand und Risiko für den Kunden). */
export const MIN_ERSPARNIS_EUR = 30;
/** Ohne lohnenden Tarif wird nach so vielen Tagen erneut verglichen. */
export const PRUEF_INTERVALL_TAGE = 30;

export function heute(): string {
  return repo.einstellung("simuliertes_datum") ?? todayIso();
}

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";
const kontoLink = (k: Kunde) => `${appUrl()}/konto/${k.token}`;
const tarifById = (id: string) => TARIFE.find((t) => t.id === id)!;
const versorgerName = (id: string) => VERSORGER.find((v) => v.id === id)!.name;
const eur = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

export class Prozessfehler extends Error {}

function uebergang(fall: Fall, ereignis: Ereignis, akteur: Akteur, data: Record<string, unknown> = {}) {
  const von = fall.status;
  fall.status = naechsterStatus(fall.modus, fall.status, ereignis, akteur);
  repo.fallSpeichern(fall);
  repo.protokolliere({ kundeId: fall.kundeId, fallId: fall.id, typ: `fall.${ereignis}`, akteur, data: { von, nach: fall.status, ...data } });
}

function bestandskosten(v: Vertrag) {
  return berechneBestandskosten(v.bestand, v.stelle.jahresverbrauchKwh);
}

function fristenFuer(v: Vertrag, stichtag: string) {
  return berechneFristen(
    {
      lieferbeginn: v.bestand.lieferbeginn,
      erstlaufzeitMonate: v.bestand.erstlaufzeitMonate,
      kuendigungsfristWochen: v.bestand.kuendigungsfristWochen,
      istGrundversorgung: v.bestand.istGrundversorgung,
      bonusFaelligAm: v.bestand.bonusFaelligAm,
      preiserhoehungZum: v.preiserhoehungZum,
    },
    stichtag,
  );
}

/** Beste Empfehlung, die im Modus des Kunden abschließbar ist. */
export function besteEmpfehlung(v: Vertrag, modus: Modus): Empfehlung | undefined {
  const netz = netzgebietById(v.stelle.netzgebietId);
  if (!netz) return undefined;
  const kanal = modus === "vollmacht" ? "procheck24" : "check24_affiliate";
  // Tarife, bei denen der Versorger diesen Kunden bereits abgelehnt hat, nicht erneut vorschlagen.
  const abgelehnt = new Set(repo.faelleVonKunde(v.kundeId).filter((f) => f.vertragId === v.id && f.status === "abgelehnt_versorger").map((f) => f.tarifId));
  return vergleiche(netz, v.stelle.jahresverbrauchKwh, bestandskosten(v)).empfehlungen.find((e) => e.tarif.kanaele.includes(kanal) && !abgelehnt.has(e.tarif.id));
}

function fallAusEmpfehlung(kunde: Kunde, v: Vertrag, e: Empfehlung, stichtag: string): Fall {
  const fall = repo.fallAnlegen({
    vertragId: v.id,
    kundeId: kunde.id,
    modus: kunde.modus,
    status: "vorgeschlagen",
    tarifId: e.tarif.id,
    kanal: kunde.modus === "vollmacht" ? "procheck24" : "check24_affiliate",
    kosten: e.kosten,
    bestandskosten: bestandskosten(v),
    ersparnisErstesJahr: e.ersparnisErstesJahr,
    fristen: fristenFuer(v, stichtag),
    deeplink: kunde.modus === "erinnerung" ? check24Deeplink(v.stelle) : undefined,
  });
  repo.protokolliere({ kundeId: kunde.id, fallId: fall.id, typ: "fall.vorgeschlagen", akteur: "system", data: { tarif: e.tarif.id, ersparnis: e.ersparnisErstesJahr } });
  return fall;
}

// Auftrag

export interface AuftragEingabe {
  kunde: Omit<Kunde, "id" | "token" | "erstelltAm">;
  stelle: Verbrauchsstelle;
  bestand: BestandsVertrag;
  tarifId: string;
  nachweis: { ipHash: string; userAgent: string };
}

export function auftragErteilen(e: AuftragEingabe): { kunde: Kunde; fall: Fall } {
  const tarif = TARIFE.find((t) => t.id === e.tarifId);
  const netz = netzgebietById(e.stelle.netzgebietId);
  if (!tarif || !netz || tarif.sparte !== e.stelle.sparte) throw new Prozessfehler("Tarif ist für diese Verbrauchsstelle nicht verfügbar.");
  const kanal = e.kunde.modus === "vollmacht" ? "procheck24" : "check24_affiliate";
  if (!tarif.kanaele.includes(kanal)) throw new Prozessfehler("Tarif ist in diesem Modus nicht abschließbar.");

  const kunde = repo.kundeAnlegen(e.kunde);
  const vertrag = repo.vertragAnlegen({ kundeId: kunde.id, aktiv: true, stelle: e.stelle, bestand: e.bestand });
  repo.protokolliere({ kundeId: kunde.id, typ: "kunde.angelegt", akteur: "kunde", data: { modus: kunde.modus, nachweis: e.nachweis } });

  if (kunde.modus === "vollmacht") {
    repo.vollmachtSpeichern(kunde.id, VOLLMACHT_VERSION, vollmachtText(kunde), { ...e.nachweis, zeitpunkt: new Date().toISOString() });
    repo.protokolliere({ kundeId: kunde.id, typ: "vollmacht.erteilt", akteur: "kunde", data: { version: VOLLMACHT_VERSION } });
  }

  const kosten = berechneKosten(tarif, netz, e.stelle.jahresverbrauchKwh);
  const bk = bestandskosten(vertrag);
  const fall = fallAusEmpfehlung(kunde, vertrag, {
    tarif,
    versorger: VERSORGER.find((v) => v.id === tarif.versorgerId)!,
    kosten,
    ersparnisErstesJahr: Math.round((bk - kosten.jahreskostenErstesJahr) * 100) / 100,
    ersparnisOhneBonus: Math.round((bk - kosten.jahreskostenOhneBonus) * 100) / 100,
  }, heute());

  // Der Auftrag selbst ist die Kundenfreigabe für den ersten Wechsel.
  if (kunde.modus === "vollmacht") uebergang(fall, "kunde_freigeben", "kunde", { quelle: "auftrag" });

  repo.nachrichtSenden(
    kunde.id,
    kunde.email,
    "Willkommen bei Switchandsave",
    `Hallo ${kunde.vorname},\n\nIhr Auftrag ist eingegangen. ${
      kunde.modus === "vollmacht"
        ? `Wir prüfen den Wechsel zu „${tarif.name}“ und übermitteln ihn rechtzeitig zum ${formatDe(fall.fristen.neuerLieferbeginn)}.`
        : `Schließen Sie den neuen Tarif bequem über unseren Partnerlink ab: ${fall.deeplink}`
    }\n\nIhr Kundenkonto: ${kontoLink(kunde)}\n\nSie können Ihren Vertrag binnen 14 Tagen widerrufen.`,
  );
  return { kunde, fall };
}

// Freigaben

function fallFuerKunde(token: string, fallId: string): { kunde: Kunde; fall: Fall } {
  const kunde = repo.kundeByToken(token);
  const fall = repo.fallById(fallId);
  if (!kunde || !fall || fall.kundeId !== kunde.id) throw new Prozessfehler("Wechselfall nicht gefunden.");
  return { kunde, fall };
}

export function kundeFreigeben(token: string, fallId: string) {
  const { fall } = fallFuerKunde(token, fallId);
  uebergang(fall, "kunde_freigeben", "kunde");
}

export function kundeAblehnen(token: string, fallId: string) {
  const { fall } = fallFuerKunde(token, fallId);
  uebergang(fall, "kunde_ablehnen", "kunde");
}

export async function betreiberFreigeben(fallId: string, betreiber: string) {
  const fall = repo.fallById(fallId);
  if (!fall) throw new Prozessfehler("Wechselfall nicht gefunden.");
  const kunde = repo.kundeById(fall.kundeId)!;
  if (!repo.aktiveVollmacht(kunde.id)) throw new Prozessfehler("Keine aktive Vollmacht vorhanden.");
  uebergang(fall, "betreiber_freigeben", "betreiber", { betreiber });
  await versucheUebermittlung(fall, heute());
}

export function betreiberAblehnen(fallId: string, betreiber: string, grund: string) {
  const fall = repo.fallById(fallId);
  if (!fall) throw new Prozessfehler("Wechselfall nicht gefunden.");
  uebergang(fall, "betreiber_ablehnen", "betreiber", { betreiber, grund });
  const kunde = repo.kundeById(fall.kundeId)!;
  repo.nachrichtSenden(kunde.id, kunde.email, "Ihr Wechsel wurde angehalten", `Hallo ${kunde.vorname},\n\nwir haben den vorgeschlagenen Wechsel nicht ausgeführt. Grund: ${grund}\n\nIhr Kundenkonto: ${kontoLink(kunde)}`);
}

/** Übermittelt erst, wenn der Lieferbeginn im zulässigen Vorlauf des Kanals liegt. */
async function versucheUebermittlung(fall: Fall, stichtag: string) {
  const kanal = abschlusskanal();
  if (fall.fristen.neuerLieferbeginn > addMonths(stichtag, kanal.maxVorlaufMonate)) {
    repo.protokolliere({ kundeId: fall.kundeId, fallId: fall.id, typ: "fall.uebermittlung_terminiert", akteur: "system", data: { lieferbeginn: fall.fristen.neuerLieferbeginn } });
    return;
  }
  const kunde = repo.kundeById(fall.kundeId)!;
  const vertrag = repo.vertragById(fall.vertragId)!;
  try {
    const { externeReferenz } = await kanal.uebermitteln({
      kunde,
      stelle: vertrag.stelle,
      tarif: tarifById(fall.tarifId),
      wunschLieferbeginn: fall.fristen.neuerLieferbeginn,
      altversorger: vertrag.bestand.versorgerName,
      kuendigungDurchNeuversorger: true,
    });
    fall.externeReferenz = externeReferenz;
    uebergang(fall, "uebermitteln", "system", { kanal: kanal.id, externeReferenz, simuliert: kanal.simuliert });
  } catch (err) {
    // Fall bleibt "betreiber_freigegeben"; der Tageslauf versucht es erneut.
    repo.protokolliere({ kundeId: fall.kundeId, fallId: fall.id, typ: "fall.uebermittlung_fehlgeschlagen", akteur: "system", data: { fehler: String(err) } });
  }
}

// Kundenaktionen

export interface SelbstAbschluss {
  versorgerName: string;
  tarifName: string;
  arbeitspreisCtBrutto: number;
  grundpreisEurMonatBrutto: number;
  lieferbeginn: string;
  erstlaufzeitMonate: number;
  kuendigungsfristWochen: number;
  bonusFaelligAm?: string;
}

/** Erinnerungsmodus: Kunde meldet den selbst abgeschlossenen Vertrag, damit der nächste Zyklus stimmt. */
export function kundeSelbstAbgeschlossen(token: string, fallId: string, neu: SelbstAbschluss) {
  const { fall } = fallFuerKunde(token, fallId);
  fall.fristen = { ...fall.fristen, neuerLieferbeginn: neu.lieferbeginn };
  (fall as Fall & { selbstAbschluss?: SelbstAbschluss }).selbstAbschluss = neu;
  uebergang(fall, "kunde_selbst_abgeschlossen", "kunde", { versorger: neu.versorgerName, tarif: neu.tarifName });
}

export function preiserhoehungMelden(token: string, vertragId: string, p: { arbeitspreisCtBrutto: number; grundpreisEurMonatBrutto: number; wirksamAb: string }) {
  const kunde = repo.kundeByToken(token);
  const v = repo.vertragById(vertragId);
  if (!kunde || !v || v.kundeId !== kunde.id) throw new Prozessfehler("Vertrag nicht gefunden.");
  v.bestand = { ...v.bestand, arbeitspreisCtBrutto: p.arbeitspreisCtBrutto, grundpreisEurMonatBrutto: p.grundpreisEurMonatBrutto };
  v.preiserhoehungZum = p.wirksamAb;
  delete (v as Vertrag & { letztePruefung?: string }).letztePruefung;
  repo.vertragSpeichern(v);
  repo.protokolliere({ kundeId: kunde.id, typ: "vertrag.preiserhoehung", akteur: "kunde", data: p });
  return pruefeVertrag(v, heute());
}

export function vollmachtWiderrufen(token: string) {
  const kunde = repo.kundeByToken(token);
  if (!kunde) throw new Prozessfehler("Kunde nicht gefunden.");
  repo.vollmachtWiderrufen(kunde.id);
  kunde.modus = "erinnerung";
  kunde.autoFreigabeAbEur = undefined;
  repo.kundeSpeichern(kunde);
  for (const f of repo.faelleVonKunde(kunde.id)) {
    if (f.modus === "vollmacht" && (f.status === "vorgeschlagen" || f.status === "kunde_freigegeben")) uebergang(f, "kunde_ablehnen", "kunde", { grund: "Vollmacht widerrufen" });
  }
  repo.protokolliere({ kundeId: kunde.id, typ: "vollmacht.widerrufen", akteur: "kunde" });
}

// Tageslauf

export interface Tageslaufbericht {
  stichtag: string;
  aktionen: string[];
}

function offenerFall(vertragId: string): Fall | undefined {
  return repo.faelleNachStatus(OFFENE_STATUS).find((f) => f.vertragId === vertragId);
}

/** Prüft einen Vertrag und legt bei lohnender Ersparnis einen Wechselvorschlag an. */
export function pruefeVertrag(v: Vertrag & { letztePruefung?: string }, stichtag: string): string | undefined {
  if (offenerFall(v.id)) return;
  const fristen = fristenFuer(v, stichtag);
  if (stichtag < fristen.pruefungAb) return;
  if (v.letztePruefung && diffDays(v.letztePruefung, stichtag) < PRUEF_INTERVALL_TAGE) return;

  const kunde = repo.kundeById(v.kundeId)!;
  const beste = besteEmpfehlung(v, kunde.modus);
  v.letztePruefung = stichtag;
  repo.vertragSpeichern(v);

  if (!beste || beste.ersparnisErstesJahr < MIN_ERSPARNIS_EUR) {
    repo.protokolliere({ kundeId: kunde.id, typ: "vertrag.kein_lohnender_wechsel", akteur: "system", data: { vertragId: v.id, besteErsparnis: beste?.ersparnisErstesJahr ?? null } });
    return `Vertrag ${v.id.slice(0, 8)}: kein lohnender Wechsel`;
  }

  const fall = fallAusEmpfehlung(kunde, v, beste, stichtag);
  const auto = kunde.modus === "vollmacht" && kunde.autoFreigabeAbEur !== undefined && beste.ersparnisErstesJahr >= kunde.autoFreigabeAbEur;
  if (auto) uebergang(fall, "kunde_freigeben", "system", { quelle: "dauerauftrag", schwelle: kunde.autoFreigabeAbEur });

  repo.nachrichtSenden(
    kunde.id,
    kunde.email,
    `Sie können ${eur(beste.ersparnisErstesJahr)} sparen`,
    `Hallo ${kunde.vorname},\n\nfür Ihren ${v.stelle.sparte === "strom" ? "Strom" : "Gas"}vertrag haben wir „${beste.tarif.name}“ von ${versorgerName(beste.tarif.versorgerId)} gefunden. ` +
      `Ersparnis im ersten Jahr: ${eur(beste.ersparnisErstesJahr)}. Neuer Lieferbeginn: ${formatDe(fall.fristen.neuerLieferbeginn)}.\n\n` +
      (kunde.modus === "erinnerung"
        ? `Jetzt abschließen: ${fall.deeplink}\nBitte bis spätestens ${formatDe(fall.fristen.letzterKuendigungstag)}.`
        : auto
          ? "Gemäß Ihrem Dauerauftrag ist der Wechsel freigegeben. Sie können ihn in Ihrem Konto jederzeit stoppen."
          : `Bitte bestätigen Sie den Wechsel in Ihrem Konto bis ${formatDe(fall.fristen.letzterKuendigungstag)}.`) +
      `\n\nIhr Kundenkonto: ${kontoLink(kunde)}`,
  );
  return `Vertrag ${v.id.slice(0, 8)}: Vorschlag ${beste.tarif.name} (${eur(beste.ersparnisErstesJahr)})${auto ? ", automatisch freigegeben" : ""}`;
}

function vertragUmstellen(fall: Fall) {
  const alt = repo.vertragById(fall.vertragId)!;
  alt.aktiv = false;
  repo.vertragSpeichern(alt);

  const sa = (fall as Fall & { selbstAbschluss?: SelbstAbschluss }).selbstAbschluss;
  let bestand: BestandsVertrag;
  if (sa) {
    bestand = { sparte: alt.stelle.sparte, istGrundversorgung: false, ...sa };
  } else {
    const t = tarifById(fall.tarifId);
    const lieferbeginn = fall.fristen.neuerLieferbeginn;
    bestand = {
      sparte: t.sparte,
      versorgerName: versorgerName(t.versorgerId),
      tarifName: t.name,
      istGrundversorgung: false,
      arbeitspreisCtBrutto: fall.kosten.arbeitspreisCtBrutto,
      grundpreisEurMonatBrutto: Math.round((fall.kosten.grundpreisEurJahrBrutto / 12) * 100) / 100,
      lieferbeginn,
      erstlaufzeitMonate: t.erstlaufzeitMonate,
      kuendigungsfristWochen: t.kuendigungsfristWochen,
      bonusFaelligAm: t.neukundenbonusEur > 0 ? bonusFaelligkeit(lieferbeginn, t.neukundenbonusNachMonaten) : undefined,
    };
  }
  const neu = repo.vertragAnlegen({ kundeId: alt.kundeId, aktiv: true, stelle: alt.stelle, bestand, tarifId: sa ? undefined : fall.tarifId });
  repo.protokolliere({ kundeId: alt.kundeId, fallId: fall.id, typ: "vertrag.umgestellt", akteur: "system", data: { alt: alt.id, neu: neu.id } });
  const kunde = repo.kundeById(alt.kundeId)!;
  repo.nachrichtSenden(kunde.id, kunde.email, "Ihr Wechsel ist abgeschlossen", `Hallo ${kunde.vorname},\n\nab heute beliefert Sie ${bestand.versorgerName}. Wir melden uns automatisch, bevor der nächste Wechsel sinnvoll ist.\n\nIhr Kundenkonto: ${kontoLink(kunde)}`);
}

export async function tageslauf(stichtag = heute()): Promise<Tageslaufbericht> {
  const aktionen: string[] = [];
  const kanal = abschlusskanal();

  for (const fall of repo.faelleNachStatus(OFFENE_STATUS)) {
    const kurz = fall.id.slice(0, 8);
    if (fall.status === "betreiber_freigegeben") {
      await versucheUebermittlung(fall, stichtag);
      if ((fall.status as string) === "uebermittelt") aktionen.push(`Fall ${kurz}: übermittelt (${fall.externeReferenz})`);
    } else if (fall.status === "uebermittelt" && fall.externeReferenz) {
      const r = await kanal.statusAbfragen(fall.externeReferenz);
      const kunde = repo.kundeById(fall.kundeId)!;
      if (r.status === "bestaetigt") {
        uebergang(fall, "versorger_bestaetigt", "versorger");
        repo.nachrichtSenden(kunde.id, kunde.email, "Ihr Wechsel ist bestätigt", `Hallo ${kunde.vorname},\n\nder neue Versorger hat den Lieferbeginn zum ${formatDe(fall.fristen.neuerLieferbeginn)} bestätigt. Die Kündigung beim bisherigen Versorger übernimmt er.\n\nIhr Kundenkonto: ${kontoLink(kunde)}`);
        aktionen.push(`Fall ${kurz}: vom Versorger bestätigt`);
      } else if (r.status === "abgelehnt") {
        uebergang(fall, "versorger_abgelehnt", "versorger", { grund: r.grund });
        // Sofort neu vergleichen, nicht erst nach dem Prüfintervall.
        const v = repo.vertragById(fall.vertragId) as Vertrag & { letztePruefung?: string };
        delete v.letztePruefung;
        repo.vertragSpeichern(v);
        repo.nachrichtSenden(kunde.id, kunde.email, "Ihr Wechsel wurde abgelehnt", `Hallo ${kunde.vorname},\n\nder Versorger hat den Antrag abgelehnt (${r.grund ?? "ohne Angabe"}). Wir suchen automatisch eine Alternative.\n\nIhr Kundenkonto: ${kontoLink(kunde)}`);
        aktionen.push(`Fall ${kurz}: vom Versorger abgelehnt`);
      }
    }
    if ((fall.status === "bestaetigt" || fall.status === "kunde_selbst_abgeschlossen") && stichtag >= fall.fristen.neuerLieferbeginn) {
      uebergang(fall, "lieferbeginn_erreicht", "system");
      vertragUmstellen(fall);
      aktionen.push(`Fall ${kurz}: Lieferbeginn erreicht, Vertrag umgestellt`);
    } else if (fall.fristen.rollierend && ["vorgeschlagen", "kunde_freigegeben", "betreiber_freigegeben"].includes(fall.status) && stichtag > fall.fristen.letzterKuendigungstag) {
      // Kein festes Vertragsende: Fristen ab heute neu berechnen statt den Fall verfallen zu lassen.
      fall.fristen = fristenFuer(repo.vertragById(fall.vertragId)!, stichtag);
      repo.fallSpeichern(fall);
    } else if ((fall.status === "vorgeschlagen" || fall.status === "kunde_freigegeben") && stichtag > fall.fristen.letzterKuendigungstag) {
      uebergang(fall, "ablaufen", "system");
      aktionen.push(`Fall ${kurz}: abgelaufen (Frist ${fall.fristen.letzterKuendigungstag} verpasst)`);
    }
  }

  for (const v of repo.aktiveVertraege()) {
    const a = pruefeVertrag(v, stichtag);
    if (a) aktionen.push(a);
  }

  repo.protokolliere({ typ: "tageslauf", akteur: "system", data: { stichtag, aktionen: aktionen.length } });
  return { stichtag, aktionen };
}
