"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as p from "@/server/prozess";
import * as repo from "@/server/repo";
import { UngueltigerUebergang } from "@/domain/wechselfall";

const s = (f: FormData, k: string) => String(f.get(k) ?? "");
const n = (f: FormData, k: string) => Number(s(f, k).replace(",", "."));

function zurueck(token: string, meldung?: string): never {
  revalidatePath(`/konto/${token}`);
  redirect(`/konto/${token}${meldung ? `?meldung=${encodeURIComponent(meldung)}` : ""}`);
}

async function ausfuehren(token: string, fn: () => unknown, erfolg: string): Promise<never> {
  let meldung = erfolg;
  try {
    const r = await fn();
    if (typeof r === "string") meldung = r;
  } catch (e) {
    if (e instanceof p.Prozessfehler || e instanceof UngueltigerUebergang) zurueck(token, `Fehler: ${e.message}`);
    throw e;
  }
  zurueck(token, meldung);
}

export async function freigeben(f: FormData) {
  const token = s(f, "token");
  await ausfuehren(token, () => p.kundeFreigeben(token, s(f, "fall")), "Danke, der Wechsel ist freigegeben und wird jetzt geprüft.");
}

export async function ablehnen(f: FormData) {
  const token = s(f, "token");
  await ausfuehren(token, () => p.kundeAblehnen(token, s(f, "fall")), "Der Wechsel wurde gestoppt.");
}

export async function selbstAbgeschlossen(f: FormData) {
  const token = s(f, "token");
  await ausfuehren(
    token,
    () =>
      p.kundeSelbstAbgeschlossen(token, s(f, "fall"), {
        versorgerName: s(f, "versorger"),
        tarifName: s(f, "tarifname"),
        arbeitspreisCtBrutto: n(f, "ap"),
        grundpreisEurMonatBrutto: n(f, "gp"),
        lieferbeginn: s(f, "beginn"),
        erstlaufzeitMonate: n(f, "laufzeit"),
        kuendigungsfristWochen: n(f, "frist"),
        bonusFaelligAm: s(f, "bonus") || undefined,
      }),
    "Danke! Wir übernehmen den neuen Vertrag zum Lieferbeginn.",
  );
}

export async function preiserhoehung(f: FormData) {
  const token = s(f, "token");
  await ausfuehren(
    token,
    () => {
      const r = p.preiserhoehungMelden(token, s(f, "vertrag"), { arbeitspreisCtBrutto: n(f, "ap"), grundpreisEurMonatBrutto: n(f, "gp"), wirksamAb: s(f, "wirksam") });
      return r ? `Preiserhöhung gespeichert. ${r}` : undefined;
    },
    "Preiserhöhung gespeichert. Aktuell gibt es keinen lohnenden Wechsel.",
  );
}

export async function widerrufen(f: FormData) {
  const token = s(f, "token");
  await ausfuehren(token, () => p.vollmachtWiderrufen(token), "Ihre Vollmacht ist widerrufen. Sie erhalten künftig Erinnerungen.");
}

export async function dauerauftrag(f: FormData) {
  const token = s(f, "token");
  await ausfuehren(
    token,
    () => {
      const kunde = repo.kundeByToken(token);
      if (!kunde || kunde.modus !== "vollmacht") throw new p.Prozessfehler("Nur mit Vollmacht möglich.");
      const wert = s(f, "ab");
      kunde.autoFreigabeAbEur = wert === "" ? undefined : Math.max(0, Number(wert));
      repo.kundeSpeichern(kunde);
      repo.protokolliere({ kundeId: kunde.id, typ: "kunde.dauerauftrag", akteur: "kunde", data: { ab: kunde.autoFreigabeAbEur ?? null } });
    },
    "Dauerauftrag gespeichert.",
  );
}
