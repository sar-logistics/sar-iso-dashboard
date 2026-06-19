import { auth } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sheetFilter = searchParams.get("sheet")?.trim() || "";
  const statusFilter = searchParams.get("status")?.trim() || "";
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") || "100", 10) || 100, 1),
    500
  );

  try {
    const db = await getDb();
    const query: any = {};
    if (sheetFilter) query.sheetName = sheetFilter;
    if (statusFilter === "success" || statusFilter === "failure") {
      query.status = statusFilter;
    }

    const logs = await db
      .collection("syncLogs")
      .find(query)
      .sort({ syncedAt: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json({
      logs: logs.map((l: any) => ({
        _id: String(l._id),
        sheetName: l.sheetName || "Unknown",
        syncedAt: l.syncedAt
          ? new Date(l.syncedAt).toISOString()
          : null,
        rowsRead: l.rowsRead || 0,
        rowsInserted: l.rowsInserted || 0,
        status: l.status || (l.errorMsg ? "failure" : "success"),
        durationMs: l.durationMs || 0,
        errorMsg: l.errorMsg || null,
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load sync logs" },
      { status: 500 }
    );
  }
}
