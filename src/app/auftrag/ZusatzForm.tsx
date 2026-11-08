"use client";

import { useActionState } from "react";
import { zusatzAuftragAction, type AuftragState } from "./actions";

export function ZusatzForm(props: { versteckt: Record<string, string>; vorname: string; modus: "vollmacht" | "erinnerung"; ibanMaskiert?: string; widerruf: string }) {
  const [state, action, pending] = useActionState<AuftragState, FormData>(zusatzAuftragAction, {});
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
        <legend>Ihre Daten übernehmen wir</legend>
        <p style={{ marginTop: 0 }}>
          {props.modus === "vollmacht"
            ? `Ihre bestehende Vollmacht und Ihr Dauerauftrag gelten auch für diesen Vertrag. Abbuchung wie bisher über ${props.ibanMaskiert ?? "Ihre hinterlegte IBAN"}.`
            : "Sie nutzen den Erinnerungsservice: Wir erinnern Sie rechtzeitig, Sie schließen selbst über unseren Partnerlink ab."}
        </p>
        <label className="check">
          <input type="checkbox" name="bestaetigung" required />
          <span>
            {props.modus === "vollmacht"
              ? "Ich beauftrage Switchandsave, auch diesen Vertrag zu wechseln und künftig jährlich zu betreuen."
              : "Bitte betreuen Sie auch diesen Vertrag mit dem Erinnerungsservice."}{" "}
            Es gelten die <a href="/rechtliches#agb">AGB</a>.
          </span>
        </label>
        <p className="hint">{props.widerruf}</p>
      </fieldset>
      <div>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Wird gesendet …" : props.modus === "vollmacht" ? "Wechsel kostenlos beauftragen" : "Vertrag hinzufügen"}
        </button>
      </div>
    </form>
  );
}
