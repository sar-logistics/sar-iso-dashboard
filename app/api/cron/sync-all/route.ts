import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Sync orchestrator. Used by:
 *   1. Vercel Cron — sends `Authorization: Bearer <CRON_SECRET>`
 *   2. The Sync Now button — uses a signed-in user session
 *
 * Either auth method is acceptable. The route then fans out to each
 * individual sync route in sequence so we get a consolidated result.
 */
const SYNC_PATHS = ["/api/sync/sales", "/api/sync/inventory", "/api/sync/depot"];

async function authorize(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  const session = await auth();
  return !!session?.user?.email;
}

async function runAll(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = req.nextUrl.origin;
  const results: any[] = [];

  for (const path of SYNC_PATHS) {
    try {
      const r = await fetch(`${origin}${path}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${process.env.CRON_SECRET}`,
          // Forward cookie so the downstream route also sees the user session
          cookie: req.headers.get("cookie") || "",
        },
        cache: "no-store",
      });
      const data = await r.json();
      results.push({
        path,
        ok: r.ok,
        sheet: data?.sheetName,
        rowsInserted: data?.rowsInserted ?? null,
        rowsRead: data?.rowsRead ?? null,
        durationMs: data?.durationMs ?? null,
        errorMsg: data?.errorMsg ?? null,
      });
    } catch (err: any) {
      results.push({ path, ok: false, errorMsg: err?.message || String(err) });
    }
  }

  const totalInserted = results.reduce(
    (s, r) => s + (r.rowsInserted || 0),
    0
  );
  const allOk = results.every((r) => r.ok);

  return NextResponse.json(
    { ranAt: new Date(), ok: allOk, totalInserted, results },
    { status: allOk ? 200 : 500 }
  );
}

export async function GET(req: NextRequest) {
  return runAll(req);
}
export async function POST(req: NextRequest) {
  return runAll(req);
}
