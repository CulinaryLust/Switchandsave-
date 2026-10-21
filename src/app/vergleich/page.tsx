export default function VergleichSeite() {
  return (
    <>
      <h1>Ihre aktuelle Rechnung</h1>
      <p className="lead">Alle Angaben finden Sie auf Ihrer letzten Jahresabrechnung. Preise bitte brutto (inkl. MwSt.).</p>
      <div className="notice warn" style={{ marginBottom: 16 }}>
        Demo: Tarifdaten liegen für die PLZ <strong>10115</strong> (Berlin), <strong>80331</strong> (München) und{" "}
        <strong>50999</strong> (Köln, zwei Stromnetzgebiete: z.B. „Hauptstraße“ vs. „Ringstraße“) vor.
      </div>
      <form className="stack" action="/ergebnis" method="get">
        <fieldset>
          <legend>Verbrauchsstelle</legend>
          <div className="fields">
            <label>
              Sparte
              <select name="sparte" defaultValue="strom">
                <option value="strom">Strom</option>
                <option value="gas">Gas</option>
              </select>
            </label>
            <label>
              PLZ
              <input name="plz" required pattern="\d{5}" defaultValue="10115" inputMode="numeric" />
            </label>
            <label>
              Straße und Hausnummer
              <input name="strasse" defaultValue="Invalidenstraße 1" />
              <span className="hint">Eine PLZ kann mehrere Netzgebiete haben.</span>
            </label>
            <label>
              Jahresverbrauch (kWh)
              <input name="verbrauch" type="number" min={100} required defaultValue={2500} />
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Aktueller Vertrag</legend>
          <div className="fields">
            <label>
              Versorger
              <input name="versorger" required defaultValue="Örtlicher Grundversorger" />
            </label>
            <label>
              Tarifname
              <input name="tarifname" defaultValue="Grundversorgung" />
            </label>
            <label>
              Grundversorgung?
              <select name="gv" defaultValue="1">
                <option value="1">Ja</option>
                <option value="0">Nein, Sondervertrag</option>
              </select>
            </label>
            <label>
              Arbeitspreis (ct/kWh, brutto)
              <input name="ap" required inputMode="decimal" defaultValue="40,09" />
            </label>
            <label>
              Grundpreis (€/Monat, brutto)
              <input name="gp" required inputMode="decimal" defaultValue="20,83" />
            </label>
            <label>
              Lieferbeginn
              <input name="beginn" type="date" required defaultValue="2019-01-01" />
            </label>
            <label>
              Erstlaufzeit (Monate)
              <input name="laufzeit" type="number" min={0} max={36} defaultValue={12} />
            </label>
            <label>
              Kündigungsfrist (Wochen)
              <input name="frist" type="number" min={0} max={13} defaultValue={4} />
            </label>
            <label>
              Bonus fällig am (optional)
              <input name="bonus" type="date" />
              <span className="hint">Wir wechseln erst danach, damit Ihr Bonus nicht verfällt.</span>
            </label>
          </div>
        </fieldset>
        <div>
          <button className="btn" type="submit">
            Tarife vergleichen
          </button>
        </div>
      </form>
    </>
  );
}
