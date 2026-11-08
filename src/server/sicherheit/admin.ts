import { cookies } from "next/headers";
import { SITZUNG_COOKIE, sitzungPruefen } from "./sitzung";

/** Zweite Prüfung in jeder Server-Action des Betreiberbereichs, unabhängig von der Middleware. */
export async function betreiberPruefen(): Promise<string> {
  const benutzer = await sitzungPruefen((await cookies()).get(SITZUNG_COOKIE)?.value);
  if (!benutzer) throw new Error("Nicht angemeldet.");
  return benutzer;
}
