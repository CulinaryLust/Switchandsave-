import { notFound } from "next/navigation";
import { formatDe } from "@/domain/dates";
import { TARIFE, VERSORGER } from "@/domain/demoData";
import { STATUS_TEXT, type Status } from "@/domain/wechselfall";
import { heute } from "@/server/prozess";
import * as repo from "@/server/repo";
import { ct, eur } from "../../lib/eingabe";
import { ablehnen, dauerauftrag, freigeben, preiserhoehung, selbstAbgeschlossen, widerrufen } from "./actions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ neu?: string; meldung?: string }> };

const badge = (s: Status) =>
  s === "abgeschlossen" || s === "bestaetigt" ? "badge" : s.startsWith("abgelehnt") || s === "abgelaufen" ? "badge bad" : "badge warn";

export default async function KontoSeite({ params, searchParams }: Props) {
  const { token } = await params;
  const { neu, meldung } = await searchParams;
  const kunde = repo.kundeByToken(token);
  if (!kunde) notFound();

  const vertraege = repo.vertraegeVonKunde(kunde.id);
  const faelle = repo.faelleVonKunde(kunde.id);
  const nachrichten = repo.postausgang(kunde.id, 20);
  const vollmacht = repo.aktiveVollmacht(kunde.id);
  const tarif = (id: string) => TARIFE.find((t) => t.id === id)!;
  const versorger = (id: string) => VERSORGER.find((v) => v.id === id)!.name;
  const hidden = <input type="hidden" name="token" value={token} />;

  return (
    <>
      <h1>Hallo {kunde.vorname}</h1>
      <p className="muted">
        {kunde.modus === "vollmacht" ? "Rundum-Service mit Vollmacht" : "Erinnerungsservice"} · Stand {formatDe(heute())}
      </p>
      {neu && <div className="notice">Ihr Auftrag ist eingegangen. Diese Seite ist Ihr persönliches Kundenkonto; den Link haben wir Ihnen auch per E-Mail geschickt.</div>}
      {meldung && <div className={`notice ${meldung.startsWith("Fehler") ? "bad" : ""}`} style={{ marginTop: 8 }}>{meldung}</div>}

      <h2>Wechsel</h2>
      {faelle.length === 0 && <p className="muted">Aktuell kein Wechsel offen. Wir prüfen automatisch weiter.</p>}
      <div className="grid-2">
        {faelle.map((f) => {
          const t = tarif(f.tarifId);
          return (
            <div key={f.id} className="card">
              <span className={badge(f.status)}>{STATUS_TEXT[f.status]}</span>
              <h3 style={{ marginTop: 8 }}>
                {t.name} <span className="muted">· {versorger(t.versorgerId)}</span>
              </h3>
              <dl className="kv">
                <dt>Ersparnis 1. Jahr</dt>
                <dd>{eur(f.ersparnisErstesJahr)}</dd>
                <dt>Neuer Lieferbeginn</dt>
                <dd>{formatDe(f.fristen.neuerLieferbeginn)}</dd>
                {f.externeReferenz && (
                  <>
                    <dt>Antragsnummer</dt>
                    <dd>{f.externeReferenz}</dd>
                  </>
                )}
              </dl>
              {f.status === "vorgeschlagen" && f.modus === "vollmacht" && (
                <div className="actions" style={{ marginTop: 12 }}>
                  <form action={freigeben}>
                    {hidden}
                    <input type="hidden" name="fall" value={f.id} />
                    <button className="btn small">Wechsel freigeben</button>
                  </form>
                  <form action={ablehnen}>
                    {hidden}
                    <input type="hidden" name="fall" value={f.id} />
                    <button className="btn small secondary">Nicht wechseln</button>
                  </form>
                </div>
              )}
              {f.status === "kunde_freigegeben" && (
                <form action={ablehnen} style={{ marginTop: 12 }}>
                  {hidden}
                  <input type="hidden" name="fall" value={f.id} />
                  <button className="btn small secondary">Wechsel stoppen</button>
                </form>
              )}
              {f.status === "vorgeschlagen" && f.modus === "erinnerung" && (
                <div style={{ marginTop: 12 }}>
                  <p className="hint">Bitte bis {formatDe(f.fristen.letzterKuendigungstag)} abschließen.</p>
                  <a className="btn small" href={f.deeplink} target="_blank" rel="noopener sponsored">
                    Jetzt bei CHECK24 abschließen
                  </a>
                  <details style={{ marginTop: 12 }}>
                    <summary>Ich habe abgeschlossen</summary>
                    <form action={selbstAbgeschlossen} className="stack" style={{ marginTop: 8 }}>
                      {hidden}
                      <input type="hidden" name="fall" value={f.id} />
                      <div className="fields">
                        <label>Versorger<input name="versorger" required /></label>
                        <label>Tarif<input name="tarifname" required /></label>
                        <label>Arbeitspreis ct/kWh<input name="ap" required inputMode="decimal" /></label>
                        <label>Grundpreis €/Monat<input name="gp" required inputMode="decimal" /></label>
                        <label>Lieferbeginn<input name="beginn" type="date" required /></label>
                        <label>Laufzeit (Monate)<input name="laufzeit" type="number" defaultValue={12} /></label>
                        <label>Kündigungsfrist (Wochen)<input name="frist" type="number" defaultValue={4} /></label>
                        <label>Bonus fällig am<input name="bonus" type="date" /></label>
                      </div>
                      <button className="btn small">Speichern</button>
                    </form>
                  </details>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <h2>Ihre Verträge</h2>
      <div className="grid-2">
        {vertraege.map((v) => (
          <div key={v.id} className="card">
            <span className={v.aktiv ? "badge" : "badge gray"}>{v.aktiv ? "Aktiv" : "Beendet"}</span>
            <h3 style={{ marginTop: 8 }}>
              {v.stelle.sparte === "strom" ? "Strom" : "Gas"}: {v.bestand.versorgerName}
            </h3>
            <dl className="kv">
              <dt>Tarif</dt>
              <dd>{v.bestand.tarifName}</dd>
              <dt>Preise</dt>
              <dd>
                {ct(v.bestand.arbeitspreisCtBrutto)}/kWh · {eur(v.bestand.grundpreisEurMonatBrutto)}/Monat
              </dd>
              <dt>Lieferbeginn</dt>
              <dd>{formatDe(v.bestand.lieferbeginn)}</dd>
              {v.bestand.bonusFaelligAm && (
                <>
                  <dt>Bonus fällig</dt>
                  <dd>{formatDe(v.bestand.bonusFaelligAm)}</dd>
                </>
              )}
              <dt>Verbrauchsstelle</dt>
              <dd>
                {v.stelle.strasse}, {v.stelle.plz} · {v.stelle.jahresverbrauchKwh.toLocaleString("de-DE")} kWh
              </dd>
            </dl>
            {v.aktiv && (
              <details style={{ marginTop: 12 }}>
                <summary>Preiserhöhung erhalten?</summary>
                <form action={preiserhoehung} className="stack" style={{ marginTop: 8 }}>
                  {hidden}
                  <input type="hidden" name="vertrag" value={v.id} />
                  <div className="fields">
                    <label>Neuer Arbeitspreis ct/kWh<input name="ap" required inputMode="decimal" /></label>
                    <label>Neuer Grundpreis €/Monat<input name="gp" required inputMode="decimal" /></label>
                    <label>Gültig ab<input name="wirksam" type="date" required /></label>
                  </div>
                  <p className="hint">Bei einer Preiserhöhung haben Sie ein Sonderkündigungsrecht. Wir vergleichen sofort neu.</p>
                  <button className="btn small">Melden und neu vergleichen</button>
                </form>
              </details>
            )}
          </div>
        ))}
      </div>

      {kunde.modus === "vollmacht" && (
        <>
          <h2>Vollmacht und Dauerauftrag</h2>
          <div className="card">
            {vollmacht && (
              <p style={{ marginTop: 0 }}>
                Vollmacht erteilt am {formatDe(vollmacht.erteilt_am.slice(0, 10))} (Version {vollmacht.version}). IBAN: {kunde.ibanMaskiert}
              </p>
            )}
            <form action={dauerauftrag} className="actions">
              {hidden}
              <label style={{ maxWidth: 320 }}>
                Wechsel automatisch freigeben ab Ersparnis (€/Jahr, leer = immer fragen)
                <input name="ab" type="number" min={0} defaultValue={kunde.autoFreigabeAbEur ?? ""} />
              </label>
              <button className="btn small secondary" style={{ alignSelf: "end" }}>
                Speichern
              </button>
            </form>
            <form action={widerrufen} style={{ marginTop: 16 }}>
              {hidden}
              <button className="btn small danger">Vollmacht widerrufen</button>
            </form>
          </div>
        </>
      )}

      <h2>Nachrichten</h2>
      {nachrichten.map((m) => (
        <details key={m.id} className="card" style={{ marginBottom: 8 }}>
          <summary>
            {m.betreff} <span className="hint">· {new Date(m.zeitpunkt).toLocaleString("de-DE")}</span>
          </summary>
          <pre className="mail">{m.text}</pre>
        </details>
      ))}
    </>
  );
}
