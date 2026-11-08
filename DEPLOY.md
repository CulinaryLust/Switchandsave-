# Switchandsave online stellen (Render)

Kosten: Web-Service Starter ca. 7 $/Monat, Festplatte 1 GB ca. 0,25 $/Monat, Cron-Job ab ca. 1 $/Monat. Server in Frankfurt.

1. Konto auf https://render.com anlegen und mit GitHub verbinden (Zugriff auf das Repository `Switchandsave-` erlauben).
2. In Render: **New → Blueprint**, das Repository wählen. Render liest `render.yaml` und legt Web-Service, Festplatte und Cron-Job an.
3. Bei den abgefragten Variablen eintragen:
   - `APP_URL`: zunächst leer lassen bzw. `https://switchandsave.onrender.com`; nach dem ersten Deploy die tatsächliche Adresse eintragen (bei beiden Diensten).
   - `CHECK24_PARTNER_ID`: deine Partner-ID (optional).
4. Pflichtwerte für den Livebetrieb: Lokal `npm run einrichten` ausführen, dann `ADMIN_TOTP_SECRET` und `DATA_KEY` aus `.env.local` unter **switchandsave → Environment** eintragen (den QR-Code vorher in der Authenticator-App scannen). Ohne diese Werte startet der Admin-Login nicht bzw. Aufträge mit IBAN schlagen fehl. `DATA_KEY` nie ändern, sonst sind gespeicherte IBANs unlesbar. Optional `ANTHROPIC_API_KEY` für das Auslesen von Rechnungen.
5. Nach dem Deploy: Das Admin-Passwort steht unter **switchandsave → Environment → ADMIN_PASSWORD**. Admin-Bereich: `<APP_URL>/admin` (Passwort plus Code aus der Authenticator-App).
5. Eigene Domain (optional): **Settings → Custom Domains**, z.B. `switchandsave.de`; das HTTPS-Zertifikat erstellt Render automatisch.

Jeder Push auf `main` wird automatisch neu ausgerollt. Die Datenbank liegt auf der Festplatte unter `/data` und bleibt bei Deploys erhalten.

Hinweis: Die Seite zeigt Demo-Tarife und simuliert PROCHECK24. Vor echtem Kundenverkehr Impressum, Datenschutz und AGB ersetzen (siehe README, „Offene Punkte“).
