// Abschlusskanäle. Der Rest des Systems kennt nur das Interface, damit ein Kanal (z.B. PROCHECK24)
// ausgetauscht oder ergänzt werden kann, ohne Prozesslogik anzufassen.
import { randomBytes } from "node:crypto";
import type { Tarif, Verbrauchsstelle } from "@/domain/types";
import type { Kunde } from "./repo";

export interface Antrag {
  kunde: Kunde;
  stelle: Verbrauchsstelle;
  tarif: Tarif;
  wunschLieferbeginn: string;
  altversorger: string;
  /** Der neue Versorger kündigt den Altvertrag im Rahmen des Lieferantenwechsels. */
  kuendigungDurchNeuversorger: true;
}

export type Antragsstatus = "offen" | "bestaetigt" | "abgelehnt";

export interface Abschlusskanal {
  id: "procheck24";
  name: string;
  simuliert: boolean;
  /** Wie weit im Voraus ein Antrag terminiert werden darf (PROCHECK24: bis zu 6 Monate) */
  maxVorlaufMonate: number;
  uebermitteln(antrag: Antrag): Promise<{ externeReferenz: string }>;
  statusAbfragen(externeReferenz: string): Promise<{ status: Antragsstatus; grund?: string }>;
}

/**
 * PROCHECK24-Webservice. Ohne Zugangsdaten läuft der Kanal im Simulationsmodus.
 * ACHTUNG: Die Endpunkte und Feldnamen im Live-Modus sind Annahmen und müssen an die
 * Webservice-Dokumentation von PROCHECK24 angepasst werden, sobald sie vorliegt.
 */
export class Procheck24Kanal implements Abschlusskanal {
  id = "procheck24" as const;
  name = "PROCHECK24";
  maxVorlaufMonate = 6;
  private url = process.env.PROCHECK24_API_URL;
  private token = process.env.PROCHECK24_API_TOKEN;
  get simuliert() {
    return !this.url || !this.token;
  }

  async uebermitteln(a: Antrag) {
    if (this.simuliert) {
      // Demo: Nachname "Ablehnung" simuliert eine Ablehnung durch den Versorger (z.B. Bonitätsprüfung).
      const prefix = a.kunde.nachname.toLowerCase() === "ablehnung" ? "SIM-X" : "SIM";
      return { externeReferenz: `${prefix}-${randomBytes(4).toString("hex").toUpperCase()}` };
    }
    const res = await fetch(`${this.url}/antraege`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.token}` },
      body: JSON.stringify({
        partnerId: process.env.PROCHECK24_PARTNER_ID,
        tarifId: a.tarif.id,
        sparte: a.stelle.sparte,
        lieferbeginn: a.wunschLieferbeginn,
        verbrauchKwh: a.stelle.jahresverbrauchKwh,
        lieferadresse: { plz: a.stelle.plz, strasse: a.stelle.strasse },
        kunde: { anrede: a.kunde.anrede, vorname: a.kunde.vorname, nachname: a.kunde.nachname, email: a.kunde.email, geburtsdatum: a.kunde.geburtsdatum, iban: a.kunde.iban },
        altversorger: a.altversorger,
        kuendigungDurchNeuversorger: a.kuendigungDurchNeuversorger,
      }),
    });
    if (!res.ok) throw new Error(`PROCHECK24 antwortet mit ${res.status}`);
    const body = (await res.json()) as { id: string };
    return { externeReferenz: body.id };
  }

  async statusAbfragen(ref: string): Promise<{ status: Antragsstatus; grund?: string }> {
    if (this.simuliert) {
      return ref.startsWith("SIM-X-") ? { status: "abgelehnt", grund: "Bonitätsprüfung negativ (Simulation)" } : { status: "bestaetigt" };
    }
    const res = await fetch(`${this.url}/antraege/${encodeURIComponent(ref)}`, { headers: { authorization: `Bearer ${this.token}` } });
    if (!res.ok) throw new Error(`PROCHECK24 antwortet mit ${res.status}`);
    return (await res.json()) as { status: Antragsstatus; grund?: string };
  }
}

/** CHECK24-Affiliate: Der Kunde schließt selbst über einen getrackten Link ab (Erinnerungsmodus). */
export function check24Deeplink(stelle: Verbrauchsstelle): string {
  const vorlage =
    process.env.CHECK24_DEEPLINK_TEMPLATE ??
    "https://www.check24.de/{sparte}/vergleich/?zipcode={plz}&totalconsumption={verbrauch}&pid={partnerId}";
  return vorlage
    .replace("{sparte}", stelle.sparte)
    .replace("{plz}", encodeURIComponent(stelle.plz))
    .replace("{verbrauch}", String(stelle.jahresverbrauchKwh))
    .replace("{partnerId}", encodeURIComponent(process.env.CHECK24_PARTNER_ID ?? ""));
}

let kanal: Abschlusskanal = new Procheck24Kanal();
export const abschlusskanal = () => kanal;
/** Für Tests */
export function setzeAbschlusskanal(k: Abschlusskanal) {
  kanal = k;
}
