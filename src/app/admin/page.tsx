import Link from "next/link";
import { formatDe } from "@/domain/dates";
import { TARIFE, VERSORGER } from "@/domain/demoData";
import { STATUS_TEXT } from "@/domain/wechselfall";
import { abschlusskanal } from "@/server/kanaele";
import { heute } from "@/server/prozess";
import * as repo from "@/server/repo";
import { eur } from "../lib/eingabe";
import { ablehnen, datumSetzen, freigeben, tageslauf, vorspulen } from "./actions";

export const dynamic = "force-dynamic";

const tarif = (id: string) => TARIFE.find((t) => t.id === id)!;
const versorger = (id: string) => VERSORGER.find((v) => v.id === id)!;

export default async function AdminSeite({ searchParams }: { searchParams: Promise<{ meldung?: string }> }) {
  const { meldung } = await searchParams;
  const stichtag = heute();
  const simuliert = repo.einstellung("simuliertes_datum");
  const queue = repo.faelleNachStatus(["kunde_freigegeben"]);
  const faelle = repo.alleFaelle();
  const kunden = repo.alleKunden();
  const mails = repo.postausgang(undefined, 15);
  const protokoll = repo.protokollVon({ limit: 40 });
  const kanal = abschlusskanal();

  const vermittelt = faelle.filter((f) => f.modus === "vollmacht" && ["uebermittelt", "bestaetigt", "abgeschlossen"].includes(f.status));
  const erwarteteVerguetung = vermittelt.reduce((s, f) => s + tarif(f.tarifId).verguetungEur, 0);

  return (
    <>
      <h1>Betreiberbereich</h1>
      <p className="muted">
        Stichtag {formatDe(stichtag)} {simuliert && <span className="badge warn">simuliert</span>} · Abschlusskanal {kanal.name}{" "}
        {kanal.simuliert && <span className="badge warn">Simulationsmodus</span>}
      </p>
      {meldung && <div className={`notice ${meldung.startsWith("Fehler") ? "bad" : ""}`}>{meldung}</div>}

      <div className="grid-3" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="muted">Kunden</div>
          <div className="big-number">{kunden.length}</div>
        </div>
        <div className="card">
          <div className="muted">Warten auf Freigabe</div>
          <div className="big-number">{queue.length}</div>
        </div>
        <div className="card">
          <div className="muted">Erwartete Vergütung (Demo)</div>
          <div className="big-number">{eur(erwarteteVerguetung)}</div>
          <div className="hint">{vermittelt.length} übermittelte Wechsel</div>
        </div>
      </div>

      <h2>Freigabe-Warteschlange</h2>
      {queue.length === 0 && <p className="muted">Nichts zu prüfen.</p>}
      <div className="grid-2">
        {queue.map((f) => {
          const k = repo.kundeById(f.kundeId)!;
          const v = repo.vertragById(f.vertragId)!;
          const t = tarif(f.tarifId);
          const vollmacht = repo.aktiveVollmacht(k.id);
          const pruefung: [string, boolean][] = [
            ["Aktive Vollmacht", !!vollmacht],
            ["IBAN hinterlegt", !!k.iban],
            [`Ersparnis ≥ 30 € (${eur(f.ersparnisErstesJahr)})`, f.ersparnisErstesJahr >= 30],
            [`Versorgerbonität ${versorger(t.versorgerId).bonitaet}`, versorger(t.versorgerId).bonitaet !== "C"],
            [`Lieferbeginn ${formatDe(f.fristen.neuerLieferbeginn)} nicht in der Vergangenheit`, f.fristen.neuerLieferbeginn > stichtag],
          ];
          return (
            <div key={f.id} className="card">
              <h3>
                {k.vorname} {k.nachname} <span className="muted">· {v.stelle.sparte}</span>
              </h3>
              <dl className="kv">
                <dt>Von</dt>
                <dd>
                  {v.bestand.versorgerName} ({eur(f.bestandskosten)}/Jahr)
                </dd>
                <dt>Nach</dt>
                <dd>
                  {t.name}, {versorger(t.versorgerId).name} ({eur(f.kosten.jahreskostenErstesJahr)} im 1. Jahr)
                </dd>
                <dt>Verbrauchsstelle</dt>
                <dd>
                  {v.stelle.strasse}, {v.stelle.plz}
                </dd>
                <dt>Freigabe durch</dt>
                <dd>{k.autoFreigabeAbEur !== undefined ? `Dauerauftrag ab ${eur(k.autoFreigabeAbEur)}` : "Kunde"}</dd>
              </dl>
              <ul style={{ paddingLeft: 18 }}>
                {pruefung.map(([text, ok]) => (
                  <li key={text} style={{ color: ok ? "inherit" : "var(--bad)" }}>
                    {ok ? "✓" : "✗"} {text}
                  </li>
                ))}
              </ul>
              <div className="actions">
                <form action={freigeben}>
                  <input type="hidden" name="fall" value={f.id} />
                  <button className="btn small" disabled={!pruefung.every(([, ok]) => ok)}>
                    Freigeben und übermitteln
                  </button>
                </form>
                <form action={ablehnen} className="actions">
                  <input type="hidden" name="fall" value={f.id} />
                  <input name="grund" placeholder="Grund" style={{ width: 160 }} />
                  <button className="btn small secondary">Ablehnen</button>
                </form>
              </div>
            </div>
          );
        })}
      </div>

      <h2>Automatik und Zeitsimulation</h2>
      <div className="grid-3">
        <form action={tageslauf} className="card stack">
          <strong>Tageslauf jetzt ausführen</strong>
          <span className="hint">Läuft im Betrieb täglich per Cron über /api/cron/daily.</span>
          <button className="btn small">Ausführen</button>
        </form>
        <form action={datumSetzen} className="card stack">
          <label>
            Simuliertes Datum
            <input name="datum" type="date" defaultValue={simuliert ?? ""} />
          </label>
          <button className="btn small secondary">Setzen (leer = echtes Datum)</button>
        </form>
        <form action={vorspulen} className="card stack">
          <label>
            Vorspulen bis (mit täglichem Lauf)
            <input name="bis" type="date" required />
          </label>
          <button className="btn small secondary">Vorspulen</button>
        </form>
      </div>

      <h2>Alle Wechselfälle</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kunde</th>
              <th>Modus</th>
              <th>Tarif</th>
              <th>Status</th>
              <th className="num">Ersparnis</th>
              <th>Lieferbeginn</th>
            </tr>
          </thead>
          <tbody>
            {faelle.map((f) => {
              const k = repo.kundeById(f.kundeId)!;
              return (
                <tr key={f.id}>
                  <td>
                    <Link href={`/konto/${k.token}`}>
                      {k.vorname} {k.nachname}
                    </Link>
                  </td>
                  <td>{f.modus}</td>
                  <td>{tarif(f.tarifId).name}</td>
                  <td>{STATUS_TEXT[f.status]}</td>
                  <td className="num">{eur(f.ersparnisErstesJahr)}</td>
                  <td>{formatDe(f.fristen.neuerLieferbeginn)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div>
          <h2>Postausgang</h2>
          {mails.map((m) => (
            <details key={m.id} className="card" style={{ marginBottom: 8 }}>
              <summary>
                {m.an}: {m.betreff}
              </summary>
              <pre className="mail">{m.text}</pre>
            </details>
          ))}
        </div>
        <div>
          <h2>Protokoll</h2>
          <div className="table-wrap">
            <table>
              <tbody>
                {protokoll.map((e) => (
                  <tr key={e.id}>
                    <td className="hint">{new Date(e.zeitpunkt).toLocaleString("de-DE")}</td>
                    <td>{e.typ}</td>
                    <td className="hint">{e.akteur}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
