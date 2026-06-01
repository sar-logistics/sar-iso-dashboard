import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Allow up to 60 seconds (Vercel Pro limit) — default is only 10s
// which is not enough for 3 sequential sheet syncs.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Sync orchestrator. Used by:
 *   1. Vercel Cron — sends `Authorization: Bearer <CRON_SECRET>`
 *   2. Manual page navigation by an authenticated user
 *
 * Fans out to each individual sync route IN PARALLEL so we stay well
 * under the function timeout even if any one sheet is slow.
 */
const SYNC_PATHS = ["/api/sync/sales", "/api/sync/inventory", "/api/sync/depot"];

async function authorize(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  const session = await auth();
  return !!session?.user?.email;
}

async function callSync(origin: string, path: string, cookie: string) {
  const t0 = Date.now();
  try {
    const r = await fetch(`${origin}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET || ""}`,
        cookie,
      },
      cache: "no-store",
    });

    let data: any = null;
    let parseError: string | null = null;
    try {
      data = await r.json();
    } catch {
      parseError = `Non-JSON response (HTTP ${r.status})`;
    }

    return {
      path,
      ok: r.ok,
      status: r.status,
      sheet: data?.sheetName,
      rowsInserted: data?.rowsInserted ?? null,
      rowsRead: data?.rowsRead ?? null,
      durationMs: data?.durationMs ?? Date.now() - t0,
      errorMsg: data?.errorMsg ?? parseError ?? null,
    };
  } catch (err: any) {
    return {
      path,
      ok: false,
      status: 0,
      durationMs: Date.now() - t0,
      errorMsg: err?.message || String(err),
    };
  }
}

async function runAll(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = req.nextUrl.origin;
  const cookie = req.headers.get("cookie") || "";

  // Parallel — total wall time ≈ slowest single sync, not sum of all three
  const results = await Promise.all(
    SYNC_PATHS.map((path) => callSync(origin, path, cookie))
  );

  const totalInserted = results.reduce(
    (s, r) => s + (r.rowsInserted || 0),
    0
  );
  const allOk = results.every((r) => r.ok);
  const anyOk = results.some((r) => r.ok);

  // Return 200 if at least one sync succeeded (partial progress is real
  // progress and we don't want Vercel logs all-red when only one is down).
  // 500 only when EVERY sync failed — then it's a real systemic problem.
  return NextResponse.json(
    { ranAt: new Date(), ok: allOk, totalInserted, results },
    { status: anyOk ? 200 : 500 }
  );
}

export async function GET(req: NextRequest) {
  return runAll(req);
}
export async function POST(req: NextRequest) {
  return runAll(req);
}
