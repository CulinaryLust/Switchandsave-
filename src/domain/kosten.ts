import { ABGABEN } from "./demoData";
import type { BestandsVertrag, Kostenaufstellung, Netzgebiet, Tarif } from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Bruttopreise eines Tarifs im konkreten Netzgebiet. */
export function bruttoPreise(tarif: Tarif, netz: Netzgebiet) {
  const abgabenCt =
    tarif.sparte === "strom"
      ? ABGABEN.strom.stromsteuerCt + ABGABEN.strom.umlagenCt
      : ABGABEN.gas.energiesteuerCt + ABGABEN.gas.umlagenCt;
  const apNetto = tarif.energieArbeitspreisCtNetto + netz.netzArbeitspreisCtNetto + netz.konzessionsabgabeCtNetto + abgabenCt;
  const gpNetto = tarif.energieGrundpreisEurJahrNetto + netz.netzGrundpreisEurJahrNetto;
  const faktor = 1 + ABGABEN.mwstSatz;
  return {
    arbeitspreisCtBrutto: round2(apNetto * faktor),
    grundpreisEurJahrBrutto: round2(gpNetto * faktor),
  };
}

/**
 * Bonusbereinigung: Ein Sofortbonus fließt im ersten Jahr. Ein Neukundenbonus zählt nur, wenn er
 * spätestens nach 12 Monaten fällig wird; das setzt voraus, dass der Kunde frühestens dann wechselt
 * (siehe fristen.ts). Für Jahr 2 wird ohne Bonus und mit unverändertem Preis gerechnet.
 */
export function berechneKosten(tarif: Tarif, netz: Netzgebiet, jahresverbrauchKwh: number): Kostenaufstellung {
  const { arbeitspreisCtBrutto, grundpreisEurJahrBrutto } = bruttoPreise(tarif, netz);
  const ohneBonus = round2((arbeitspreisCtBrutto * jahresverbrauchKwh) / 100 + grundpreisEurJahrBrutto);
  const bonus = tarif.sofortbonusEur + (tarif.neukundenbonusNachMonaten <= 12 ? tarif.neukundenbonusEur : 0);
  return {
    arbeitspreisCtBrutto,
    grundpreisEurJahrBrutto,
    jahreskostenOhneBonus: ohneBonus,
    bonusImErstenJahr: bonus,
    jahreskostenErstesJahr: round2(ohneBonus - bonus),
    jahreskostenZweitesJahr: ohneBonus,
  };
}

/** Kosten des Bestandsvertrags aus den Rechnungsangaben (bereits brutto). */
export function berechneBestandskosten(vertrag: BestandsVertrag, jahresverbrauchKwh: number): number {
  return round2((vertrag.arbeitspreisCtBrutto * jahresverbrauchKwh) / 100 + vertrag.grundpreisEurMonatBrutto * 12);
}
