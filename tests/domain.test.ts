import { describe, expect, it } from "vitest";
import { addMonths } from "@/domain/dates";
import { TARIFE } from "@/domain/demoData";
import { berechneFristen } from "@/domain/fristen";
import { berechneBestandskosten, berechneKosten } from "@/domain/kosten";
import { findeNetzgebiet, netzgebietById } from "@/domain/netzgebiet";
import { STANDARD_FILTER, vergleiche, verfuegbareTarife } from "@/domain/vergleich";
import { naechsterStatus, UngueltigerUebergang } from "@/domain/wechselfall";

const tarif = (id: string) => TARIFE.find((t) => t.id === id)!;
const berlin = netzgebietById("strom-berlin")!;

describe("Kostenrechnung", () => {
  it("rechnet netto Bestandteile korrekt in brutto um (handgerechnet)", () => {
    // AP netto: 11,2 + 9,0 Netz + 1,99 KA + 2,05 Stromsteuer + 2,65 Umlagen = 26,89 ct -> x1,19 = 32,00 ct
    // GP netto: 96 + 120 = 216 € -> x1,19 = 257,04 €
    const k = berechneKosten(tarif("lumen-strom-12"), berlin, 2500);
    expect(k.arbeitspreisCtBrutto).toBe(32.0);
    expect(k.grundpreisEurJahrBrutto).toBe(257.04);
    expect(k.jahreskostenOhneBonus).toBe(1057.04);
    expect(k.bonusImErstenJahr).toBe(80);
    expect(k.jahreskostenErstesJahr).toBe(977.04);
    expect(k.jahreskostenZweitesJahr).toBe(1057.04);
  });

  it("zählt einen Neukundenbonus nach mehr als 12 Monaten nicht zum ersten Jahr", () => {
    const t = { ...tarif("lumen-strom-12"), neukundenbonusNachMonaten: 13 };
    expect(berechneKosten(t, berlin, 2500).bonusImErstenJahr).toBe(0);
  });

  it("berechnet Bestandskosten aus Rechnungswerten", () => {
    const v = { arbeitspreisCtBrutto: 40, grundpreisEurMonatBrutto: 12.5 } as never;
    expect(berechneBestandskosten(v, 2500)).toBe(1150);
  });
});

describe("Netzgebiet", () => {
  it("löst geteilte PLZ über die Straße auf", () => {
    const r = findeNetzgebiet("strom", "50999", "Hauptstr. 12");
    expect(r.status === "eindeutig" && r.netzgebiet.id).toBe("strom-koeln-sued");
  });
  it("nutzt den Standardeintrag für nicht gelistete Straßen", () => {
    const r = findeNetzgebiet("strom", "50999", "Ringstraße 3");
    expect(r.status === "eindeutig" && r.netzgebiet.id).toBe("strom-koeln-nord");
  });
  it("meldet Mehrdeutigkeit ohne Straße", () => {
    expect(findeNetzgebiet("strom", "50999").status).toBe("mehrdeutig");
  });
  it("trennt Sparten", () => {
    const r = findeNetzgebiet("gas", "50999");
    expect(r.status === "eindeutig" && r.netzgebiet.id).toBe("gas-koeln");
  });
  it("kennt unbekannte PLZ", () => {
    expect(findeNetzgebiet("strom", "99999").status).toBe("unbekannt");
  });
});

describe("Vergleich", () => {
  const bestand = 1300;

  it("schließt Verbraucherfallen standardmäßig aus und begründet das", () => {
    const { empfehlungen, ausgeschlossen } = vergleiche(berlin, 2500, bestand);
    const ids = empfehlungen.map((e) => e.tarif.id);
    for (const id of ["sparfuchs-strom", "kontor-strom-24", "kontor-strom-paket", "kontor-strom-kaution", "gv-strom-berlin"]) {
      expect(ids).not.toContain(id);
      expect(ausgeschlossen.find((a) => a.tarif.id === id)?.gruende.length).toBeGreaterThan(0);
    }
    expect(ids).not.toContain("isar-strom"); // nur München
  });

  it("ranking ist unabhängig von der Vergütung", () => {
    const tarife = verfuegbareTarife(berlin);
    const vorher = vergleiche(berlin, 2500, bestand, STANDARD_FILTER, "erstesJahr", tarife).empfehlungen.map((e) => e.tarif.id);
    const manipuliert = tarife.map((t, i) => ({ ...t, verguetungEur: 1000 - i * 50 }));
    const nachher = vergleiche(berlin, 2500, bestand, STANDARD_FILTER, "erstesJahr", manipuliert).empfehlungen.map((e) => e.tarif.id);
    expect(nachher).toEqual(vorher);
  });

  it("macht die Bonusfalle sichtbar: Rang hängt von der Rankingbasis ab", () => {
    const jahr1 = vergleiche(berlin, 2500, bestand, STANDARD_FILTER, "erstesJahr").empfehlungen;
    const ohneBonus = vergleiche(berlin, 2500, bestand, STANDARD_FILTER, "ohneBonus").empfehlungen;
    expect(jahr1[0].tarif.id).toBe("blitz-strom-bonus");
    expect(ohneBonus[0].tarif.id).not.toBe("blitz-strom-bonus");
    const blitz = jahr1[0];
    expect(blitz.kosten.jahreskostenZweitesJahr).toBeGreaterThan(blitz.kosten.jahreskostenErstesJahr + 200);
  });

  it("berücksichtigt regionale Tarife nur im eigenen Netzgebiet", () => {
    const muc = netzgebietById("strom-muenchen")!;
    expect(vergleiche(muc, 2500, bestand).empfehlungen.map((e) => e.tarif.id)).toContain("isar-strom");
  });
});

describe("Fristen", () => {
  it("wartet bei laufender Erstlaufzeit bis zu deren Ende", () => {
    const f = berechneFristen({ lieferbeginn: "2026-03-01", erstlaufzeitMonate: 12, kuendigungsfristWochen: 4, istGrundversorgung: false }, "2026-10-21");
    expect(f.fruehestesLieferende).toBe("2027-02-28");
    expect(f.letzterKuendigungstag).toBe("2027-01-31");
    expect(f.neuerLieferbeginn).toBe("2027-03-01");
    expect(f.pruefungAb).toBe("2026-12-20");
  });

  it("nach Ablauf der Erstlaufzeit gilt die Kündigungsfrist ab heute", () => {
    const f = berechneFristen({ lieferbeginn: "2024-01-01", erstlaufzeitMonate: 12, kuendigungsfristWochen: 4, istGrundversorgung: false }, "2026-10-21");
    expect(f.fruehestesLieferende).toBe("2026-11-18");
  });

  it("Grundversorgung: 2 Wochen Frist", () => {
    const f = berechneFristen({ lieferbeginn: "2010-01-01", erstlaufzeitMonate: 0, kuendigungsfristWochen: 2, istGrundversorgung: true }, "2026-10-21");
    expect(f.fruehestesLieferende).toBe("2026-11-04");
  });

  it("verschiebt das Lieferende, damit ein fälliger Bonus nicht verfällt", () => {
    const f = berechneFristen(
      { lieferbeginn: "2025-01-01", erstlaufzeitMonate: 1, kuendigungsfristWochen: 4, istGrundversorgung: false, bonusFaelligAm: "2026-12-31" },
      "2026-10-21",
    );
    expect(f.fruehestesLieferende).toBe("2026-12-31");
    expect(f.neuerLieferbeginn).toBe("2027-01-01");
  });

  it("Monatsaddition kappt auf Monatsende", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });
});

describe("Wechselfall", () => {
  it("verlangt im Vollmachtsmodus die Freigabe durch den Betreiber vor der Übermittlung", () => {
    expect(() => naechsterStatus("vollmacht", "kunde_freigegeben", "uebermitteln", "system")).toThrow(UngueltigerUebergang);
    expect(naechsterStatus("vollmacht", "kunde_freigegeben", "betreiber_freigeben", "betreiber")).toBe("betreiber_freigegeben");
  });
  it("das System darf nicht als Betreiber freigeben", () => {
    expect(() => naechsterStatus("vollmacht", "kunde_freigegeben", "betreiber_freigeben", "system")).toThrow(UngueltigerUebergang);
  });
  it("Dauerauftrag: System darf die Kundenfreigabe erteilen", () => {
    expect(naechsterStatus("vollmacht", "vorgeschlagen", "kunde_freigeben", "system")).toBe("kunde_freigegeben");
  });
  it("Erinnerungsmodus kennt keine Übermittlung", () => {
    expect(() => naechsterStatus("erinnerung", "vorgeschlagen", "kunde_freigeben", "kunde")).toThrow(UngueltigerUebergang);
  });
});
