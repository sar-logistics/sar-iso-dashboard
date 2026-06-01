import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { readSheet } from "@/lib/google-sheets";
import { parseSheetDate, toNumber } from "@/lib/utils";
import type { SyncLog } from "@/types";


export const maxDuration = 60;
export const dynamic = "force-dynamic";

const SHEET_NAME = "Current Inventory Report";
const HEADER_ROW = 0; // 0-indexed → data starts at row 1

async function authorize(req: NextRequest): Promise<boolean> {
  const cronHeader = req.headers.get("authorization");
  if (cronHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  const session = await auth();
  return !!session?.user?.email;
}

export async function POST(req: NextRequest) {
  return handleSync(req);
}
export async function GET(req: NextRequest) {
  return handleSync(req);
}

/** Locate a header by trying multiple candidate names (first match wins). */
function findIdx(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const i = headers.findIndex(
      (h) => h.toLowerCase().trim() === c.toLowerCase().trim()
    );
    if (i >= 0) return i;
  }
  // fallback to "contains"
  for (const c of candidates) {
    const i = headers.findIndex((h) =>
      h.toLowerCase().includes(c.toLowerCase())
    );
    if (i >= 0) return i;
  }
  return -1;
}

async function handleSync(req: NextRequest) {
  const t0 = Date.now();
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log: SyncLog = {
    sheetName: SHEET_NAME,
    syncedAt: new Date(),
    rowsRead: 0,
    rowsInserted: 0,
    status: "success",
    durationMs: 0,
  };

  try {
    const rows = await readSheet(SHEET_NAME);
    log.rowsRead = Math.max(0, rows.length - 1);
    if (rows.length <= 1) throw new Error("No data rows in Current Inventory Report");

    const headers = rows[HEADER_ROW].map((h: any) => String(h || "").trim());

    const cols = {
      containerNo: findIdx(headers, ["Container No", "Container Number"]),
      size: findIdx(headers, ["Size", "S"]),
      type: findIdx(headers, ["Type"]),
      principal: findIdx(headers, ["Principal"]),
      activityName: findIdx(headers, ["Activity Name", "Activity"]),
      activityDate: findIdx(headers, ["Activity Date"]),
      agent: findIdx(headers, ["Agent"]),
      agentBranch: findIdx(headers, ["Agent Branch"]),
      fromLocation: findIdx(headers, ["From Location", "From Loc"]),
      toLocation: findIdx(headers, ["To Location", "To Loc"]),
    };

    if (cols.containerNo < 0) {
      const debug = headers
        .slice(0, 10)
        .map((h) => `"${h}"`)
        .join(", ");
      throw new Error(
        `Could not find 'Container No' header. First 10 columns: [${debug}]`
      );
    }

    const docs: any[] = [];
    const now = new Date();

    for (let r = HEADER_ROW + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const containerNo = String(row[cols.containerNo] || "").trim();
      if (!containerNo) continue;

      const activityDate = parseSheetDate(row[cols.activityDate]);
      const idleDays = activityDate
        ? Math.floor((now.getTime() - activityDate.getTime()) / 86400000)
        : null;

      // Capture all columns as raw for future flexibility
      const raw: Record<string, any> = {};
      for (let c = 0; c < headers.length; c++) {
        const h = headers[c];
        if (h && row[c] !== undefined && row[c] !== "") raw[h] = row[c];
      }

      docs.push({
        containerNo,
        size:
          cols.size >= 0 ? String(row[cols.size] ?? "").trim() : "",
        type:
          cols.type >= 0 ? String(row[cols.type] ?? "").trim() : "",
        principal:
          cols.principal >= 0
            ? String(row[cols.principal] ?? "").trim()
            : "",
        activityName:
          cols.activityName >= 0
            ? String(row[cols.activityName] ?? "").trim()
            : "",
        activityDate,
        idleDays,
        agent:
          cols.agent >= 0 ? String(row[cols.agent] ?? "").trim() : "",
        agentBranch:
          cols.agentBranch >= 0
            ? String(row[cols.agentBranch] ?? "").trim()
            : "",
        fromLocation:
          cols.fromLocation >= 0
            ? String(row[cols.fromLocation] ?? "").trim()
            : "",
        toLocation:
          cols.toLocation >= 0
            ? String(row[cols.toLocation] ?? "").trim()
            : "",
        raw,
        syncedAt: now,
      });
    }

    const db = await getDb();
    await db.collection("currentInventory").deleteMany({});
    if (docs.length)
      await db.collection("currentInventory").insertMany(docs);

    await db.collection("currentInventory").createIndex({ containerNo: 1 });
    await db.collection("currentInventory").createIndex({ agent: 1 });
    await db.collection("currentInventory").createIndex({ activityName: 1 });
    await db.collection("currentInventory").createIndex({ principal: 1 });
    await db.collection("currentInventory").createIndex({ activityDate: -1 });

    log.rowsInserted = docs.length;
    (log as any).headersFound = headers.filter(Boolean).length;
  } catch (err: any) {
    log.status = "error";
    log.errorMsg = err?.message || String(err);
  } finally {
    log.durationMs = Date.now() - t0;
    try {
      const db = await getDb();
      await db.collection("syncLogs").insertOne(log);
    } catch {}
  }

  return NextResponse.json(log, {
    status: log.status === "success" ? 200 : 500,
  });
}
