"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { NETZGEBIETE, PLZ_ZUORDNUNG, TARIFE } from "@/domain/demoData";
import { berechneKosten } from "@/domain/kosten";
import { vergleiche } from "@/domain/vergleich";

const REGIONEN = [
  { plz: "10115", name: "Berlin" },
  { plz: "80331", name: "München" },
  { plz: "50999", name: "Köln" },
];
const VORGABE = { strom: 2500, gas: 12000 };
const SPANNE = { strom: [800, 8000, 100], gas: [3000, 35000, 500] } as const;
const eur = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function Ersparnisrechner() {
  const [sparte, setSparte] = useState<"strom" | "gas">("strom");
  const [plz, setPlz] = useState("10115");
  const [verbrauch, setVerbrauch] = useState(VORGABE.strom);

  const r = useMemo(() => {
    const netzId = PLZ_ZUORDNUNG.find((z) => z.plz === plz && NETZGEBIETE.find((n) => n.id === z.netzgebietId)?.sparte === sparte)!.netzgebietId;
    const netz = NETZGEBIETE.find((n) => n.id === netzId)!;
    const gv = TARIFE.find((t) => t.id === netz.grundversorgerTarifId)!;
    const gvKosten = berechneKosten(gv, netz, verbrauch);
    const beste = vergleiche(netz, verbrauch, gvKosten.jahreskostenOhneBonus).empfehlungen[0];
    return {
      gvKosten,
      ersparnis: Math.max(0, beste?.ersparnisErstesJahr ?? 0),
      ersparnisOhneBonus: Math.max(0, beste?.ersparnisOhneBonus ?? 0),
      link: `/vergleich?${new URLSearchParams({
        sparte,
        plz,
        strasse: "",
        verbrauch: String(verbrauch),
        gv: "1",
        versorger: "Örtlicher Grundversorger",
        tarifname: "Grundversorgung",
        ap: gvKosten.arbeitspreisCtBrutto.toFixed(2).replace(".", ","),
        gp: (gvKosten.grundpreisEurJahrBrutto / 12).toFixed(2).replace(".", ","),
      })}`,
    };
  }, [sparte, plz, verbrauch]);

  const [min, max, schritt] = SPANNE[sparte];
  return (
    <div className="card rechner">
      <div className="rechner-eingabe">
        <div className="segment" role="group" aria-label="Sparte">
          {(["strom", "gas"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sparte === s}
              onClick={() => {
                setSparte(s);
                setVerbrauch(VORGABE[s]);
              }}
            >
              {s === "strom" ? "Strom" : "Gas"}
            </button>
          ))}
        </div>
        <label>
          Region (Demo)
          <select value={plz} onChange={(e) => setPlz(e.target.value)}>
            {REGIONEN.map((x) => (
              <option key={x.plz} value={x.plz}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Jahresverbrauch: {verbrauch.toLocaleString("de-DE")} kWh
          <input type="range" min={min} max={max} step={schritt} value={verbrauch} onChange={(e) => setVerbrauch(Number(e.target.value))} />
          <span className="hint">{sparte === "strom" ? "1 Person ca. 1.500, 4 Personen ca. 4.000 kWh" : "Wohnung ca. 8.000, Haus ca. 20.000 kWh"}</span>
        </label>
      </div>
      <div className="rechner-ergebnis" aria-live="polite">
        <div className="muted">Mögliche Ersparnis im ersten Jahr gegenüber der Grundversorgung</div>
        <div className="big-number">{eur(r.ersparnis)}</div>
        <div className="hint">
          Davon ohne Bonus, also auch im zweiten Jahr: {eur(r.ersparnisOhneBonus)}. Grundversorgung heute: {eur(r.gvKosten.jahreskostenOhneBonus)} pro Jahr.
        </div>
        <Link className="btn" href={r.link} style={{ marginTop: 12 }}>
          Mit meinen Zahlen rechnen
        </Link>
      </div>
    </div>
  );
}
