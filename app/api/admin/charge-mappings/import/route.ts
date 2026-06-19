import { auth } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { getSheetValues } from "@/lib/google-sheets";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Re-imports all charge mappings from the Google Sheet, overwriting any
 * manual edits. The sheet tab is expected to be "Charge to Revenue Type Mapping"
 * with columns: Charge Name | Revenue Type.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) {
      throw new Error("GOOGLE_SHEET_ID is not set");
    }

    const rows = await getSheetValues(
      sheetId,
      "Charge to Revenue Type Mapping!A:B"
    );
    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: "Sheet tab returned no rows" },
        { status: 500 }
      );
    }

    // Skip header row
    const docs = rows
      .slice(1)
      .map((row: any[]) => ({
        chargeName: String(row[0] || "").trim(),
        revenueCategory: String(row[1] || "Other").trim(),
        source: "sheet" as const,
        updatedAt: new Date(),
      }))
      .filter((d) => d.chargeName);

    if (docs.length === 0) {
      return NextResponse.json(
        { error: "No valid mappings found in sheet" },
        { status: 500 }
      );
    }

    const db = await getDb();
    // Full replace: delete all and re-insert (matches existing sync behavior)
    await db.collection("chargeMappings").deleteMany({});
    await db.collection("chargeMappings").insertMany(docs);

    // Log this manual re-import
    await db.collection("syncLogs").insertOne({
      sheetName: "Charge to Revenue Type Mapping",
      syncedAt: new Date(),
      rowsRead: rows.length - 1,
      rowsInserted: docs.length,
      status: "success",
      durationMs: 0,
      manualTriggerBy: session.user.email,
    });

    return NextResponse.json({ ok: true, count: docs.length });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to import mappings" },
      { status: 500 }
    );
  }
}
