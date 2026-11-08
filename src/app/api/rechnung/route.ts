import { NextResponse, type NextRequest } from "next/server";
import { AuslesFehler, rechnungAuslesen, zuFormularwerten } from "@/server/rechnung";

export const runtime = "nodejs";
export const maxDuration = 120;

// Einfache Begrenzung pro IP gegen Missbrauch (jede Auslesung kostet API-Guthaben).
const FENSTER_MS = 60 * 60 * 1000;
const MAX_PRO_FENSTER = 10;
const zugriffe = new Map<string, number[]>();

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "lokal";
  const jetzt = Date.now();
  const liste = (zugriffe.get(ip) ?? []).filter((t) => jetzt - t < FENSTER_MS);
  if (liste.length >= MAX_PRO_FENSTER) return NextResponse.json({ fehler: "Zu viele Uploads. Bitte später erneut versuchen." }, { status: 429 });
  zugriffe.set(ip, [...liste, jetzt]);

  let datei: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("datei");
    datei = f instanceof File ? f : null;
  } catch {
    /* unten behandelt */
  }
  if (!datei || datei.size === 0) return NextResponse.json({ fehler: "Keine Datei erhalten." }, { status: 400 });

  try {
    const extrakt = await rechnungAuslesen({ bytes: Buffer.from(await datei.arrayBuffer()), mediaType: datei.type });
    return NextResponse.json(zuFormularwerten(extrakt));
  } catch (e) {
    if (e instanceof AuslesFehler) return NextResponse.json({ fehler: e.message }, { status: 422 });
    console.error("[rechnung]", e);
    return NextResponse.json({ fehler: "Unerwarteter Fehler beim Auslesen." }, { status: 500 });
  }
}
