# Switchandsave (MVP)

Kostenloser Wechselservice für Strom und Gas: Der Kunde tippt seine Jahresrechnung ab, das System findet den günstigsten seriösen Tarif, überwacht alle Fristen und bereitet jedes Jahr automatisch den nächsten Wechsel vor. Einziger manueller Schritt ist die Freigabe des Vertragsabschlusses durch den Betreiber.

> Demo-Stand: Tarife und Versorger sind fiktiv, Netzentgelte und Abgaben sind gerundete Größenordnungen. Der PROCHECK24-Kanal läuft im Simulationsmodus. Rechtstexte sind Platzhalter.

## Starten

```bash
npm install
npm run einrichten           # erzeugt .env.local mit Passwort, Schlüsseln und QR-Code für den zweiten Faktor
npm run dev                  # http://localhost:3000
npm test                     # 42 Tests: Rechenkern, Fristen, Zustandsautomat, Jahreszyklus, Sicherheit, Rechnung
```

Voraussetzung: Node 22.13 oder neuer (nutzt das eingebaute `node:sqlite`). Die Datenbank liegt in `data/switchandsave.db`.

Betreiberbereich: `/admin` (Anmeldung mit Passwort und Code aus einer Authenticator-App; ohne `npm run einrichten` im Entwicklungsmodus `admin` / `switchandsave` ohne zweiten Faktor, im Livebetrieb gesperrt). Dort gibt es die Freigabe-Warteschlange, den Tageslauf und eine Zeitsimulation („Vorspulen“), mit der sich ein ganzer Jahreszyklus in Sekunden durchspielen lässt.

Täglicher Lauf im Betrieb: `GET /api/cron/daily?secret=CRON_SECRET` einmal täglich per Cron aufrufen.

## Demo-Ablauf

1. `/vergleich` mit den Vorgabewerten absenden (Berlin, Grundversorgung, 2.500 kWh).
2. Einen Tarif wählen, „Rundum-Service mit Vollmacht“, Testdaten und IBAN `DE02 1203 0000 0000 2020 51`, Dauerauftrag aktivieren.
3. In `/admin` den Fall freigeben: Er wird an den (simulierten) PROCHECK24-Kanal übermittelt.
4. „Vorspulen“ bis ca. 10 Monate später: Bestätigung, Lieferbeginn, Vertragsumstellung und der automatische Folgevorschlag samt Freigabe per Dauerauftrag erscheinen im Postausgang und im Kundenkonto.

Rechnung hochladen: Mit `ANTHROPIC_API_KEY` in `.env.local` liest `/vergleich` ein Foto oder PDF der Jahresabrechnung aus (Claude API, Modell `claude-opus-5-5`, strukturierte Ausgabe; bei einer Ablehnung wiederholt die API die Anfrage serverseitig mit einem Ausweichmodell). Die Datei wird nicht gespeichert; pro IP sind 10 Auslesungen pro Stunde erlaubt.

Strom und Gas: Nach dem ersten Auftrag bietet das Kundenkonto „Gasvertrag hinzufügen“ (bzw. Strom). Daten, Vollmacht und Dauerauftrag werden übernommen.

Sonderfälle zum Ausprobieren: PLZ `50999` ohne Straße (zwei Netzgebiete), Nachname „Ablehnung“ (Versorger lehnt ab, System schlägt automatisch eine Alternative vor), „Preiserhöhung erhalten?“ im Kundenkonto (Sonderkündigung, sofortiger Neuvergleich).

## Architektur

```
src/domain/        reine Fachlogik, ohne I/O, vollständig getestet
  kosten.ts        Netto-Bestandteile -> Bruttopreise, Bonusbereinigung, Jahr 1 / Jahr 2
  netzgebiet.ts    PLZ + Straße -> Netzgebiet (eine PLZ kann mehrere haben)
  vergleich.ts     Verbraucherschutzfilter mit Begründung, Ranking ohne Einfluss der Vergütung
  fristen.ts       Erstlaufzeit, Kündigungsfrist, Bonusfälligkeit, Grundversorgung, Sonderkündigung
  wechselfall.ts   Zustandsautomat mit Akteursprüfung (System darf nie als Betreiber freigeben)
src/server/
  prozess.ts       Auftrag, Freigaben, Übermittlung, Tageslauf (der jährliche Zyklus)
  kanaele.ts       Abschlusskanäle: PROCHECK24 (Webservice/Simulation), CHECK24-Affiliate-Link
  rechnung.ts      Rechnung (Foto/PDF) per Claude API auslesen und in Formularwerte umsetzen
  sicherheit/      IBAN-Verschlüsselung, TOTP, signierte Admin-Sitzung, Login-Sperre
  repo.ts, db.ts   Persistenz (SQLite, JSON-Dokumente), Protokoll, Postausgang
src/app/           Next.js-Oberfläche: Start, Vergleich, Ergebnis, Auftrag, Kundenkonto, Admin
```

### Wichtige Fachregeln im Code

- **Bonus nicht verschenken:** Das Lieferende wird bis zur Fälligkeit des Neukundenbonus verschoben (`fristen.ts`).
- **Rollierende Fristen:** Grundversorgung und Verträge nach der Erstlaufzeit haben kein festes Ende. Offene Fälle werden deshalb täglich neu terminiert statt zu verfallen.
- **6 Monate Vorlauf:** PROCHECK24 erlaubt Terminierung bis 6 Monate im Voraus. Freigegebene Fälle mit späterem Lieferbeginn übermittelt der Tageslauf automatisch, sobald das Fenster erreicht ist.
- **Mindestersparnis 30 €:** Darunter wird kein Wechsel vorgeschlagen; ohne lohnenden Tarif wird nach 30 Tagen erneut geprüft.
- **Ranking ist provisionsneutral:** Ein Test stellt sicher, dass die Vergütung die Reihenfolge nicht beeinflusst (UWG-Transparenz).

## Geschäftsmodell: welcher Weg ist umsetzbar und profitabler?

| | Erinnerung + CHECK24-Affiliate | Vollmacht + PROCHECK24 |
| --- | --- | --- |
| Wer schließt ab | Kunde selbst über Partnerlink | Switchandsave im Namen des Kunden |
| Erlös pro Wechsel | ca. 16,50 bis 20 € (ältere öffentliche Angaben) | Courtage unbekannt, bei PROCHECK24 erfragen |
| Abschlussquote | gering, hängt am Kunden (Erinnerung wird oft ignoriert) | hoch, Freigabe per Dauerauftrag möglich |
| Wiederkehrend | nur wenn der Kunde jedes Jahr klickt | ja, jedes Jahr automatisch |
| Rechtlicher Aufwand | gering | höher: Vollmacht, AGB, Datenschutz, Vermittlerpflichten |
| Status | sofort nutzbar | Webservice-Zugang und Vollmachtmodell mit PROCHECK24 klären |

Empfehlung: Vollmacht mit PROCHECK24 als Standard, Erinnerungsmodus als Rückfallebene für Kunden ohne Vollmacht. Der Erlös entsteht aus der Wiederholung: Ein Kunde, der fünf Jahre bleibt, bringt fünf Abschlüsse.

## Offene Punkte vor dem Livebetrieb

1. **PROCHECK24 schriftlich klären:** Webservice-Zugang (auch für Anträge, nicht nur Preisabfragen), Zulässigkeit von Anträgen per Kundenvollmacht, Courtage Strom/Gas, Storno-Regeln, jährlicher Wiederwechsel derselben Kunden. Dann `Procheck24Kanal` (Endpunkte sind Annahmen) an die Doku anpassen und die Demo-Tarife durch die Preisabfrage ersetzen.
2. **Recht:** Vollmacht, AGB, Widerrufsbelehrung, Datenschutzerklärung und Impressum anwaltlich erstellen lassen (Energie- und IT-Recht). Gewerbe anmelden.
3. **Sicherheit:** Magic-Link des Kundenkontos mit Ablauf und E-Mail-Login. Next.js auf eine Version ohne bekannte Sicherheitslücken aktualisieren (`npm audit`). Erledigt: IBAN mit AES-256-GCM verschlüsselt, Admin-Login mit zweitem Faktor (TOTP), Sperre nach 5 Fehlversuchen.
4. **Betrieb:** E-Mail-Versand (EU-Anbieter) statt Postausgang, PostgreSQL statt SQLite, Hosting in der EU, Cron einrichten.
5. **Validierung:** Rechenkern gegen 20 bis 50 echte Rechnungen und gegen CHECK24/Verivox mit identischen Eingaben prüfen (Toleranz 2 %).

## Bildnachweise

Fotos von Unsplash (Unsplash-Lizenz): Vitaly Gariev, American Public Power Association, Benjamin Jopen. Details unter `/rechtliches#bildnachweise`.
