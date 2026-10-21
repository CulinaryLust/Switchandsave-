import { BILDER } from "../bilder";
import { RANKING_TRANSPARENZ, WIDERRUFSBELEHRUNG_KURZ } from "@/server/rechtstexte";

export default function Rechtliches() {
  return (
    <>
      <div className="notice warn">Platzhalter. Alle Texte müssen vor dem Livebetrieb anwaltlich erstellt bzw. geprüft werden.</div>
      <h2 id="impressum">Impressum</h2>
      <p>Switchandsave, [Name, Rechtsform, Anschrift], [E-Mail, Telefon], [Gewerbeanmeldung/Registereintrag], [USt-IdNr.]</p>
      <h2 id="datenschutz">Datenschutz</h2>
      <p>
        Verantwortlicher: [siehe Impressum]. Zwecke: Tarifvergleich, Vermittlung und Durchführung des Anbieterwechsels (Art. 6 Abs. 1 lit. b
        DSGVO). Empfänger: PROCHECK24 GmbH als Vermittlungsplattform, der jeweils neue Versorger. Speicherdauer, Betroffenenrechte,
        Auftragsverarbeiter (Hosting, E-Mail) und Cookies: [zu ergänzen].
      </p>
      <h2 id="agb">AGB und Widerruf</h2>
      <p>[AGB des Wechselservice: Leistungsumfang, Vollmacht, Kostenfreiheit, Haftung, Kündigung des Service]</p>
      <p>{WIDERRUFSBELEHRUNG_KURZ}</p>
      <h3>Ranking und Vergütung</h3>
      <p>{RANKING_TRANSPARENZ}</p>
      <h2 id="bildnachweise">Bildnachweise</h2>
      <ul>
        {Object.values(BILDER).map((b) => (
          <li key={b.src}>
            {b.alt}: Foto von <a href={b.seite}>{b.fotograf}</a> auf Unsplash (Unsplash-Lizenz)
          </li>
        ))}
      </ul>
    </>
  );
}
