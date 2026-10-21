import { addDays, addMonths, maxDate } from "./dates";

export interface Vertragsdaten {
  lieferbeginn: string;
  erstlaufzeitMonate: number;
  kuendigungsfristWochen: number;
  istGrundversorgung: boolean;
  /** Fälligkeit eines Neukundenbonus, der nur bei ununterbrochener Belieferung gezahlt wird */
  bonusFaelligAm?: string;
  /** Wirksamkeitsdatum einer angekündigten Preiserhöhung (Sonderkündigungsrecht) */
  preiserhoehungZum?: string;
}

export interface Fristen {
  /** Frühestes Lieferende ohne Bonusverlust und ohne Vertragsbruch */
  fruehestesLieferende: string;
  /** Letzter Tag, an dem die Kündigung beim Altversorger eingehen muss */
  letzterKuendigungstag: string;
  /** Neuer Lieferbeginn = Tag nach dem Lieferende */
  neuerLieferbeginn: string;
  /** Ab diesem Tag führt das System den Neuvergleich durch und erstellt einen Wechselvorschlag */
  pruefungAb: string;
  /** Ohne festes Vertragsende (Grundversorgung, nach Erstlaufzeit) verschieben sich die Fristen täglich mit. */
  rollierend: boolean;
  begruendung: string[];
}

/** Puffer vor dem letzten Kündigungstag für Freigaben und Übermittlung. */
export const VORLAUF_TAGE = 42;

/**
 * Seit dem Gesetz für faire Verbraucherverträge (Verträge ab 01.03.2022) verlängern sich Verträge nach
 * der Erstlaufzeit unbefristet und sind mit max. 1 Monat Frist kündbar. Grundversorgung ist jederzeit
 * mit 2 Wochen Frist kündbar. Ein Wechsel vor Ablauf der Erstlaufzeit ist nur per Sonderkündigung
 * (z.B. Preiserhöhung, Umzug) möglich und wird hier nicht automatisch angenommen.
 */
export function berechneFristen(v: Vertragsdaten, heute: string): Fristen {
  const begruendung: string[] = [];

  if (v.preiserhoehungZum && v.preiserhoehungZum > heute) {
    // Sonderkündigungsrecht: Kündigung ohne Frist zum Wirksamwerden der Preisänderung möglich.
    const ende = addDays(v.preiserhoehungZum, -1);
    return {
      fruehestesLieferende: ende,
      letzterKuendigungstag: ende,
      neuerLieferbeginn: v.preiserhoehungZum,
      pruefungAb: heute,
      rollierend: false,
      begruendung: [`Sonderkündigung wegen Preiserhöhung zum ${v.preiserhoehungZum}.`],
    };
  }

  const fristTage = v.kuendigungsfristWochen * 7;
  const fruehestesKuendigungsende = addDays(heute, fristTage);

  let vertragsende: string;
  if (v.istGrundversorgung || v.erstlaufzeitMonate <= 1) {
    vertragsende = fruehestesKuendigungsende;
    begruendung.push(
      v.istGrundversorgung
        ? `Grundversorgung: jederzeit mit ${v.kuendigungsfristWochen} Wochen Frist kündbar.`
        : `Monatlich kündbar mit ${v.kuendigungsfristWochen} Wochen Frist.`,
    );
  } else {
    const erstlaufzeitEnde = addDays(addMonths(v.lieferbeginn, v.erstlaufzeitMonate), -1);
    vertragsende = maxDate(erstlaufzeitEnde, fruehestesKuendigungsende);
    begruendung.push(
      erstlaufzeitEnde >= fruehestesKuendigungsende
        ? `Erstlaufzeit endet am ${erstlaufzeitEnde}.`
        : `Erstlaufzeit ist abgelaufen; Vertrag ist mit ${v.kuendigungsfristWochen} Wochen Frist kündbar.`,
    );
  }

  if (v.bonusFaelligAm && v.bonusFaelligAm > vertragsende) {
    // Der Bonus wird erst gezahlt, wenn bis zu diesem Tag beliefert wurde.
    begruendung.push(`Lieferende auf ${v.bonusFaelligAm} verschoben, damit der Neukundenbonus nicht verfällt.`);
    vertragsende = v.bonusFaelligAm;
  }

  const rollierend = vertragsende === fruehestesKuendigungsende;
  const letzterKuendigungstag = addDays(vertragsende, -fristTage);
  return {
    fruehestesLieferende: vertragsende,
    letzterKuendigungstag,
    neuerLieferbeginn: addDays(vertragsende, 1),
    pruefungAb: addDays(letzterKuendigungstag, -VORLAUF_TAGE),
    rollierend,
    begruendung,
  };
}

/** Bonus des neuen Tarifs wird nach n Monaten ununterbrochener Belieferung fällig. */
export function bonusFaelligkeit(lieferbeginn: string, nachMonaten: number): string {
  return addDays(addMonths(lieferbeginn, nachMonaten), -1);
}
