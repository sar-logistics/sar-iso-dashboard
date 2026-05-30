import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";

/**
 * Depot drill-down. The Depot Report has aggregated counts; the
 * Current Inventory has per-container detail. We do a best-effort
 * join by matching the depot's port against the From Location of
 * inventory rows, and the bucket (e.g. "Under Repair") against the
 * inventory Activity Name.
 */
const BUCKET_TO_ACTIVITY_REGEX: Record<string, RegExp> = {
  allocated: /(EMPTY AVAILABLE|LOADED|SENT|SUB LEASE|ON HIRE)/i,
  underCleaning: /(CLEAN|WASH)/i,
  underRepair: /REPAIR/i,
  underSurvey: /SURVEY/i,
  available: /EMPTY AVAILABLE/i,
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = new URL(req.url).searchParams;
  const country = sp.get("country") || null;
  const depotName = sp.get("depot") || null;
  const port = sp.get("port") || null;
  const bucket = sp.get("bucket") || null; // allocated|underCleaning|underRepair|underSurvey|available
  const ageingLabel = sp.get("ageing") || null; // e.g. "Available (<30)"

  const filter: any = {};
  // Location match — try port first, then depotName as fallback
  if (port) {
    filter.fromLocation = port;
  } else if (depotName) {
    filter.fromLocation = depotName;
  }

  if (bucket && BUCKET_TO_ACTIVITY_REGEX[bucket]) {
    filter.activityName = { $regex: BUCKET_TO_ACTIVITY_REGEX[bucket] };
  } else if (ageingLabel) {
    // Ageing bucket → empty available with idleDays range
    filter.activityName = { $regex: /EMPTY AVAILABLE/i };
    const m = ageingLabel.match(/(\d+)\s*-\s*(\d+)|<\s*(\d+)|>\s*(\d+)|(\d+)\s*\+/);
    if (m) {
      if (m[1] && m[2]) {
        filter.idleDays = { $gte: parseInt(m[1], 10), $lte: parseInt(m[2], 10) };
      } else if (m[3]) {
        filter.idleDays = { $lt: parseInt(m[3], 10) };
      } else if (m[4]) {
        filter.idleDays = { $gt: parseInt(m[4], 10) };
      } else if (m[5]) {
        filter.idleDays = { $gte: parseInt(m[5], 10) };
      }
    }
  }

  const db = await getDb();
  const rows = await db
    .collection("currentInventory")
    .find(filter, {
      projection: {
        containerNo: 1,
        size: 1,
        type: 1,
        principal: 1,
        activityName: 1,
        activityDate: 1,
        idleDays: 1,
        agent: 1,
        agentBranch: 1,
        fromLocation: 1,
        toLocation: 1,
      },
    })
    .sort({ idleDays: -1, activityDate: -1 })
    .limit(500)
    .toArray();

  const totalAgg = await db
    .collection("currentInventory")
    .aggregate([{ $match: filter }, { $count: "n" }])
    .toArray();
  const count = totalAgg[0]?.n || 0;

  return NextResponse.json({
    rows,
    count,
    truncated: count > 500,
    filterUsed: filter,
  });
}
