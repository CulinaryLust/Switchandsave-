import Link from "next/link";
import { formatDe } from "@/domain/dates";
import { berechneFristen } from "@/domain/fristen";
import { berechneBestandskosten } from "@/domain/kosten";
import { findeNetzgebiet, netzgebietById } from "@/domain/netzgebiet";
import { vergleiche } from "@/domain/vergleich";
import { heute } from "@/server/prozess";
import { RANKING_TRANSPARENZ } from "@/server/rechtstexte";
import { bestandAusEingabe, ct, eur, parseVergleich, toQuery } from "../lib/eingabe";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ErgebnisSeite({ searchParams }: Props) {
  const params = await searchParams;
  const parsed = parseVergleich(params);
  if (!parsed.success) {
    return (
      <div className="notice bad">
        <h3>Bitte Eingaben prüfen</h3>
        <ul>
          {parsed.error.issues.map((i) => (
            <li key={i.path.join(".")}>
              {i.path.join(".")}: {i.message}
            </li>
          ))}
        </ul>
        <Link href="/vergleich">Zurück zur Eingabe</Link>
      </div>
    );
  }
  const e = parsed.data;
  const query = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])) as Record<string, string>;

  const gebiet = e.netz ? netzgebietById(e.netz) : undefined;
  const ergebnis = gebiet ? ({ status: "eindeutig", netzgebiet: gebiet, ort: "" } as const) : findeNetzgebiet(e.sparte, e.plz, e.strasse);

  if (ergebnis.status === "unbekannt") {
    return (
      <div className="notice warn">
        Für die PLZ {e.plz} liegen in der Demo keine Tarifdaten vor. <Link href="/vergleich">Andere PLZ wählen</Link>
      </div>
    );
  }
  if (ergebnis.status === "mehrdeutig") {
    return (
      <>
        <h1>Welches Netzgebiet?</h1>
        <p className="lead">
          Die PLZ {e.plz} ({ergebnis.ort}) wird von mehreren Netzbetreibern versorgt. Die Netzentgelte unterscheiden sich. Den
          Netzbetreiber finden Sie auf Ihrer Rechnung.
        </p>
        <div className="actions">
          {ergebnis.optionen.map((n) => (
            <Link key={n.id} className="btn secondary" href={`/ergebnis?${toQuery({ ...query, netz: n.id })}`}>
              {n.netzbetreiber} ({n.name})
            </Link>
          ))}
        </div>
      </>
    );
  }

  const netz = ergebnis.netzgebiet;
  const bestand = bestandAusEingabe(e);
  const bestandskosten = berechneBestandskosten(bestand, e.verbrauch);
  const stichtag = heute();
  const fristen = berechneFristen(bestand, stichtag);
  const { empfehlungen, ausgeschlossen } = vergleiche(netz, e.verbrauch, bestandskosten, undefined, e.basis);
  const beste = empfehlungen[0];

  return (
    <>
      <h1>Ihr Ergebnis</h1>
      <p className="muted">
        {e.sparte === "strom" ? "Strom" : "Gas"}, {e.verbrauch.toLocaleString("de-DE")} kWh/Jahr, Netzgebiet {netz.name} ({netz.netzbetreiber}).
        Ihre aktuellen Kosten: <strong>{eur(bestandskosten)}</strong> pro Jahr.
      </p>

      <div className="grid-2">
        <div className="card highlight">
          <div className="muted">Mögliche Ersparnis im ersten Jahr</div>
          <div className="big-number">{beste && beste.ersparnisErstesJahr > 0 ? eur(beste.ersparnisErstesJahr) : "0 €"}</div>
          {beste && (
            <div className="muted">
              ohne Bonus: {eur(beste.ersparnisOhneBonus)} · mit {beste.tarif.name}
            </div>
          )}
        </div>
        <div className="card">
          <h3>Ihre Fristen</h3>
          <dl className="kv">
            <dt>Frühester Wechsel zum</dt>
            <dd>{formatDe(fristen.neuerLieferbeginn)}</dd>
            <dt>Kündigung spätestens</dt>
            <dd>{formatDe(fristen.letzterKuendigungstag)} (übernimmt der neue Versorger)</dd>
          </dl>
          {fristen.begruendung.map((b) => (
            <p key={b} className="hint" style={{ marginBottom: 0 }}>
              {b}
            </p>
          ))}
        </div>
      </div>

      <div className="actions" style={{ margin: "24px 0 8px", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Empfohlene Tarife</h2>
        <div className="actions">
          <span className="hint">Sortiert nach:</span>
          <Link className={`btn small ${e.basis === "erstesJahr" ? "" : "secondary"}`} href={`/ergebnis?${toQuery({ ...query, basis: "erstesJahr" })}`}>
            1. Jahr inkl. Bonus
          </Link>
          <Link className={`btn small ${e.basis === "ohneBonus" ? "" : "secondary"}`} href={`/ergebnis?${toQuery({ ...query, basis: "ohneBonus" })}`}>
            ohne Bonus
          </Link>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tarif</th>
              <th className="num">Arbeitspreis</th>
              <th className="num">Grundpreis/Jahr</th>
              <th className="num">Bonus</th>
              <th className="num">Kosten 1. Jahr</th>
              <th className="num">Prognose 2. Jahr</th>
              <th className="num">Ersparnis</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {empfehlungen.map((emp, i) => {
              const bonusAnteil = emp.kosten.bonusImErstenJahr / emp.kosten.jahreskostenOhneBonus;
              return (
                <tr key={emp.tarif.id}>
                  <td>
                    <strong>{emp.tarif.name}</strong>
                    <div className="hint">
                      {emp.versorger.name} · {emp.tarif.erstlaufzeitMonate <= 1 ? "monatlich kündbar" : `${emp.tarif.erstlaufzeitMonate} Mon. Laufzeit`}
                      {emp.tarif.preisgarantieMonate > 0 && ` · Preisgarantie ${emp.tarif.preisgarantieMonate} Mon. (${emp.tarif.preisgarantie === "eingeschraenkt" ? "eingeschränkt" : emp.tarif.preisgarantie})`}
                    </div>
                    <div className="actions" style={{ marginTop: 4 }}>
                      {i === 0 && <span className="badge">Bester Preis</span>}
                      {emp.tarif.oeko && <span className="badge">Ökostrom</span>}
                      {bonusAnteil > 0.15 && <span className="badge warn">Bonuslastig: 2. Jahr deutlich teurer</span>}
                      {emp.versorger.bonitaet === "B" && <span className="badge gray">Bonität: mittel</span>}
                    </div>
                  </td>
                  <td className="num">{ct(emp.kosten.arbeitspreisCtBrutto)}</td>
                  <td className="num">{eur(emp.kosten.grundpreisEurJahrBrutto)}</td>
                  <td className="num">{emp.kosten.bonusImErstenJahr ? eur(emp.kosten.bonusImErstenJahr) : "–"}</td>
                  <td className="num">
                    <strong>{eur(emp.kosten.jahreskostenErstesJahr)}</strong>
                  </td>
                  <td className="num">{eur(emp.kosten.jahreskostenZweitesJahr)}</td>
                  <td className="num">{eur(e.basis === "erstesJahr" ? emp.ersparnisErstesJahr : emp.ersparnisOhneBonus)}</td>
                  <td>
                    {emp.ersparnisErstesJahr > 0 && (
                      <Link className="btn small" href={`/auftrag?${toQuery({ ...query, netz: netz.id, tarif: emp.tarif.id })}`}>
                        Wechseln
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="hint">
        Prognose 2. Jahr: ohne Bonus, gleicher Preis nach Ablauf der Preisgarantie (Annahme). Da wir jährlich neu vergleichen,
        zahlen Sie den Preis des 2. Jahres in der Regel nicht.
      </p>

      <details className="card" style={{ marginTop: 16 }}>
        <summary>{ausgeschlossen.length} Tarife ausgeschlossen, warum?</summary>
        <ul>
          {ausgeschlossen.map((a) => (
            <li key={a.tarif.id}>
              <strong>{a.tarif.name}</strong>: {a.gruende.join(", ")}
            </li>
          ))}
        </ul>
      </details>

      <div className="notice" style={{ marginTop: 16 }}>
        <strong>Transparenz:</strong> {RANKING_TRANSPARENZ}
      </div>
    </>
  );
}
