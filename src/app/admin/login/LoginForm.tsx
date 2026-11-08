"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ zweiterFaktor }: { zweiterFaktor: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form className="stack" action={action}>
      {state.fehler && <div className="notice bad">{state.fehler}</div>}
      <fieldset>
        <legend>Anmeldung</legend>
        <div className="stack">
          <label>
            Benutzer
            <input name="benutzer" required autoComplete="username" defaultValue={state.benutzer} key={state.benutzer} />
          </label>
          <label>
            Passwort
            <input name="passwort" type="password" required autoComplete="current-password" />
          </label>
          {zweiterFaktor && (
            <label>
              Code aus der Authenticator-App
              <input name="code" required inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" />
            </label>
          )}
        </div>
      </fieldset>
      <div>
        <button className="btn" disabled={pending}>
          {pending ? "Prüfe …" : "Anmelden"}
        </button>
      </div>
    </form>
  );
}
