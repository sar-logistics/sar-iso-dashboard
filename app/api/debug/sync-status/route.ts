import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Debug endpoint — visit while logged in to see exactly what is in MongoDB.
 * Helps diagnose stale "Last sync" timestamps.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const db = await getDb();

  const recentLogs = await db
    .collection("syncLogs")
    .find({})
    .sort({ syncedAt: -1 })
    .limit(20)
    .toArray();

  const [salesCount, invCount, depotCount, mapCount, logCount] =
    await Promise.all([
      db.collection("salesRegister").countDocuments(),
      db.collection("currentInventory").countDocuments(),
      db.collection("depotReport").countDocuments(),
      db.collection("chargeMappings").countDocuments(),
      db.collection("syncLogs").countDocuments(),
    ]);

  const istTime = (d: Date | string | undefined | null) => {
    if (!d) return null;
    const dt = typeof d === "string" ? new Date(d) : d;
    return dt.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Kolkata",
    });
  };

  const distinctSheetNames = await db
    .collection("syncLogs")
    .distinct("sheetName");

  return NextResponse.json(
    {
      serverTimeNow: {
        utc: new Date().toISOString(),
        ist: istTime(new Date()),
      },
      collectionCounts: {
        salesRegister: salesCount,
        currentInventory: invCount,
        depotReport: depotCount,
        chargeMappings: mapCount,
        syncLogs: logCount,
      },
      distinctSheetNamesInLogs: distinctSheetNames,
      last20SyncLogs: recentLogs.map((l: any) => ({
        sheetName: l.sheetName,
        syncedAtUtc: l.syncedAt,
        syncedAtIst: istTime(l.syncedAt),
        rowsRead: l.rowsRead ?? null,
        rowsInserted: l.rowsInserted ?? null,
        status: l.status ?? null,
        errorMsg: l.errorMsg ?? null,
      })),
    },
    {
      headers: {
        "Cache-Control": "no-store, must-revalidate",
      },
    }
  );
}
