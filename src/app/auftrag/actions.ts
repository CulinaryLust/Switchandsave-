"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { netzgebietById } from "@/domain/netzgebiet";
import { auftragErteilen, heute, Prozessfehler } from "@/server/prozess";
import { bestandAusEingabe, parseVergleich } from "../lib/eingabe";
import { ibanGueltig, ibanMaskieren } from "../lib/iban";

const PersonSchema = z
  .object({
    tarif: z.string().min(1),
    anrede: z.enum(["Frau", "Herr", "Divers"]),
    vorname: z.string().trim().min(1, "Vorname fehlt").max(80),
    nachname: z.string().trim().min(1, "Nachname fehlt").max(80),
    email: z.string().trim().email("E-Mail ungültig"),
    telefon: z.string().trim().max(40).optional(),
    geburtsdatum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geburtsdatum fehlt"),
    modus: z.enum(["vollmacht", "erinnerung"]),
    iban: z.string().optional(),
    autoFreigabe: z.enum(["0", "1"]).default("0"),
    autoFreigabeAb: z.preprocess((v) => (v === "" || v === undefined ? undefined : Number(v)), z.number().min(0).max(5000).optional()),
    agb: z.literal("on", { errorMap: () => ({ message: "Bitte AGB akzeptieren" }) }),
    datenschutz: z.literal("on", { errorMap: () => ({ message: "Bitte Datenschutzhinweise bestätigen" }) }),
    vollmacht: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.modus === "vollmacht") {
      if (d.vollmacht !== "on") ctx.addIssue({ code: "custom", path: ["vollmacht"], message: "Bitte Vollmacht erteilen" });
      if (!d.iban || !ibanGueltig(d.iban)) ctx.addIssue({ code: "custom", path: ["iban"], message: "IBAN ungültig" });
    }
  });

export type AuftragState = { fehler?: string[] };

export async function auftragAction(_prev: AuftragState, form: FormData): Promise<AuftragState> {
  const roh = Object.fromEntries(form.entries()) as Record<string, string>;
  const vergleich = parseVergleich(roh);
  const person = PersonSchema.safeParse(roh);
  const fehler = [...(vergleich.success ? [] : vergleich.error.issues), ...(person.success ? [] : person.error.issues)].map((i) => i.message);
  if (!vergleich.success || !person.success) return { fehler };

  const v = vergleich.data;
  const p = person.data;
  const netz = v.netz ? netzgebietById(v.netz) : undefined;
  if (!netz) return { fehler: ["Netzgebiet fehlt, bitte Vergleich erneut starten."] };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unbekannt";
  const stand = heute();

  let token: string;
  try {
    const { kunde } = auftragErteilen({
      kunde: {
        anrede: p.anrede,
        vorname: p.vorname,
        nachname: p.nachname,
        email: p.email,
        telefon: p.telefon || undefined,
        geburtsdatum: p.geburtsdatum,
        modus: p.modus,
        iban: p.modus === "vollmacht" ? p.iban!.replace(/\s+/g, "").toUpperCase() : undefined,
        ibanMaskiert: p.modus === "vollmacht" ? ibanMaskieren(p.iban!) : undefined,
        autoFreigabeAbEur: p.modus === "vollmacht" && p.autoFreigabe === "1" ? (p.autoFreigabeAb ?? 50) : undefined,
        einwilligungen: { agb: stand, datenschutz: stand, vollmacht: p.modus === "vollmacht" ? stand : undefined },
      },
      stelle: { sparte: v.sparte, plz: v.plz, strasse: v.strasse, netzgebietId: netz.id, jahresverbrauchKwh: v.verbrauch },
      bestand: bestandAusEingabe(v),
      tarifId: p.tarif,
      nachweis: { ipHash: createHash("sha256").update(ip).digest("hex").slice(0, 16), userAgent: h.get("user-agent") ?? "" },
    });
    token = kunde.token;
  } catch (err) {
    if (err instanceof Prozessfehler) return { fehler: [err.message] };
    throw err;
  }
  redirect(`/konto/${token}?neu=1`);
}
