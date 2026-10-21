import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/server/db";
import * as p from "@/server/prozess";
import * as repo from "@/server/repo";

const stelle = { sparte: "strom" as const, plz: "10115", strasse: "Invalidenstraße 1", netzgebietId: "strom-berlin", jahresverbrauchKwh: 2500 };
const grundversorgung = {
  sparte: "strom" as const,
  versorgerName: "Örtlicher Grundversorger",
  tarifName: "Grundversorgung",
  istGrundversorgung: true,
  arbeitspreisCtBrutto: 40.09,
  grundpreisEurMonatBrutto: 20.83,
  lieferbeginn: "2015-01-01",
  erstlaufzeitMonate: 0,
  kuendigungsfristWochen: 2,
};

function auftrag(modus: "vollmacht" | "erinnerung", nachname = "Muster", autoFreigabeAbEur?: number) {
  return p.auftragErteilen({
    kunde: {
      anrede: "Frau", vorname: "Erika", nachname, email: "erika@example.org", geburtsdatum: "1985-05-05",
      iban: "DE02120300000000202051", modus, autoFreigabeAbEur,
      einwilligungen: { agb: "2026-10-21", datenschutz: "2026-10-21", vollmacht: modus === "vollmacht" ? "2026-10-21" : undefined },
    },
    stelle,
    bestand: grundversorgung,
    tarifId: "lumen-strom-12",
    nachweis: { ipHash: "test", userAgent: "vitest" },
  });
}

beforeEach(() => {
  resetDbForTests();
  repo.einstellungSetzen("simuliertes_datum", "2026-10-21");
});

describe("Jährlicher Zyklus im Vollmachtsmodus", () => {
  it("wechselt aus der Grundversorgung und schlägt ein Jahr später automatisch den nächsten Wechsel vor", async () => {
    const { kunde, fall } = auftrag("vollmacht", "Muster", 50);
    expect(fall.status).toBe("kunde_freigegeben");
    expect(fall.fristen.neuerLieferbeginn).toBe("2026-11-05");
    expect(repo.aktiveVollmacht(kunde.id)).toBeDefined();

    // Ohne Betreiberfreigabe passiert nichts
    await p.tageslauf("2026-10-22");
    expect(repo.fallById(fall.id)!.status).toBe("kunde_freigegeben");
    // Grundversorgung hat kein festes Ende: der Lieferbeginn rückt mit, solange nicht übermittelt ist
    expect(repo.fallById(fall.id)!.fristen.neuerLieferbeginn).toBe("2026-11-06");

    await p.betreiberFreigeben(fall.id, "admin");
    expect(repo.fallById(fall.id)!.status).toBe("uebermittelt");

    await p.tageslauf("2026-10-22");
    expect(repo.fallById(fall.id)!.status).toBe("bestaetigt");

    await p.tageslauf("2026-11-06");
    expect(repo.fallById(fall.id)!.status).toBe("abgeschlossen");
    const [neu] = repo.vertraegeVonKunde(kunde.id).filter((v) => v.aktiv);
    expect(neu.bestand.versorgerName).toBe("Lumen Energie");
    expect(neu.bestand.bonusFaelligAm).toBe("2027-11-05");

    // Vor dem Prüftermin: kein Vorschlag
    const frueh = await p.tageslauf("2027-08-26");
    expect(frueh.aktionen).toEqual([]);

    const spaeter = await p.tageslauf("2027-08-27");
    expect(spaeter.aktionen.join()).toMatch(/automatisch freigegeben/);
    const offen = repo.faelleVonKunde(kunde.id).find((f) => f.status === "kunde_freigegeben")!;
    // Neuer Lieferbeginn erst nach Fälligkeit des Bonus
    expect(offen.fristen.neuerLieferbeginn).toBe("2027-11-06");
    expect(offen.tarifId).not.toBe("lumen-strom-12");
  });

  it("terminiert die Übermittlung, wenn der Lieferbeginn mehr als 6 Monate entfernt ist", async () => {
    const { fall, kunde } = auftrag("vollmacht");
    const v = repo.vertraegeVonKunde(kunde.id)[0];
    // Künstlich weit entfernter Lieferbeginn
    const f = repo.fallById(fall.id)!;
    f.fristen = { ...f.fristen, neuerLieferbeginn: "2027-09-01" };
    repo.fallSpeichern(f);
    await p.betreiberFreigeben(fall.id, "admin");
    expect(repo.fallById(fall.id)!.status).toBe("betreiber_freigegeben");
    await p.tageslauf("2027-03-01");
    expect(repo.fallById(fall.id)!.status).toBe("uebermittelt");
    expect(v).toBeDefined();
  });

  it("schlägt nach Ablehnung durch den Versorger eine Alternative vor", async () => {
    const { fall, kunde } = auftrag("vollmacht", "Ablehnung");
    await p.betreiberFreigeben(fall.id, "admin");
    const r = await p.tageslauf("2026-10-22");
    expect(repo.fallById(fall.id)!.status).toBe("abgelehnt_versorger");
    expect(r.aktionen.some((a) => a.includes("Vorschlag"))).toBe(true);
    const alternative = repo.faelleVonKunde(kunde.id).find((f) => f.status === "vorgeschlagen")!;
    expect(alternative.tarifId).not.toBe("lumen-strom-12");
  });

  it("verweigert die Betreiberfreigabe ohne aktive Vollmacht", async () => {
    const { fall, kunde } = auftrag("vollmacht");
    p.vollmachtWiderrufen(kunde.token);
    expect(repo.fallById(fall.id)!.status).toBe("abgelehnt_kunde");
    await expect(p.betreiberFreigeben(fall.id, "admin")).rejects.toThrow();
  });
});

describe("Erinnerungsmodus", () => {
  it("erstellt einen Partnerlink und keine Vollmacht", () => {
    const { kunde, fall } = auftrag("erinnerung");
    expect(fall.status).toBe("vorgeschlagen");
    expect(fall.deeplink).toContain("zipcode=10115");
    expect(repo.aktiveVollmacht(kunde.id)).toBeUndefined();
    expect(repo.postausgang(kunde.id)[0].text).toContain(fall.deeplink!);
  });

  it("übernimmt den selbst abgeschlossenen Vertrag zum Lieferbeginn", async () => {
    const { kunde, fall } = auftrag("erinnerung");
    p.kundeSelbstAbgeschlossen(kunde.token, fall.id, {
      versorgerName: "Irgendein Versorger", tarifName: "Tarif X", arbeitspreisCtBrutto: 31, grundpreisEurMonatBrutto: 12,
      lieferbeginn: "2026-12-01", erstlaufzeitMonate: 12, kuendigungsfristWochen: 4,
    });
    await p.tageslauf("2026-12-01");
    const aktiv = repo.vertraegeVonKunde(kunde.id).filter((v) => v.aktiv);
    expect(aktiv).toHaveLength(1);
    expect(aktiv[0].bestand.tarifName).toBe("Tarif X");
  });
});

describe("Preiserhöhung", () => {
  it("löst sofort einen Neuvergleich mit Sonderkündigung aus", async () => {
    const { kunde, fall } = auftrag("vollmacht");
    await p.betreiberFreigeben(fall.id, "admin");
    await p.tageslauf("2026-10-22");
    await p.tageslauf("2026-11-06");
    repo.einstellungSetzen("simuliertes_datum", "2027-02-01");
    const v = repo.vertraegeVonKunde(kunde.id).find((x) => x.aktiv)!;
    const ergebnis = p.preiserhoehungMelden(kunde.token, v.id, { arbeitspreisCtBrutto: 45, grundpreisEurMonatBrutto: 25, wirksamAb: "2027-03-15" });
    expect(ergebnis).toMatch(/Vorschlag/);
    const neu = repo.faelleVonKunde(kunde.id).find((f) => f.status === "vorgeschlagen")!;
    expect(neu.fristen.neuerLieferbeginn).toBe("2027-03-15");
  });
});
