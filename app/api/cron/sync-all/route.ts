import { NextRequest, NextResponse } from "next/server";

/**
 * Hourly cron entry point. Vercel Cron sends an Authorization: Bearer <CRON_SECRET> header.
 * This endpoint then fans out to each individual sync route.
 *
 * As we add more syncs (purchase, detention, depot, inventory), append them to SYNC_PATHS.
 */
const SYNC_PATHS = ["/api/sync/sales"];

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = req.nextUrl.origin;
  const results: any[] = [];

  for (const path of SYNC_PATHS) {
    try {
      const r = await fetch(`${origin}${path}`, {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
        cache: "no-store",
      });
      results.push({ path, status: r.status, data: await r.json() });
    } catch (err: any) {
      results.push({ path, status: "error", error: err?.message });
    }
  }

  return NextResponse.json({ ranAt: new Date(), results });
}
