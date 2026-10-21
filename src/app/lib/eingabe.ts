import { z } from "zod";
import type { BestandsVertrag, Sparte } from "@/domain/types";

const zahl = (min: number, max: number) => z.preprocess((v) => (typeof v === "string" ? Number(v.replace(",", ".")) : v), z.number().min(min).max(max));
const datum = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format JJJJ-MM-TT");

/** Eingaben des Vergleichs, wie sie als Query-Parameter von Seite zu Seite gereicht werden. */
export const VergleichSchema = z.object({
  sparte: z.enum(["strom", "gas"]),
  plz: z.string().regex(/^\d{5}$/, "Fünfstellige PLZ"),
  strasse: z.string().max(120).default(""),
  verbrauch: zahl(100, 100_000),
  netz: z.string().optional(),
  versorger: z.string().min(1).max(120),
  tarifname: z.string().max(120).default(""),
  gv: z.enum(["0", "1"]).default("0"),
  ap: zahl(1, 200),
  gp: zahl(0, 200),
  beginn: datum,
  laufzeit: zahl(0, 36),
  frist: zahl(0, 13),
  bonus: z.union([datum, z.literal("")]).optional(),
  basis: z.enum(["erstesJahr", "ohneBonus"]).default("erstesJahr"),
});

export type VergleichEingabe = z.infer<typeof VergleichSchema>;

export function parseVergleich(params: Record<string, string | string[] | undefined>) {
  const flat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  return VergleichSchema.safeParse(flat);
}

export function toQuery(e: Partial<Record<keyof VergleichEingabe, string | number | undefined>> & Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(e)) if (v !== undefined && v !== "") q.set(k, String(v));
  return q.toString();
}

export function bestandAusEingabe(e: VergleichEingabe): BestandsVertrag {
  const gv = e.gv === "1";
  return {
    sparte: e.sparte as Sparte,
    versorgerName: e.versorger,
    tarifName: e.tarifname || (gv ? "Grundversorgung" : "unbekannt"),
    istGrundversorgung: gv,
    arbeitspreisCtBrutto: e.ap,
    grundpreisEurMonatBrutto: e.gp,
    lieferbeginn: e.beginn,
    erstlaufzeitMonate: gv ? 0 : e.laufzeit,
    kuendigungsfristWochen: gv ? 2 : e.frist,
    bonusFaelligAm: e.bonus || undefined,
  };
}

export const eur = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
export const ct = (n: number) => `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ct`;
