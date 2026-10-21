// Fachliche Typen. Alle Datumswerte sind ISO-Strings (YYYY-MM-DD), alle Geldbeträge Euro brutto,
// sofern nicht ausdrücklich "netto" im Namen steht.

export type Sparte = "strom" | "gas";

/** Netzgebiet: bestimmt Netzentgelte, Konzessionsabgabe und Grundversorger. */
export interface Netzgebiet {
  id: string;
  sparte: Sparte;
  name: string;
  netzbetreiber: string;
  grundversorgerTarifId: string;
  /** Netzentgelt Arbeitspreis netto, ct/kWh */
  netzArbeitspreisCtNetto: number;
  /** Netzentgelt Grundpreis inkl. Messstellenbetrieb netto, €/Jahr */
  netzGrundpreisEurJahrNetto: number;
  /** Konzessionsabgabe netto, ct/kWh */
  konzessionsabgabeCtNetto: number;
}

/** Zuordnung PLZ -> Netzgebiet. Mehrere Einträge pro PLZ sind möglich (Straßenebene). */
export interface PlzZuordnung {
  plz: string;
  ort: string;
  netzgebietId: string;
  /** Leer = gilt für alle Straßen, die keinem anderen Eintrag zugeordnet sind. */
  strassen?: string[];
}

export type Preisgarantie = "keine" | "eingeschraenkt" | "voll";
export type Bonitaet = "A" | "B" | "C";

export interface Versorger {
  id: string;
  name: string;
  /** Interne Risikoeinstufung (Demo). C = nicht empfehlen. */
  bonitaet: Bonitaet;
}

export interface Tarif {
  id: string;
  versorgerId: string;
  name: string;
  sparte: Sparte;
  /** Leer = bundesweit verfügbar */
  netzgebietIds?: string[];
  istGrundversorgung?: boolean;
  /** Energiepreis-Anteil des Versorgers netto (ohne Netz, Steuern, Umlagen), ct/kWh */
  energieArbeitspreisCtNetto: number;
  /** Grundpreis-Anteil des Versorgers netto, €/Jahr */
  energieGrundpreisEurJahrNetto: number;
  erstlaufzeitMonate: number;
  /** Kündigungsfrist in Wochen nach Ablauf der Erstlaufzeit (Faire-Verbraucherverträge-Gesetz: max. 1 Monat) */
  kuendigungsfristWochen: number;
  preisgarantie: Preisgarantie;
  preisgarantieMonate: number;
  /** Wird nach ca. 60 bis 90 Tagen Belieferung ausgezahlt */
  sofortbonusEur: number;
  /** Wird nach `neukundenbonusNachMonaten` ununterbrochener Belieferung gewährt */
  neukundenbonusEur: number;
  neukundenbonusNachMonaten: number;
  vorkasse: boolean;
  kautionEur: number;
  oeko: boolean;
  /** Pakettarif: feste kWh-Menge, Mehrverbrauch teuer. Wird standardmäßig ausgeschlossen. */
  paket: boolean;
  /** Über welche Kanäle dieser Tarif abschließbar ist */
  kanaele: AbschlusskanalId[];
  /** Erwartete Vergütung pro Abschluss (Demo), fließt NICHT ins Ranking ein */
  verguetungEur: number;
}

export type AbschlusskanalId = "procheck24" | "check24_affiliate";

/** Bestehender Vertrag des Kunden, wie er auf der Rechnung steht. */
export interface BestandsVertrag {
  sparte: Sparte;
  versorgerName: string;
  tarifName: string;
  istGrundversorgung: boolean;
  arbeitspreisCtBrutto: number;
  grundpreisEurMonatBrutto: number;
  lieferbeginn: string;
  erstlaufzeitMonate: number;
  kuendigungsfristWochen: number;
  /** Datum, an dem der Neukundenbonus des aktuellen Vertrags fällig wird (falls vorhanden) */
  bonusFaelligAm?: string;
}

export interface Verbrauchsstelle {
  sparte: Sparte;
  plz: string;
  strasse: string;
  netzgebietId: string;
  jahresverbrauchKwh: number;
}

export interface Kostenaufstellung {
  arbeitspreisCtBrutto: number;
  grundpreisEurJahrBrutto: number;
  /** Kosten für 12 Monate ohne Bonus */
  jahreskostenOhneBonus: number;
  /** Boni, die innerhalb von 12 Monaten sicher anfallen */
  bonusImErstenJahr: number;
  /** Bereinigte Kosten im ersten Jahr = ohne Bonus minus sicherer Bonus */
  jahreskostenErstesJahr: number;
  /** Prognose Jahr 2: ohne Bonus, Preis nach Garantie unverändert (Annahme) */
  jahreskostenZweitesJahr: number;
}

export interface Filter {
  keineVorkasse: boolean;
  keineKaution: boolean;
  maxErstlaufzeitMonate: number;
  mindestPreisgarantie: Preisgarantie;
  keinPaket: boolean;
  bonitaetAusschliessen: Bonitaet[];
  nurOeko: boolean;
}

export interface Empfehlung {
  tarif: Tarif;
  versorger: Versorger;
  kosten: Kostenaufstellung;
  ersparnisErstesJahr: number;
  ersparnisOhneBonus: number;
}

export interface Ausschluss {
  tarif: Tarif;
  gruende: string[];
}
