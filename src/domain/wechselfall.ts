// Zustandsautomat eines Wechselfalls. Jeder Übergang wird mit Akteur und Zeitpunkt protokolliert.
//
// Modus "vollmacht":  vorgeschlagen -> kunde_freigegeben -> betreiber_freigegeben -> uebermittelt
//                     -> bestaetigt -> abgeschlossen
// Modus "erinnerung": vorgeschlagen -> kunde_selbst_abgeschlossen -> abgeschlossen
//
// Der Vertragsabschluss (Übermittlung an den Versorger) passiert nie ohne menschliche Freigabe durch
// den Betreiber. Die Kundenfreigabe kann durch einen Dauerauftrag automatisch erteilt werden.

export type Modus = "vollmacht" | "erinnerung";

export type Status =
  | "vorgeschlagen"
  | "kunde_freigegeben"
  | "betreiber_freigegeben"
  | "uebermittelt"
  | "bestaetigt"
  | "kunde_selbst_abgeschlossen"
  | "abgeschlossen"
  | "abgelehnt_kunde"
  | "abgelehnt_betreiber"
  | "abgelehnt_versorger"
  | "abgelaufen";

export type Ereignis =
  | "kunde_freigeben"
  | "kunde_ablehnen"
  | "betreiber_freigeben"
  | "betreiber_ablehnen"
  | "uebermitteln"
  | "versorger_bestaetigt"
  | "versorger_abgelehnt"
  | "kunde_selbst_abgeschlossen"
  | "lieferbeginn_erreicht"
  | "ablaufen";

export type Akteur = "kunde" | "betreiber" | "system" | "versorger";

const UEBERGAENGE: Record<Modus, Partial<Record<Status, Partial<Record<Ereignis, { nach: Status; akteure: Akteur[] }>>>>> = {
  vollmacht: {
    vorgeschlagen: {
      kunde_freigeben: { nach: "kunde_freigegeben", akteure: ["kunde", "system"] },
      kunde_ablehnen: { nach: "abgelehnt_kunde", akteure: ["kunde"] },
      ablaufen: { nach: "abgelaufen", akteure: ["system"] },
    },
    kunde_freigegeben: {
      betreiber_freigeben: { nach: "betreiber_freigegeben", akteure: ["betreiber"] },
      betreiber_ablehnen: { nach: "abgelehnt_betreiber", akteure: ["betreiber"] },
      kunde_ablehnen: { nach: "abgelehnt_kunde", akteure: ["kunde"] },
      ablaufen: { nach: "abgelaufen", akteure: ["system"] },
    },
    betreiber_freigegeben: {
      uebermitteln: { nach: "uebermittelt", akteure: ["system"] },
    },
    uebermittelt: {
      versorger_bestaetigt: { nach: "bestaetigt", akteure: ["versorger", "system"] },
      versorger_abgelehnt: { nach: "abgelehnt_versorger", akteure: ["versorger", "system"] },
    },
    bestaetigt: {
      lieferbeginn_erreicht: { nach: "abgeschlossen", akteure: ["system"] },
    },
  },
  erinnerung: {
    vorgeschlagen: {
      kunde_selbst_abgeschlossen: { nach: "kunde_selbst_abgeschlossen", akteure: ["kunde"] },
      kunde_ablehnen: { nach: "abgelehnt_kunde", akteure: ["kunde"] },
      ablaufen: { nach: "abgelaufen", akteure: ["system"] },
    },
    kunde_selbst_abgeschlossen: {
      lieferbeginn_erreicht: { nach: "abgeschlossen", akteure: ["system"] },
    },
  },
};

export const OFFENE_STATUS: Status[] = ["vorgeschlagen", "kunde_freigegeben", "betreiber_freigegeben", "uebermittelt", "bestaetigt", "kunde_selbst_abgeschlossen"];

export class UngueltigerUebergang extends Error {}

export function naechsterStatus(modus: Modus, aktuell: Status, ereignis: Ereignis, akteur: Akteur): Status {
  const regel = UEBERGAENGE[modus][aktuell]?.[ereignis];
  if (!regel) throw new UngueltigerUebergang(`"${ereignis}" ist im Status "${aktuell}" (${modus}) nicht erlaubt.`);
  if (!regel.akteure.includes(akteur)) throw new UngueltigerUebergang(`"${akteur}" darf "${ereignis}" nicht auslösen.`);
  return regel.nach;
}

export function erlaubteEreignisse(modus: Modus, aktuell: Status): Ereignis[] {
  return Object.keys(UEBERGAENGE[modus][aktuell] ?? {}) as Ereignis[];
}

export const STATUS_TEXT: Record<Status, string> = {
  vorgeschlagen: "Wechselvorschlag liegt vor",
  kunde_freigegeben: "Vom Kunden freigegeben, wartet auf Prüfung",
  betreiber_freigegeben: "Geprüft, wird übermittelt",
  uebermittelt: "An Versorger übermittelt",
  bestaetigt: "Vom Versorger bestätigt",
  kunde_selbst_abgeschlossen: "Kunde hat selbst abgeschlossen",
  abgeschlossen: "Wechsel abgeschlossen",
  abgelehnt_kunde: "Vom Kunden abgelehnt",
  abgelehnt_betreiber: "Bei Prüfung abgelehnt",
  abgelehnt_versorger: "Vom Versorger abgelehnt",
  abgelaufen: "Abgelaufen",
};
