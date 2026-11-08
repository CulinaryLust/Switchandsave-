const SCHRITTE = [
  { titel: "Rechnung hochladen", text: "Foto oder PDF genügt, wir lesen die Werte aus.", icon: "M6 3h9l5 5v13H6z M15 3v5h5 M9 13h8 M9 17h6" },
  { titel: "Ehrlich vergleichen", text: "Ohne Vorkasse, Kaution und Bonusfallen.", icon: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2" },
  { titel: "Menschliche Prüfung", text: "Jeder Abschluss wird vor dem Absenden geprüft.", icon: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M8.5 12l2.5 2.5 4.5-5" },
  { titel: "Wechsel ohne Lücke", text: "Der neue Versorger kündigt, Strom fließt weiter.", icon: "M13 2L4 14h7l-1 8 9-12h-7z" },
  { titel: "Fristen im Blick", text: "Wir melden uns vor Ablauf und bei Preiserhöhungen.", icon: "M4 6h16v14H4z M4 10h16 M8 3v5 M16 3v5" },
];

/** Ablaufgrafik: fünf Schritte als Kreislauf, der jedes Jahr von vorn beginnt. */
export function Ablauf() {
  return (
    <div className="ablauf">
      <ol>
        {SCHRITTE.map((s, i) => (
          <li key={s.titel}>
            <span className="ablauf-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={s.icon} />
              </svg>
            </span>
            <strong>
              {i + 1}. {s.titel}
            </strong>
            <span className="hint">{s.text}</span>
          </li>
        ))}
      </ol>
      <div className="ablauf-zyklus">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8 M21 3v5h-5 M21 12a9 9 0 0 1-15.5 6.3L3 16 M3 21v-5h5" />
        </svg>
        Nach einem Jahr beginnt der Kreislauf automatisch von vorn. Sie müssen nichts tun.
      </div>
    </div>
  );
}
