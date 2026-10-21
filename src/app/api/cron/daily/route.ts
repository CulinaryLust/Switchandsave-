import { NextResponse, type NextRequest } from "next/server";
import { tageslauf } from "@/server/prozess";

export const dynamic = "force-dynamic";

/** Täglich per Cron aufrufen: /api/cron/daily?secret=CRON_SECRET */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.nextUrl.searchParams.get("secret") !== secret) return NextResponse.json({ fehler: "nicht autorisiert" }, { status: 401 });
  return NextResponse.json(await tageslauf());
}
