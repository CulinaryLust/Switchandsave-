const FRAGEN: { f: string; a: string }[] = [
  { f: "Was kostet mich Switchandsave?", a: "Nichts. Wir erhalten für jeden vermittelten Vertrag eine Provision vom Vergleichspartner beziehungsweise Versorger. Die Höhe der Provision hat keinen Einfluss auf die Reihenfolge der Tarife." },
  { f: "Kann mir der Strom oder das Gas abgestellt werden?", a: "Nein. Beim Wechsel gibt es keine Versorgungslücke. Selbst wenn etwas schiefgeht, beliefert Sie automatisch der örtliche Grundversorger weiter." },
  { f: "Muss ich meinen alten Vertrag selbst kündigen?", a: "Nein. Die Kündigung übernimmt der neue Versorger im Rahmen des Lieferantenwechsels. Wir achten darauf, dass Fristen eingehalten werden und ein Neukundenbonus nicht verfällt." },
  { f: "Was bedeutet die Vollmacht genau?", a: "Sie erlauben uns, in Ihrem Namen Strom- und Gasverträge abzuschließen und zu kündigen. Jeder Abschluss wird vorher von einem Menschen geprüft. Sie können jeden Wechsel stoppen und die Vollmacht jederzeit in Ihrem Konto widerrufen." },
  { f: "Was passiert mit meinen Daten und meiner IBAN?", a: "Wir nutzen Ihre Daten nur für die Vermittlung. Die IBAN speichern wir verschlüsselt und geben sie nur an den neuen Versorger weiter. Eine hochgeladene Rechnung wird nur ausgelesen und nicht gespeichert." },
  { f: "Warum nicht einfach der günstigste Tarif?", a: "Der scheinbar günstigste Tarif ist oft eine Falle: Vorkasse, Kaution, Pakettarife oder ein hoher Bonus, nach dem der Preis im zweiten Jahr steigt. Wir filtern solche Tarife heraus und zeigen Ihnen auch die Kosten im zweiten Jahr." },
  { f: "Kann ich Strom und Gas zusammen wechseln?", a: "Ja. Nach dem ersten Auftrag fügen Sie den zweiten Vertrag in Ihrem Kundenkonto mit zwei Klicks hinzu. Ihre Daten und Ihre Vollmacht gelten für beide." },
];

export function Faq() {
  return (
    <div className="faq">
      {FRAGEN.map((x) => (
        <details key={x.f} className="card">
          <summary>{x.f}</summary>
          <p className="muted" style={{ marginBottom: 0 }}>
            {x.a}
          </p>
        </details>
      ))}
    </div>
  );
}
