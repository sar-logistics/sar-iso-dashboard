import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = new URL(req.url).searchParams;
  const principal = sp.get("principal") || null;
  const activity = sp.get("activity") || null;
  const fromLocation = sp.get("from") || null;
  const toLocation = sp.get("to") || null;
  const agent = sp.get("agent") || null;
  const kpiBucket = sp.get("kpi") || null; // for KPI card clicks

  const filter: any = {};
  if (principal && principal !== "—") filter.principal = principal;
  if (activity && activity !== "—") filter.activityName = activity;
  if (fromLocation && fromLocation !== "—") filter.fromLocation = fromLocation;
  if (toLocation && toLocation !== "—") filter.toLocation = toLocation;
  if (agent) filter.agent = agent;

  // KPI bucket → activity-name regex
  if (kpiBucket) {
    const regexMap: Record<string, RegExp> = {
      empty: /EMPTY/i,
      loadedFull: /LOADED/i,
      onLease: /(SUB LEASE|ON HIRE)/i,
      underCleaning: /(CLEAN|WASH)/i,
      underRepair: /REPAIR/i,
      underSurvey: /SURVEY/i,
      sentToConsignee: /SENT TO CONSIGNEE/i,
    };
    if (regexMap[kpiBucket]) filter.activityName = { $regex: regexMap[kpiBucket] };
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
    .sort({ activityDate: -1 })
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
  });
}
