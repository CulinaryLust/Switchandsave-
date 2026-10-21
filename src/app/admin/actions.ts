"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UngueltigerUebergang } from "@/domain/wechselfall";
import * as p from "@/server/prozess";
import * as repo from "@/server/repo";

const s = (f: FormData, k: string) => String(f.get(k) ?? "");
const BETREIBER = "admin";

function zurueck(meldung: string): never {
  revalidatePath("/admin");
  redirect(`/admin?meldung=${encodeURIComponent(meldung)}`);
}

async function ausfuehren(fn: () => Promise<string> | string): Promise<never> {
  let meldung: string;
  try {
    meldung = await fn();
  } catch (e) {
    if (e instanceof p.Prozessfehler || e instanceof UngueltigerUebergang) zurueck(`Fehler: ${e.message}`);
    throw e;
  }
  zurueck(meldung);
}

export async function freigeben(f: FormData) {
  await ausfuehren(async () => {
    await p.betreiberFreigeben(s(f, "fall"), BETREIBER);
    const fall = repo.fallById(s(f, "fall"))!;
    return fall.status === "uebermittelt" ? `Freigegeben und übermittelt (${fall.externeReferenz}).` : "Freigegeben. Übermittlung ist terminiert.";
  });
}

export async function ablehnen(f: FormData) {
  await ausfuehren(() => {
    p.betreiberAblehnen(s(f, "fall"), BETREIBER, s(f, "grund") || "ohne Angabe");
    return "Abgelehnt, Kunde wurde informiert.";
  });
}

export async function tageslauf(f: FormData) {
  await ausfuehren(async () => {
    const r = await p.tageslauf(s(f, "stichtag") || undefined);
    return `Tageslauf ${r.stichtag}: ${r.aktionen.length ? r.aktionen.join(" | ") : "keine Aktionen"}`;
  });
}

export async function datumSetzen(f: FormData) {
  await ausfuehren(() => {
    const d = s(f, "datum");
    repo.einstellungSetzen("simuliertes_datum", d || null);
    return d ? `Simuliertes Datum: ${d}` : "Echtes Datum aktiv.";
  });
}

/** Demo: springt Tag für Tag bis zum Zieldatum und führt jeweils den Tageslauf aus. */
export async function vorspulen(f: FormData) {
  await ausfuehren(async () => {
    const ziel = s(f, "bis");
    const { addDays } = await import("@/domain/dates");
    let tag = p.heute();
    const alle: string[] = [];
    let schritte = 0;
    while (tag < ziel && schritte++ < 800) {
      tag = addDays(tag, 1);
      repo.einstellungSetzen("simuliertes_datum", tag);
      const r = await p.tageslauf(tag);
      alle.push(...r.aktionen.map((a) => `${tag}: ${a}`));
    }
    return alle.length ? alle.join(" | ") : `Bis ${tag} keine Aktionen.`;
  });
}
