import { NextResponse, type NextRequest } from "next/server";
import { SITZUNG_COOKIE, sitzungPruefen } from "@/server/sicherheit/sitzung";

// Betreiberbereich: nur mit gültiger Sitzung (Passwort plus zweiter Faktor, siehe /admin/login).
export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/admin/login") return NextResponse.next();
  const benutzer = await sitzungPruefen(req.cookies.get(SITZUNG_COOKIE)?.value).catch(() => null);
  if (benutzer) return NextResponse.next();
  const ziel = req.nextUrl.clone();
  ziel.pathname = "/admin/login";
  ziel.search = "";
  return NextResponse.redirect(ziel);
}

export const config = { matcher: ["/admin/:path*"] };
