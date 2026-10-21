// DEMO-DATEN. Versorger und Tarife sind fiktiv, Netzentgelte und Abgaben sind gerundete
// Größenordnungen und ausdrücklich NICHT aktuell. Vor dem Livebetrieb durch eine lizenzierte
// Tarifdatenquelle (z.B. PROCHECK24-Webservice) und veröffentlichte Netzentgelte ersetzen.
import type { Netzgebiet, PlzZuordnung, Tarif, Versorger } from "./types";

export const ABGABEN = {
  mwstSatz: 0.19,
  strom: {
    /** Stromsteuer netto, ct/kWh */
    stromsteuerCt: 2.05,
    /** Summe der Umlagen (KWKG, Offshore, §19 StromNEV) netto, ct/kWh, Demo-Wert */
    umlagenCt: 2.65,
  },
  gas: {
    /** Energiesteuer netto, ct/kWh */
    energiesteuerCt: 0.55,
    /** Umlagen netto, ct/kWh, Demo-Wert */
    umlagenCt: 0,
  },
} as const;

export const NETZGEBIETE: Netzgebiet[] = [
  { id: "strom-berlin", sparte: "strom", name: "Berlin", netzbetreiber: "Netzbetreiber Berlin (Demo)", grundversorgerTarifId: "gv-strom-berlin", netzArbeitspreisCtNetto: 9.0, netzGrundpreisEurJahrNetto: 120, konzessionsabgabeCtNetto: 1.99 },
  { id: "strom-muenchen", sparte: "strom", name: "München", netzbetreiber: "Netzbetreiber München (Demo)", grundversorgerTarifId: "gv-strom-muenchen", netzArbeitspreisCtNetto: 7.5, netzGrundpreisEurJahrNetto: 100, konzessionsabgabeCtNetto: 2.39 },
  { id: "strom-koeln-nord", sparte: "strom", name: "Köln Nord", netzbetreiber: "Netzbetreiber Köln (Demo)", grundversorgerTarifId: "gv-strom-koeln", netzArbeitspreisCtNetto: 8.2, netzGrundpreisEurJahrNetto: 110, konzessionsabgabeCtNetto: 1.99 },
  { id: "strom-koeln-sued", sparte: "strom", name: "Köln Süd (Randgebiet)", netzbetreiber: "Regionalnetz Rhein (Demo)", grundversorgerTarifId: "gv-strom-koeln", netzArbeitspreisCtNetto: 9.8, netzGrundpreisEurJahrNetto: 130, konzessionsabgabeCtNetto: 1.32 },
  { id: "gas-berlin", sparte: "gas", name: "Berlin", netzbetreiber: "Gasnetz Berlin (Demo)", grundversorgerTarifId: "gv-gas-berlin", netzArbeitspreisCtNetto: 1.6, netzGrundpreisEurJahrNetto: 60, konzessionsabgabeCtNetto: 0.61 },
  { id: "gas-muenchen", sparte: "gas", name: "München", netzbetreiber: "Gasnetz München (Demo)", grundversorgerTarifId: "gv-gas-muenchen", netzArbeitspreisCtNetto: 1.4, netzGrundpreisEurJahrNetto: 55, konzessionsabgabeCtNetto: 0.51 },
  { id: "gas-koeln", sparte: "gas", name: "Köln", netzbetreiber: "Gasnetz Köln (Demo)", grundversorgerTarifId: "gv-gas-koeln", netzArbeitspreisCtNetto: 1.7, netzGrundpreisEurJahrNetto: 70, konzessionsabgabeCtNetto: 0.66 },
];

export const PLZ_ZUORDNUNG: PlzZuordnung[] = [
  { plz: "10115", ort: "Berlin", netzgebietId: "strom-berlin" },
  { plz: "10115", ort: "Berlin", netzgebietId: "gas-berlin" },
  { plz: "80331", ort: "München", netzgebietId: "strom-muenchen" },
  { plz: "80331", ort: "München", netzgebietId: "gas-muenchen" },
  // 50999 ist absichtlich auf Straßenebene geteilt: eine PLZ, zwei Stromnetzgebiete.
  { plz: "50999", ort: "Köln", netzgebietId: "strom-koeln-sued", strassen: ["Hauptstraße", "Weißer Straße", "Uferstraße"] },
  { plz: "50999", ort: "Köln", netzgebietId: "strom-koeln-nord" },
  { plz: "50999", ort: "Köln", netzgebietId: "gas-koeln" },
];

export const VERSORGER: Versorger[] = [
  { id: "lumen", name: "Lumen Energie", bonitaet: "A" },
  { id: "nordwind", name: "Nordwind Strom & Gas", bonitaet: "A" },
  { id: "blitz", name: "Blitzwerk", bonitaet: "B" },
  { id: "sparfuchs", name: "Sparfuchs Energie", bonitaet: "C" },
  { id: "gruenquell", name: "Grünquell", bonitaet: "A" },
  { id: "isarstrom", name: "Isarstrom Regional", bonitaet: "A" },
  { id: "kontor", name: "Energiekontor Mitte", bonitaet: "B" },
  { id: "gv", name: "Örtlicher Grundversorger", bonitaet: "A" },
];

const basis = {
  kuendigungsfristWochen: 4,
  sofortbonusEur: 0,
  neukundenbonusEur: 0,
  neukundenbonusNachMonaten: 12,
  vorkasse: false,
  kautionEur: 0,
  oeko: false,
  paket: false,
} satisfies Partial<Tarif>;

const grundversorgung = (id: string, sparte: "strom" | "gas", netzgebietIds: string[], ap: number, gp: number): Tarif => ({
  ...basis,
  id,
  versorgerId: "gv",
  name: sparte === "strom" ? "Grundversorgung Strom" : "Grundversorgung Gas",
  sparte,
  netzgebietIds,
  istGrundversorgung: true,
  energieArbeitspreisCtNetto: ap,
  energieGrundpreisEurJahrNetto: gp,
  erstlaufzeitMonate: 0,
  kuendigungsfristWochen: 2,
  preisgarantie: "keine",
  preisgarantieMonate: 0,
  kanaele: [],
  verguetungEur: 0,
});

export const TARIFE: Tarif[] = [
  grundversorgung("gv-strom-berlin", "strom", ["strom-berlin"], 18.0, 90),
  grundversorgung("gv-strom-muenchen", "strom", ["strom-muenchen"], 17.2, 85),
  grundversorgung("gv-strom-koeln", "strom", ["strom-koeln-nord", "strom-koeln-sued"], 17.8, 95),
  grundversorgung("gv-gas-berlin", "gas", ["gas-berlin"], 8.0, 110),
  grundversorgung("gv-gas-muenchen", "gas", ["gas-muenchen"], 7.6, 100),
  grundversorgung("gv-gas-koeln", "gas", ["gas-koeln"], 7.9, 105),

  // Strom, bundesweit
  { ...basis, id: "lumen-strom-12", versorgerId: "lumen", name: "Lumen Strom 12", sparte: "strom", energieArbeitspreisCtNetto: 11.2, energieGrundpreisEurJahrNetto: 96, erstlaufzeitMonate: 12, preisgarantie: "eingeschraenkt", preisgarantieMonate: 12, neukundenbonusEur: 80, kanaele: ["procheck24", "check24_affiliate"], verguetungEur: 60 },
  { ...basis, id: "nordwind-strom-flex", versorgerId: "nordwind", name: "Nordwind Ökostrom Flex", sparte: "strom", energieArbeitspreisCtNetto: 12.4, energieGrundpreisEurJahrNetto: 84, erstlaufzeitMonate: 1, preisgarantie: "keine", preisgarantieMonate: 0, oeko: true, kanaele: ["procheck24", "check24_affiliate"], verguetungEur: 40 },
  // Bonusfalle: im ersten Jahr günstig, im zweiten Jahr teuer
  { ...basis, id: "blitz-strom-bonus", versorgerId: "blitz", name: "Blitz Strom Bonus", sparte: "strom", energieArbeitspreisCtNetto: 14.5, energieGrundpreisEurJahrNetto: 120, erstlaufzeitMonate: 12, preisgarantie: "eingeschraenkt", preisgarantieMonate: 12, sofortbonusEur: 100, neukundenbonusEur: 150, kanaele: ["procheck24", "check24_affiliate"], verguetungEur: 90 },
  { ...basis, id: "sparfuchs-strom", versorgerId: "sparfuchs", name: "Sparfuchs Strom Vorkasse", sparte: "strom", energieArbeitspreisCtNetto: 9.5, energieGrundpreisEurJahrNetto: 60, erstlaufzeitMonate: 12, preisgarantie: "eingeschraenkt", preisgarantieMonate: 12, vorkasse: true, kanaele: ["procheck24"], verguetungEur: 70 },
  { ...basis, id: "kontor-strom-24", versorgerId: "kontor", name: "Kontor Strom 24", sparte: "strom", energieArbeitspreisCtNetto: 10.5, energieGrundpreisEurJahrNetto: 90, erstlaufzeitMonate: 24, preisgarantie: "voll", preisgarantieMonate: 24, kanaele: ["procheck24"], verguetungEur: 65 },
  { ...basis, id: "kontor-strom-paket", versorgerId: "kontor", name: "Kontor Paket 2500", sparte: "strom", energieArbeitspreisCtNetto: 9.9, energieGrundpreisEurJahrNetto: 70, erstlaufzeitMonate: 12, preisgarantie: "eingeschraenkt", preisgarantieMonate: 12, paket: true, kanaele: ["procheck24"], verguetungEur: 50 },
  { ...basis, id: "kontor-strom-kaution", versorgerId: "kontor", name: "Kontor Strom Basis", sparte: "strom", energieArbeitspreisCtNetto: 10.0, energieGrundpreisEurJahrNetto: 80, erstlaufzeitMonate: 12, preisgarantie: "eingeschraenkt", preisgarantieMonate: 12, kautionEur: 100, kanaele: ["procheck24"], verguetungEur: 55 },
  { ...basis, id: "gruenquell-strom", versorgerId: "gruenquell", name: "Grünquell Natur 12", sparte: "strom", energieArbeitspreisCtNetto: 11.8, energieGrundpreisEurJahrNetto: 110, erstlaufzeitMonate: 12, preisgarantie: "voll", preisgarantieMonate: 12, neukundenbonusEur: 50, oeko: true, kanaele: ["procheck24", "check24_affiliate"], verguetungEur: 55 },
  // Regional, nur München
  { ...basis, id: "isar-strom", versorgerId: "isarstrom", name: "Isarstrom Heimat", sparte: "strom", netzgebietIds: ["strom-muenchen"], energieArbeitspreisCtNetto: 10.9, energieGrundpreisEurJahrNetto: 100, erstlaufzeitMonate: 12, preisgarantie: "voll", preisgarantieMonate: 24, kanaele: ["procheck24"], verguetungEur: 50 },

  // Gas, bundesweit
  { ...basis, id: "lumen-gas-12", versorgerId: "lumen", name: "Lumen Gas 12", sparte: "gas", energieArbeitspreisCtNetto: 5.4, energieGrundpreisEurJahrNetto: 90, erstlaufzeitMonate: 12, preisgarantie: "eingeschraenkt", preisgarantieMonate: 12, neukundenbonusEur: 100, kanaele: ["procheck24", "check24_affiliate"], verguetungEur: 70 },
  { ...basis, id: "nordwind-gas-flex", versorgerId: "nordwind", name: "Nordwind Gas Flex", sparte: "gas", energieArbeitspreisCtNetto: 5.9, energieGrundpreisEurJahrNetto: 70, erstlaufzeitMonate: 1, preisgarantie: "keine", preisgarantieMonate: 0, kanaele: ["procheck24", "check24_affiliate"], verguetungEur: 45 },
  { ...basis, id: "blitz-gas-bonus", versorgerId: "blitz", name: "Blitz Gas Bonus", sparte: "gas", energieArbeitspreisCtNetto: 7.0, energieGrundpreisEurJahrNetto: 130, erstlaufzeitMonate: 12, preisgarantie: "eingeschraenkt", preisgarantieMonate: 12, sofortbonusEur: 150, neukundenbonusEur: 100, kanaele: ["procheck24", "check24_affiliate"], verguetungEur: 95 },
  { ...basis, id: "sparfuchs-gas", versorgerId: "sparfuchs", name: "Sparfuchs Gas Vorkasse", sparte: "gas", energieArbeitspreisCtNetto: 4.6, energieGrundpreisEurJahrNetto: 60, erstlaufzeitMonate: 12, preisgarantie: "eingeschraenkt", preisgarantieMonate: 12, vorkasse: true, kanaele: ["procheck24"], verguetungEur: 70 },
];
