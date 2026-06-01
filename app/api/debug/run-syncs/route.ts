import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Debug endpoint — visit while logged in to actively trigger each sync
 * and capture the exact response. Surfaces any silent failures.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const origin = req.nextUrl.origin;
  const cookie = req.headers.get("cookie") || "";

  const paths = ["/api/sync/sales", "/api/sync/inventory", "/api/sync/depot"];

  const results = await Promise.all(
    paths.map(async (path) => {
      const t0 = Date.now();
      try {
        // Method 1: forward our session cookie (this is what a real user would do)
        const r = await fetch(`${origin}${path}`, {
          method: "POST",
          headers: { cookie },
          cache: "no-store",
        });
        const text = await r.text();
        let body: any = text;
        try {
          body = JSON.parse(text);
        } catch {}
        return {
          path,
          httpStatus: r.status,
          httpOk: r.ok,
          responseTimeMs: Date.now() - t0,
          responseBody: body,
        };
      } catch (err: any) {
        return {
          path,
          httpStatus: 0,
          httpOk: false,
          responseTimeMs: Date.now() - t0,
          error: err?.message || String(err),
        };
      }
    })
  );

  // Also test what happens with Bearer CRON_SECRET (simulating the cron)
  const cronTestResults = await Promise.all(
    paths.map(async (path) => {
      const t0 = Date.now();
      try {
        const r = await fetch(`${origin}${path}`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${process.env.CRON_SECRET || ""}`,
          },
          cache: "no-store",
        });
        const text = await r.text();
        let body: any = text;
        try {
          body = JSON.parse(text);
        } catch {}
        return {
          path,
          httpStatus: r.status,
          httpOk: r.ok,
          responseTimeMs: Date.now() - t0,
          responseBody: body,
        };
      } catch (err: any) {
        return {
          path,
          httpStatus: 0,
          httpOk: false,
          responseTimeMs: Date.now() - t0,
          error: err?.message || String(err),
        };
      }
    })
  );

  return NextResponse.json(
    {
      origin,
      cronSecretLen: (process.env.CRON_SECRET || "").length,
      cronSecretSet: !!process.env.CRON_SECRET,
      asLoggedInUser: results,
      asCronWithBearer: cronTestResults,
    },
    { headers: { "Cache-Control": "no-store, must-revalidate" } }
  );
}
