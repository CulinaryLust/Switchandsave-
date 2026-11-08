// Rechnung auslesen: Foto oder PDF der Jahresabrechnung -> Formularwerte für den Vergleich.
// Nutzt die Claude API (strukturierte Ausgabe). Die Datei wird nicht gespeichert.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";

export const MODELL = "claude-opus-5-5";
export const MAX_BILD_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const BILDTYPEN = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type Bildtyp = (typeof BILDTYPEN)[number];

export const RechnungSchema = z.object({
  ist_energierechnung: z.boolean().describe("true, wenn das Dokument eine Strom- oder Gasrechnung bzw. ein Vertragsdokument eines Energieversorgers ist"),
  sparte: z.enum(["strom", "gas"]).nullable(),
  plz: z.string().nullable().describe("Fünfstellige PLZ der Lieferstelle (nicht der Rechnungsanschrift, falls abweichend)"),
  strasse: z.string().nullable().describe("Straße und Hausnummer der Lieferstelle"),
  jahresverbrauch_kwh: z.number().nullable().describe("Verbrauch im Abrechnungszeitraum in kWh, bei Gas die kWh nach Umrechnung aus m³"),
  versorger: z.string().nullable(),
  tarifname: z.string().nullable(),
  ist_grundversorgung: z.boolean().nullable().describe("true bei Grundversorgung oder Ersatzversorgung"),
  arbeitspreis_ct_brutto: z.number().nullable().describe("Aktueller Arbeitspreis in ct/kWh inklusive 19 % MwSt."),
  grundpreis_eur_monat_brutto: z.number().nullable().describe("Aktueller Grundpreis in Euro pro Monat inklusive 19 % MwSt."),
  lieferbeginn: z.string().nullable().describe("Beginn der Belieferung durch diesen Versorger im Format JJJJ-MM-TT"),
  erstlaufzeit_monate: z.number().nullable(),
  kuendigungsfrist_wochen: z.number().nullable().describe("Kündigungsfrist in Wochen; 1 Monat = 4 Wochen"),
  hinweise: z.array(z.string()).describe("Kurze Hinweise auf deutsch: Umrechnungen, Unsicherheiten, fehlende Angaben"),
});
export type RechnungsExtrakt = z.infer<typeof RechnungSchema>;

const ANWEISUNG = `Du liest deutsche Strom- und Gasrechnungen aus, damit ein Tarifvergleich vorausgefüllt werden kann.
Regeln:
- Nur Werte übernehmen, die im Dokument stehen oder sich eindeutig daraus berechnen lassen. Sonst null.
- Preise immer brutto (inkl. 19 % MwSt.). Stehen nur Nettopreise da, rechne mit 1,19 hoch und vermerke das in "hinweise".
- Grundpreis pro Monat. Steht nur ein Jahresgrundpreis da, teile durch 12. Bei Preisänderungen im Abrechnungszeitraum den zuletzt gültigen Preis nehmen.
- Arbeitspreis ohne Grundpreis, Netzentgelte nicht separat aufschlüsseln: gemeint ist der Gesamtarbeitspreis, den der Kunde je kWh zahlt.
- Jahresverbrauch: Verbrauch des Abrechnungszeitraums; ist der Zeitraum deutlich kürzer oder länger als 12 Monate, auf 12 Monate hochrechnen und vermerken.
- Lieferstelle (Verbrauchsstelle) hat Vorrang vor Rechnungsanschrift.
- Bankdaten, Kundennummern, Zählernummern und Namen nicht ausgeben.`;

export class AuslesFehler extends Error {}

export function auslesenVerfuegbar(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

let client: Anthropic | undefined;

export async function rechnungAuslesen(datei: { bytes: Buffer; mediaType: string }): Promise<RechnungsExtrakt> {
  const istPdf = datei.mediaType === "application/pdf";
  const istBild = (BILDTYPEN as readonly string[]).includes(datei.mediaType);
  if (!istPdf && !istBild) throw new AuslesFehler("Bitte ein Foto (JPG, PNG, WebP) oder ein PDF hochladen.");
  if (datei.bytes.length > (istPdf ? MAX_PDF_BYTES : MAX_BILD_BYTES)) throw new AuslesFehler(`Datei zu groß (max. ${istPdf ? 20 : 5} MB).`);
  if (!auslesenVerfuegbar()) throw new AuslesFehler("Das Auslesen ist nicht eingerichtet (ANTHROPIC_API_KEY fehlt).");

  client ??= new Anthropic();
  const data = datei.bytes.toString("base64");
  const quelle: Anthropic.Beta.BetaContentBlockParam = istPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "image", source: { type: "base64", media_type: datei.mediaType as Bildtyp, data } };

  let antwort;
  try {
    antwort = await client.beta.messages.parse({
      model: MODELL,
      max_tokens: 16000,
      // Lehnt das Modell eine Anfrage ab, wiederholt die API sie serverseitig mit dem empfohlenen Ausweichmodell.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: ANWEISUNG,
      output_config: { format: zodOutputFormat(RechnungSchema) },
      messages: [{ role: "user", content: [quelle, { type: "text", text: "Lies die Vertragsdaten aus dieser Rechnung aus." }] }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new AuslesFehler("Gerade sind zu viele Anfragen unterwegs. Bitte gleich noch einmal versuchen.");
    if (e instanceof Anthropic.BadRequestError) throw new AuslesFehler("Die Datei konnte nicht verarbeitet werden. Bitte ein schärferes Foto oder das PDF verwenden.");
    if (e instanceof Anthropic.APIError) throw new AuslesFehler("Der Auslesedienst ist gerade nicht erreichbar. Bitte die Werte von Hand eintragen.");
    throw e;
  }
  if (antwort.stop_reason === "refusal") throw new AuslesFehler("Die Datei konnte nicht ausgelesen werden. Bitte die Werte von Hand eintragen.");
  if (antwort.stop_reason === "max_tokens" || !antwort.parsed_output) throw new AuslesFehler("Die Rechnung war nicht eindeutig lesbar. Bitte die Werte von Hand eintragen.");
  if (!antwort.parsed_output.ist_energierechnung) throw new AuslesFehler("Das sieht nicht nach einer Strom- oder Gasrechnung aus.");
  return antwort.parsed_output;
}

export type Formularwerte = Partial<Record<"sparte" | "plz" | "strasse" | "verbrauch" | "versorger" | "tarifname" | "gv" | "ap" | "gp" | "beginn" | "laufzeit" | "frist", string>>;

const dezimal = (n: number, stellen: number) => n.toFixed(stellen).replace(".", ",");
const imBereich = (n: number | null, min: number, max: number): n is number => n !== null && Number.isFinite(n) && n >= min && n <= max;

/** Übernimmt nur plausible Werte; alles andere bleibt leer und muss vom Kunden ergänzt werden. */
export function zuFormularwerten(x: RechnungsExtrakt): { werte: Formularwerte; hinweise: string[] } {
  const w: Formularwerte = {};
  const hinweise = [...x.hinweise];
  if (x.sparte) w.sparte = x.sparte;
  if (x.plz && /^\d{5}$/.test(x.plz.trim())) w.plz = x.plz.trim();
  if (x.strasse) w.strasse = x.strasse.trim().slice(0, 120);
  if (imBereich(x.jahresverbrauch_kwh, 100, 100_000)) w.verbrauch = String(Math.round(x.jahresverbrauch_kwh));
  if (x.versorger) w.versorger = x.versorger.trim().slice(0, 120);
  if (x.tarifname) w.tarifname = x.tarifname.trim().slice(0, 120);
  if (x.ist_grundversorgung !== null) w.gv = x.ist_grundversorgung ? "1" : "0";
  if (imBereich(x.arbeitspreis_ct_brutto, 1, 200)) w.ap = dezimal(x.arbeitspreis_ct_brutto, 2);
  else if (x.arbeitspreis_ct_brutto !== null) hinweise.push("Arbeitspreis unplausibel, bitte prüfen.");
  if (imBereich(x.grundpreis_eur_monat_brutto, 0, 200)) w.gp = dezimal(x.grundpreis_eur_monat_brutto, 2);
  if (x.lieferbeginn && /^\d{4}-\d{2}-\d{2}$/.test(x.lieferbeginn)) w.beginn = x.lieferbeginn;
  if (imBereich(x.erstlaufzeit_monate, 0, 36)) w.laufzeit = String(Math.round(x.erstlaufzeit_monate));
  if (imBereich(x.kuendigungsfrist_wochen, 0, 13)) w.frist = String(Math.round(x.kuendigungsfrist_wochen));
  const fehlend = (["plz", "verbrauch", "ap", "gp", "beginn"] as const).filter((k) => !w[k]);
  if (fehlend.length) hinweise.push(`Nicht gefunden: ${fehlend.map((k) => ({ plz: "PLZ", verbrauch: "Verbrauch", ap: "Arbeitspreis", gp: "Grundpreis", beginn: "Lieferbeginn" })[k]).join(", ")}. Bitte ergänzen.`);
  return { werte: w, hinweise };
}
