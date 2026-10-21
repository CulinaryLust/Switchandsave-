import { NextResponse, type NextRequest } from "next/server";

// HTTP Basic Auth für den Betreiberbereich. Für den Livebetrieb durch ein echtes Login mit 2FA ersetzen.
export function middleware(req: NextRequest) {
  const user = process.env.ADMIN_USER ?? "admin";
  const pass = process.env.ADMIN_PASSWORD ?? "switchandsave";
  const header = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const [u, ...rest] = atob(encoded).split(":");
    if (u === user && rest.join(":") === pass) return NextResponse.next();
  }
  return new NextResponse("Anmeldung erforderlich", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Switchandsave Admin"' } });
}

export const config = { matcher: ["/admin/:path*"] };
