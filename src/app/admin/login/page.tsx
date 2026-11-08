import { anmeldeKonfiguration } from "@/server/sicherheit/anmeldung";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginSeite() {
  const k = anmeldeKonfiguration();
  return (
    <div style={{ maxWidth: 420, margin: "0 auto" }}>
      <h1>Betreiberbereich</h1>
      {k.fehler && <div className="notice bad">Anmeldung gesperrt: {k.fehler}</div>}
      {!k.fehler && !k.zweiterFaktorAktiv && (
        <div className="notice warn" style={{ marginBottom: 16 }}>
          Entwicklungsmodus: Zweiter Faktor ist noch nicht eingerichtet. Mit <code>npm run einrichten</code> aktivieren. Im Livebetrieb ist er Pflicht.
        </div>
      )}
      <LoginForm zweiterFaktor={k.zweiterFaktorAktiv} />
    </div>
  );
}
