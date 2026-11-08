import { describe, expect, it } from "vitest";
import { zuFormularwerten, type RechnungsExtrakt } from "@/server/rechnung";

const leer: RechnungsExtrakt = {
  ist_energierechnung: true, sparte: null, plz: null, strasse: null, jahresverbrauch_kwh: null, versorger: null, tarifname: null,
  ist_grundversorgung: null, arbeitspreis_ct_brutto: null, grundpreis_eur_monat_brutto: null, lieferbeginn: null,
  erstlaufzeit_monate: null, kuendigungsfrist_wochen: null, hinweise: [],
};

describe("Rechnung in Formularwerte umsetzen", () => {
  it("übernimmt plausible Werte im Formularformat", () => {
    const { werte, hinweise } = zuFormularwerten({
      ...leer, sparte: "strom", plz: "10115", strasse: "Invalidenstraße 1", jahresverbrauch_kwh: 2487.4, versorger: "Stadtwerk",
      ist_grundversorgung: true, arbeitspreis_ct_brutto: 38.5, grundpreis_eur_monat_brutto: 12.9, lieferbeginn: "2021-03-01",
      kuendigungsfrist_wochen: 2, hinweise: ["Nettopreise hochgerechnet"],
    });
    expect(werte).toMatchObject({ sparte: "strom", plz: "10115", verbrauch: "2487", gv: "1", ap: "38,50", gp: "12,90", beginn: "2021-03-01", frist: "2" });
    expect(hinweise).toEqual(["Nettopreise hochgerechnet"]);
  });
  it("verwirft Unplausibles und nennt fehlende Pflichtangaben", () => {
    const { werte, hinweise } = zuFormularwerten({ ...leer, plz: "1011", arbeitspreis_ct_brutto: 0.385, lieferbeginn: "01.03.2021", jahresverbrauch_kwh: 2_000_000 });
    expect(werte).toEqual({});
    expect(hinweise.join(" ")).toContain("Arbeitspreis unplausibel");
    expect(hinweise.join(" ")).toContain("Nicht gefunden: PLZ, Verbrauch, Arbeitspreis, Grundpreis, Lieferbeginn");
  });
});
