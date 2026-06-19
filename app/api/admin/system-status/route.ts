import { auth } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const REQUIRED_ENV_VARS = [
  "MONGODB_URI",
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "ALLOWED_EMAILS",
  "GOOGLE_SHEET_ID",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "CRON_SECRET",
];

const TRACKED_COLLECTIONS = [
  "salesRegister",
  "currentInventory",
  "depotReport",
  "chargeMappings",
  "syncLogs",
  "allowedUsers",
];

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Env var presence check (no values exposed)
  const envVars = REQUIRED_ENV_VARS.map((name) => ({
    name,
    present: !!process.env[name],
  }));

  // Database check
  let database: any = { ok: false };
  let collections: { name: string; count: number }[] = [];
  let cronStatus: any = {
    ok: false,
    lastSyncAt: null,
    minutesSinceLastSync: null,
    recentSuccessCount: 0,
    recentFailureCount: 0,
  };

  try {
    const t0 = Date.now();
    const db = await getDb();
    // Lightweight ping via stats
    await db.command({ ping: 1 });
    database = { ok: true, latencyMs: Date.now() - t0 };

    // Collection counts
    const counts = await Promise.all(
      TRACKED_COLLECTIONS.map(async (name) => {
        try {
          const count = await db.collection(name).estimatedDocumentCount();
          return { name, count };
        } catch {
          return { name, count: 0 };
        }
      })
    );
    collections = counts;

    // Cron health from syncLogs
    const lastSuccess = await db
      .collection("syncLogs")
      .find({ status: "success" })
      .sort({ syncedAt: -1 })
      .limit(1)
      .toArray();
    const last = lastSuccess[0];
    if (last?.syncedAt) {
      const lastDate = new Date(last.syncedAt);
      const minutesSince = Math.floor(
        (Date.now() - lastDate.getTime()) / 60000
      );
      cronStatus = {
        ok: minutesSince <= 5, // healthy if synced in the last 5 minutes
        lastSyncAt: lastDate.toISOString(),
        minutesSinceLastSync: minutesSince,
      };
    }
    // Recent success/failure counts in last 100 events
    const recent = await db
      .collection("syncLogs")
      .find({})
      .sort({ syncedAt: -1 })
      .limit(100)
      .toArray();
    cronStatus.recentSuccessCount = recent.filter(
      (l: any) => l.status === "success"
    ).length;
    cronStatus.recentFailureCount = recent.filter(
      (l: any) => l.status === "failure"
    ).length;
  } catch (err: any) {
    database = { ok: false, error: err.message || String(err) };
  }

  const now = new Date();

  return NextResponse.json({
    database,
    cron: cronStatus,
    envVars,
    collections,
    serverTime: now.toISOString(),
    serverTimeIst: now.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Kolkata",
    }),
  });
}
