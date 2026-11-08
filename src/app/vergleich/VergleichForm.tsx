"use client";

import { useRef, useState } from "react";

type Werte = Record<string, string>;

export const STANDARDWERTE: Werte = {
  sparte: "strom",
  plz: "10115",
  strasse: "Invalidenstraße 1",
  verbrauch: "2500",
  versorger: "Örtlicher Grundversorger",
  tarifname: "Grundversorgung",
  gv: "1",
  ap: "40,09",
  gp: "20,83",
  beginn: "2019-01-01",
  laufzeit: "12",
  frist: "4",
  bonus: "",
};

/** Verkleinert große Fotos im Browser, damit sie unter die Upload-Grenze passen und schneller übertragen werden. */
async function bildVerkleinern(datei: File): Promise<Blob> {
  if (!datei.type.startsWith("image/") || datei.size < 1.5 * 1024 * 1024) return datei;
  const bild = await createImageBitmap(datei);
  const faktor = Math.min(1, 2200 / Math.max(bild.width, bild.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bild.width * faktor);
  canvas.height = Math.round(bild.height * faktor);
  canvas.getContext("2d")!.drawImage(bild, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, fehler) => canvas.toBlob((b) => (b ? ok(b) : fehler(new Error("Bild konnte nicht verarbeitet werden."))), "image/jpeg", 0.85));
}

export function VergleichForm(props: { start: Werte; konto?: string; auslesenVerfuegbar: boolean; spartenFest?: boolean }) {
  const [w, setW] = useState<Werte>({ ...STANDARDWERTE, ...props.start });
  const [status, setStatus] = useState<{ art: "laeuft" | "ok" | "fehler"; text: string; hinweise?: string[] } | null>(null);
  const [ausgelesen, setAusgelesen] = useState<Set<string>>(new Set());
  const dateiRef = useRef<HTMLInputElement>(null);

  const feld = (name: string) => ({
    name,
    value: w[name] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setW((alt) => ({ ...alt, [name]: e.target.value })),
    className: ausgelesen.has(name) ? "ausgelesen" : undefined,
  });

  async function hochladen(datei: File) {
    setStatus({ art: "laeuft", text: "Rechnung wird ausgelesen. Das dauert etwa 20 bis 40 Sekunden …" });
    try {
      const body = new FormData();
      const blob = await bildVerkleinern(datei);
      body.append("datei", blob, datei.name);
      const res = await fetch("/api/rechnung", { method: "POST", body });
      const json = (await res.json()) as { werte?: Werte; hinweise?: string[]; fehler?: string };
      if (!res.ok || !json.werte) throw new Error(json.fehler ?? "Auslesen fehlgeschlagen.");
      const werte = { ...json.werte };
      if (props.spartenFest) delete werte.sparte;
      setW((alt) => ({ ...alt, ...werte, ...(werte.gv === "1" ? { laufzeit: "0", frist: "2" } : {}) }));
      setAusgelesen(new Set(Object.keys(werte)));
      setStatus({ art: "ok", text: `${Object.keys(werte).length} Angaben übernommen. Bitte kurz prüfen, markierte Felder stammen aus der Rechnung.`, hinweise: json.hinweise });
    } catch (e) {
      setStatus({ art: "fehler", text: e instanceof Error ? e.message : "Auslesen fehlgeschlagen." });
    } finally {
      if (dateiRef.current) dateiRef.current.value = "";
    }
  }

  return (
    <form className="stack" action="/ergebnis" method="get">
      {props.konto && <input type="hidden" name="konto" value={props.konto} />}

      <fieldset className="upload">
        <legend>Schneller: Rechnung hochladen</legend>
        {props.auslesenVerfuegbar ? (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              Foto oder PDF Ihrer letzten Jahresabrechnung. Wir lesen die Werte aus und füllen das Formular vor. Die Datei wird
              nur zum Auslesen an unseren KI-Dienstleister übermittelt und nicht gespeichert.
            </p>
            <label className="btn secondary upload-btn">
              {status?.art === "laeuft" ? "Wird ausgelesen …" : "Foto oder PDF wählen"}
              <input
                ref={dateiRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                disabled={status?.art === "laeuft"}
                onChange={(e) => e.target.files?.[0] && hochladen(e.target.files[0])}
              />
            </label>
          </>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Das automatische Auslesen ist in dieser Installation nicht eingerichtet. Bitte die Werte von Hand eintragen.
          </p>
        )}
        {status && (
          <div className={`notice ${status.art === "fehler" ? "bad" : status.art === "laeuft" ? "warn" : ""}`} style={{ marginTop: 12 }} role="status">
            {status.text}
            {status.hinweise && status.hinweise.length > 0 && (
              <ul style={{ margin: "6px 0 0" }}>
                {status.hinweise.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>Verbrauchsstelle</legend>
        <div className="fields">
          <label>
            Sparte
            {props.spartenFest ? (
              <>
                <input type="hidden" name="sparte" value={w.sparte} />
                <input value={w.sparte === "gas" ? "Gas" : "Strom"} disabled />
              </>
            ) : (
              <select {...feld("sparte")}>
                <option value="strom">Strom</option>
                <option value="gas">Gas</option>
              </select>
            )}
          </label>
          <label>
            PLZ
            <input {...feld("plz")} required pattern="\d{5}" inputMode="numeric" />
          </label>
          <label>
            Straße und Hausnummer
            <input {...feld("strasse")} />
            <span className="hint">Eine PLZ kann mehrere Netzgebiete haben.</span>
          </label>
          <label>
            Jahresverbrauch (kWh)
            <input {...feld("verbrauch")} type="number" min={100} required />
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Aktueller Vertrag</legend>
        <div className="fields">
          <label>
            Versorger
            <input {...feld("versorger")} required />
          </label>
          <label>
            Tarifname
            <input {...feld("tarifname")} />
          </label>
          <label>
            Grundversorgung?
            <select {...feld("gv")}>
              <option value="1">Ja</option>
              <option value="0">Nein, Sondervertrag</option>
            </select>
          </label>
          <label>
            Arbeitspreis (ct/kWh, brutto)
            <input {...feld("ap")} required inputMode="decimal" />
          </label>
          <label>
            Grundpreis (€/Monat, brutto)
            <input {...feld("gp")} required inputMode="decimal" />
          </label>
          <label>
            Lieferbeginn
            <input {...feld("beginn")} type="date" required />
          </label>
          <label>
            Erstlaufzeit (Monate)
            <input {...feld("laufzeit")} type="number" min={0} max={36} />
          </label>
          <label>
            Kündigungsfrist (Wochen)
            <input {...feld("frist")} type="number" min={0} max={13} />
          </label>
          <label>
            Bonus fällig am (optional)
            <input {...feld("bonus")} type="date" />
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
  );
}
