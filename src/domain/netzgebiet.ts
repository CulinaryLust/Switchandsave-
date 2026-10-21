import { NETZGEBIETE, PLZ_ZUORDNUNG } from "./demoData";
import type { Netzgebiet, Sparte } from "./types";

export type NetzgebietErgebnis =
  | { status: "eindeutig"; netzgebiet: Netzgebiet; ort: string }
  | { status: "mehrdeutig"; optionen: Netzgebiet[]; ort: string }
  | { status: "unbekannt" };

function normalisiereStrasse(s: string): string {
  return s
    .toLowerCase()
    .replace(/str\.?(\s|$)/g, "straße$1")
    .replace(/strasse/g, "straße")
    .replace(/\s+\d.*$/, "")
    .trim();
}

/**
 * Eine PLZ kann mehrere Netzgebiete haben. Netzentgelte gelten pro Netzgebiet,
 * daher wird bei geteilten PLZ die Straße herangezogen. Passt keine Straßenliste,
 * gilt der Eintrag ohne Straßenliste als Standard für die PLZ.
 */
export function findeNetzgebiet(sparte: Sparte, plz: string, strasse = ""): NetzgebietErgebnis {
  const kandidaten = PLZ_ZUORDNUNG.filter(
    (z) => z.plz === plz && NETZGEBIETE.find((n) => n.id === z.netzgebietId)?.sparte === sparte,
  );
  if (kandidaten.length === 0) return { status: "unbekannt" };
  const ort = kandidaten[0].ort;
  const gebiet = (id: string) => NETZGEBIETE.find((n) => n.id === id)!;

  if (kandidaten.length === 1) return { status: "eindeutig", netzgebiet: gebiet(kandidaten[0].netzgebietId), ort };

  const s = normalisiereStrasse(strasse);
  if (s) {
    const treffer = kandidaten.find((k) => k.strassen?.some((st) => normalisiereStrasse(st) === s));
    if (treffer) return { status: "eindeutig", netzgebiet: gebiet(treffer.netzgebietId), ort };
    const standard = kandidaten.filter((k) => !k.strassen?.length);
    if (standard.length === 1) return { status: "eindeutig", netzgebiet: gebiet(standard[0].netzgebietId), ort };
  }
  return { status: "mehrdeutig", optionen: kandidaten.map((k) => gebiet(k.netzgebietId)), ort };
}

export function netzgebietById(id: string): Netzgebiet | undefined {
  return NETZGEBIETE.find((n) => n.id === id);
}
