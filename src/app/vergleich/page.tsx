import Link from "next/link";
import * as repo from "@/server/repo";
import { auslesenVerfuegbar } from "@/server/rechnung";
import { VergleichForm } from "./VergleichForm";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const eins = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function VergleichSeite({ searchParams }: Props) {
  const params = await searchParams;
  const konto = eins(params.konto);
  const kunde = konto ? repo.kundeByToken(konto) : undefined;
  if (konto && !kunde) {
    return (
      <div className="notice bad">
        Kundenkonto nicht gefunden. <Link href="/vergleich">Neuen Vergleich starten</Link>
      </div>
    );
  }
  const sparte = eins(params.sparte) === "gas" ? "gas" : "strom";
  const start: Record<string, string> = {};
  for (const k of ["sparte", "plz", "strasse", "verbrauch", "gv", "versorger", "tarifname", "ap", "gp"]) {
    const v = eins(params[k]);
    if (v !== undefined) start[k] = v;
  }
  // Demo-Beispielwerte für Gas statt der Strom-Vorgaben.
  if (sparte === "gas" && !start.ap) Object.assign(start, { verbrauch: start.verbrauch ?? "12000", ap: "12,49", gp: "15,47", tarifname: "Grundversorgung Gas" });

  return (
    <>
      <h1>{kunde ? `${sparte === "gas" ? "Gas" : "Strom"}vertrag hinzufügen` : "Ihre aktuelle Rechnung"}</h1>
      <p className="lead">
        {kunde
          ? `Hallo ${kunde.vorname}, Ihre persönlichen Daten${kunde.modus === "vollmacht" ? " und Ihre Vollmacht" : ""} übernehmen wir. Wir brauchen nur die Angaben aus Ihrer ${sparte === "gas" ? "Gas" : "Strom"}rechnung.`
          : "Alle Angaben finden Sie auf Ihrer letzten Jahresabrechnung. Preise bitte brutto (inkl. MwSt.)."}
      </p>
      <div className="notice warn" style={{ marginBottom: 16 }}>
        Demo: Tarifdaten liegen für die PLZ <strong>10115</strong> (Berlin), <strong>80331</strong> (München) und{" "}
        <strong>50999</strong> (Köln, zwei Stromnetzgebiete: z.B. „Hauptstraße“ vs. „Ringstraße“) vor.
      </div>
      <VergleichForm start={start} konto={kunde ? konto : undefined} spartenFest={!!kunde} auslesenVerfuegbar={auslesenVerfuegbar()} />
    </>
  );
}
