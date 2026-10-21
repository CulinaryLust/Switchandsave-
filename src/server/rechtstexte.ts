// ENTWÜRFE. Alle Texte sind Platzhalter und müssen vor dem Livebetrieb von einer Rechtsanwältin
// oder einem Rechtsanwalt für Energie- und IT-Recht geprüft werden.

export const VOLLMACHT_VERSION = "2026-10-entwurf-1";

export function vollmachtText(p: { vorname: string; nachname: string }) {
  return `Vollmacht zum Energieanbieterwechsel (Version ${VOLLMACHT_VERSION})

Ich, ${p.vorname} ${p.nachname}, bevollmächtige Switchandsave (Betreiber siehe Impressum), in meinem Namen
1. Lieferverträge für Strom und/oder Gas für die angegebene Verbrauchsstelle abzuschließen, sofern ich dem
   jeweiligen Wechsel zugestimmt habe (Einzelfreigabe) oder die Bedingungen meines Dauerauftrags erfüllt sind,
2. den neuen Versorger zu beauftragen, meinen bisherigen Liefervertrag zum nächstmöglichen Termin zu kündigen,
3. die dafür erforderlichen Daten an den Vermittlungspartner und den neuen Versorger zu übermitteln.

Jeder Vertragsabschluss wird vor der Übermittlung von einem Mitarbeiter geprüft und freigegeben.
Die Vollmacht kann ich jederzeit ohne Angabe von Gründen in meinem Kundenkonto oder per E-Mail widerrufen.
Bereits abgeschlossene Verträge bleiben vom Widerruf unberührt.`;
}

export const WIDERRUFSBELEHRUNG_KURZ =
  "Sie haben das Recht, binnen 14 Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Das Widerrufsrecht gilt auch für den " +
  "jeweils abgeschlossenen Energieliefervertrag gegenüber dem Versorger. (Entwurf, vollständige Belehrung und Muster-Widerrufsformular folgen.)";

export const RANKING_TRANSPARENZ =
  "Wir sortieren ausschließlich nach Ihren Kosten im ersten Jahr (inklusive sicher anfallender Boni). Die Höhe unserer Vergütung hat " +
  "keinen Einfluss auf die Reihenfolge. Wir erhalten für vermittelte Verträge eine Provision vom Vermittlungspartner bzw. Versorger. " +
  "Verglichen werden nur Tarife, die über unsere Partner abschließbar sind; das ist nicht der gesamte Markt.";
