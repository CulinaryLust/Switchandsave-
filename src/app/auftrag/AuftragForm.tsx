"use client";

import { useActionState, useState } from "react";
import { auftragAction, type AuftragState } from "./actions";

export function AuftragForm(props: { versteckt: Record<string, string>; vollmachtMoeglich: boolean; erinnerungMoeglich: boolean; vollmachtText: string; widerruf: string }) {
  const [state, action, pending] = useActionState<AuftragState, FormData>(auftragAction, {});
  const [modus, setModus] = useState(props.vollmachtMoeglich ? "vollmacht" : "erinnerung");
  const [auto, setAuto] = useState(false);

  return (
    <form className="stack" action={action}>
      {Object.entries(props.versteckt).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {state.fehler && (
        <div className="notice bad">
          <strong>Bitte prüfen:</strong>
          <ul style={{ margin: "6px 0 0" }}>
            {state.fehler.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <fieldset>
        <legend>Wie sollen wir wechseln?</legend>
        <div className="grid-2">
          <label className={`card check ${modus === "vollmacht" ? "highlight" : ""}`} style={{ opacity: props.vollmachtMoeglich ? 1 : 0.5 }}>
            <input type="radio" name="modus" value="vollmacht" checked={modus === "vollmacht"} disabled={!props.vollmachtMoeglich} onChange={() => setModus("vollmacht")} />
            <span>
              <strong>Rundum-Service mit Vollmacht</strong>
              <br />
              <span className="hint">Wir schließen ab und wechseln jedes Jahr für Sie. Jeder Abschluss wird vorher von einem Menschen geprüft.</span>
            </span>
          </label>
          <label className={`card check ${modus === "erinnerung" ? "highlight" : ""}`} style={{ opacity: props.erinnerungMoeglich ? 1 : 0.5 }}>
            <input type="radio" name="modus" value="erinnerung" checked={modus === "erinnerung"} disabled={!props.erinnerungMoeglich} onChange={() => setModus("erinnerung")} />
            <span>
              <strong>Erinnerungsservice</strong>
              <br />
              <span className="hint">Wir erinnern Sie rechtzeitig, Sie schließen selbst über unseren Partnerlink ab.</span>
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Ihre Daten</legend>
        <div className="fields">
          <label>
            Anrede
            <select name="anrede" defaultValue="Frau">
              <option>Frau</option>
              <option>Herr</option>
              <option>Divers</option>
            </select>
          </label>
          <label>
            Vorname
            <input name="vorname" required autoComplete="given-name" />
          </label>
          <label>
            Nachname
            <input name="nachname" required autoComplete="family-name" />
            <span className="hint">Demo: Nachname „Ablehnung“ simuliert eine Ablehnung durch den Versorger.</span>
          </label>
          <label>
            E-Mail
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            Telefon (optional)
            <input name="telefon" autoComplete="tel" />
          </label>
          <label>
            Geburtsdatum
            <input name="geburtsdatum" type="date" required />
          </label>
          {modus === "vollmacht" && (
            <label>
              IBAN für den neuen Versorger
              <input name="iban" required placeholder="DE02 1203 0000 0000 2020 51" autoComplete="off" />
            </label>
          )}
        </div>
      </fieldset>

      {modus === "vollmacht" && (
        <fieldset>
          <legend>Vollmacht und Dauerauftrag</legend>
          <pre className="mail">{props.vollmachtText}</pre>
          <label className="check" style={{ marginTop: 12 }}>
            <input type="checkbox" name="vollmacht" required />
            <span>Ich erteile Switchandsave die oben stehende Vollmacht. Ich kann sie jederzeit in meinem Konto widerrufen.</span>
          </label>
          <input type="hidden" name="autoFreigabe" value={auto ? "1" : "0"} />
          <label className="check">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            <span>Künftige Wechsel automatisch freigeben, wenn die Ersparnis mindestens diesen Betrag erreicht:</span>
          </label>
          {auto && (
            <label style={{ maxWidth: 220 }}>
              Mindestersparnis (€/Jahr)
              <input name="autoFreigabeAb" type="number" min={0} defaultValue={50} />
            </label>
          )}
        </fieldset>
      )}

      <fieldset>
        <legend>Einwilligungen</legend>
        <label className="check">
          <input type="checkbox" name="agb" required />
          <span>
            Ich akzeptiere die <a href="/rechtliches#agb">AGB</a> und habe die Widerrufsbelehrung zur Kenntnis genommen.
          </span>
        </label>
        <p className="hint">{props.widerruf}</p>
        <label className="check">
          <input type="checkbox" name="datenschutz" required />
          <span>
            Ich habe die <a href="/rechtliches#datenschutz">Datenschutzhinweise</a> gelesen. Meine Daten werden zur Vertragsvermittlung an
            PROCHECK24 und den neuen Versorger übermittelt.
          </span>
        </label>
      </fieldset>

      <div>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Wird gesendet …" : modus === "vollmacht" ? "Wechsel kostenlos beauftragen" : "Erinnerungsservice starten"}
        </button>
      </div>
    </form>
  );
}
