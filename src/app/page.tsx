/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { RANKING_TRANSPARENZ } from "@/server/rechtstexte";
import { BILDER } from "./bilder";

export default function Startseite() {
  return (
    <>
      <section className="hero">
        <div>
          <h1>Nie wieder zu viel für Strom und Gas zahlen.</h1>
          <p className="lead">
            Switchandsave vergleicht jedes Jahr automatisch, findet den günstigsten seriösen Tarif und kümmert sich um den
            Wechsel. Kostenlos für Sie.
          </p>
          <div className="actions">
            <Link className="btn" href="/vergleich">
              Ersparnis berechnen
            </Link>
            <Link className="btn secondary" href="#so-funktionierts">
              So funktioniert&apos;s
            </Link>
          </div>
        </div>
        <figure style={{ margin: 0 }}>
          <img src={BILDER.hero.src} alt={BILDER.hero.alt} />
          <figcaption className="credit">
            Foto: <a href={BILDER.hero.seite}>{BILDER.hero.fotograf}</a> auf Unsplash
          </figcaption>
        </figure>
      </section>

      <h2 id="so-funktionierts">So funktioniert&apos;s</h2>
      <div className="grid-3">
        <div className="card">
          <div className="step-num">1</div>
          <h3>Rechnung abtippen</h3>
          <p className="muted">PLZ, Verbrauch und Preise aus Ihrer letzten Jahresabrechnung. Dauert drei Minuten.</p>
        </div>
        <div className="card">
          <div className="step-num">2</div>
          <h3>Ehrlich vergleichen</h3>
          <p className="muted">
            Ohne Vorkasse, Kaution, Pakettarife und Bonusfallen. Wir rechnen das erste und das zweite Jahr.
          </p>
        </div>
        <div className="card">
          <div className="step-num">3</div>
          <h3>Jedes Jahr automatisch</h3>
          <p className="muted">
            Wir überwachen Ihre Fristen und Preiserhöhungen und schlagen rechtzeitig den nächsten Wechsel vor.
          </p>
        </div>
      </div>

      <h2>Zwei Wege, Sie entscheiden</h2>
      <div className="grid-2">
        <div className="card highlight">
          <span className="badge">Empfohlen</span>
          <h3 style={{ marginTop: 8 }}>Rundum-Service mit Vollmacht</h3>
          <p className="muted">
            Sie erteilen uns einmalig eine widerrufbare Vollmacht. Wir wechseln für Sie, der neue Versorger kündigt den
            alten Vertrag. Jeder Abschluss wird vor dem Absenden von einem Menschen geprüft. Optional geben Sie Wechsel ab
            einer Mindestersparnis automatisch frei.
          </p>
        </div>
        <div className="card">
          <h3>Erinnerungsservice</h3>
          <p className="muted">
            Wir erinnern Sie rechtzeitig und schicken Ihnen einen vorausgefüllten Link zum Abschluss über unseren Partner
            CHECK24. Den Vertrag schließen Sie selbst ab.
          </p>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <figure style={{ margin: 0 }}>
          <img src={BILDER.wind.src} alt={BILDER.wind.alt} style={{ width: "100%", borderRadius: 12, aspectRatio: "16 / 9", objectFit: "cover" }} />
          <figcaption className="credit">
            Foto: <a href={BILDER.wind.seite}>{BILDER.wind.fotograf}</a> auf Unsplash
          </figcaption>
        </figure>
        <figure style={{ margin: 0 }}>
          <img src={BILDER.solar.src} alt={BILDER.solar.alt} style={{ width: "100%", borderRadius: 12, aspectRatio: "16 / 9", objectFit: "cover" }} />
          <figcaption className="credit">
            Foto: <a href={BILDER.solar.seite}>{BILDER.solar.fotograf}</a> auf Unsplash
          </figcaption>
        </figure>
      </div>

      <h2 id="transparenz">Transparenz</h2>
      <div className="card">
        <p style={{ marginTop: 0 }}>{RANKING_TRANSPARENZ}</p>
        <p className="muted" style={{ marginBottom: 0 }}>
          Unsere Standardfilter folgen den Empfehlungen der Verbraucherzentralen: keine Vorkasse, keine Kaution, höchstens
          12 Monate Erstlaufzeit, mindestens eingeschränkte Preisgarantie, keine Pakettarife, keine Versorger mit erhöhtem
          Ausfallrisiko.
        </p>
      </div>
    </>
  );
}
