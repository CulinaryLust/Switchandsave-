import { TARIFE, VERSORGER } from "./demoData";
import { berechneKosten } from "./kosten";
import type { Ausschluss, Empfehlung, Filter, Netzgebiet, Preisgarantie, Tarif } from "./types";

/** Standardfilter nach Empfehlungen der Verbraucherzentralen. */
export const STANDARD_FILTER: Filter = {
  keineVorkasse: true,
  keineKaution: true,
  maxErstlaufzeitMonate: 12,
  mindestPreisgarantie: "eingeschraenkt",
  keinPaket: true,
  bonitaetAusschliessen: ["C"],
  nurOeko: false,
};

const GARANTIE_RANG: Record<Preisgarantie, number> = { keine: 0, eingeschraenkt: 1, voll: 2 };

export type Rankingbasis = "erstesJahr" | "ohneBonus";

export interface Vergleichsergebnis {
  empfehlungen: Empfehlung[];
  ausgeschlossen: Ausschluss[];
}

/** Alle Tarife, die im Netzgebiet lieferbar sind (Tarifquelle der Demo). */
export function verfuegbareTarife(netz: Netzgebiet): Tarif[] {
  return TARIFE.filter((t) => t.sparte === netz.sparte && (!t.netzgebietIds || t.netzgebietIds.includes(netz.id)));
}

export function ausschlussgruende(tarif: Tarif, filter: Filter): string[] {
  const versorger = VERSORGER.find((v) => v.id === tarif.versorgerId)!;
  const g: string[] = [];
  if (tarif.istGrundversorgung) g.push("Grundversorgung (Referenz, kein Wechselziel)");
  if (filter.keineVorkasse && tarif.vorkasse) g.push("Vorkasse");
  if (filter.keineKaution && tarif.kautionEur > 0) g.push(`Kaution ${tarif.kautionEur} €`);
  if (tarif.erstlaufzeitMonate > filter.maxErstlaufzeitMonate) g.push(`Erstlaufzeit ${tarif.erstlaufzeitMonate} Monate`);
  // Flexible Tarife (Laufzeit ≤ 1 Monat) brauchen keine Preisgarantie, sie sind jederzeit kündbar.
  if (tarif.erstlaufzeitMonate > 1 && GARANTIE_RANG[tarif.preisgarantie] < GARANTIE_RANG[filter.mindestPreisgarantie])
    g.push("Keine ausreichende Preisgarantie");
  if (filter.keinPaket && tarif.paket) g.push("Pakettarif");
  if (filter.bonitaetAusschliessen.includes(versorger.bonitaet)) g.push("Versorger mit erhöhtem Ausfallrisiko");
  if (filter.nurOeko && !tarif.oeko) g.push("Kein Ökotarif");
  if (tarif.kanaele.length === 0) g.push("Nicht über unsere Partner abschließbar");
  return g;
}

/**
 * Das Ranking basiert ausschließlich auf den Kosten für den Kunden. Die Vergütung (`verguetungEur`)
 * wird bewusst nicht gelesen; ein Test stellt das sicher.
 */
export function vergleiche(
  netz: Netzgebiet,
  jahresverbrauchKwh: number,
  bestandskosten: number,
  filter: Filter = STANDARD_FILTER,
  basis: Rankingbasis = "erstesJahr",
  tarife: Tarif[] = verfuegbareTarife(netz),
): Vergleichsergebnis {
  const empfehlungen: Empfehlung[] = [];
  const ausgeschlossen: Ausschluss[] = [];
  for (const tarif of tarife) {
    const gruende = ausschlussgruende(tarif, filter);
    if (gruende.length) {
      ausgeschlossen.push({ tarif, gruende });
      continue;
    }
    const kosten = berechneKosten(tarif, netz, jahresverbrauchKwh);
    empfehlungen.push({
      tarif,
      versorger: VERSORGER.find((v) => v.id === tarif.versorgerId)!,
      kosten,
      ersparnisErstesJahr: Math.round((bestandskosten - kosten.jahreskostenErstesJahr) * 100) / 100,
      ersparnisOhneBonus: Math.round((bestandskosten - kosten.jahreskostenOhneBonus) * 100) / 100,
    });
  }
  const key = (e: Empfehlung) => (basis === "erstesJahr" ? e.kosten.jahreskostenErstesJahr : e.kosten.jahreskostenOhneBonus);
  empfehlungen.sort((a, b) => key(a) - key(b) || a.kosten.jahreskostenOhneBonus - b.kosten.jahreskostenOhneBonus);
  return { empfehlungen, ausgeschlossen };
}
