import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { readSheet } from "@/lib/google-sheets";
import { toNumber } from "@/lib/utils";
import type { SyncLog } from "@/types";

const SHEET_NAME = "Depot Report";
const HEADER_ROW = 0;

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

function findIdx(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const i = headers.findIndex(
      (h) => h.toLowerCase().trim() === c.toLowerCase().trim()
    );
    if (i >= 0) return i;
  }
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
    if (rows.length <= 1) throw new Error("No data rows in Depot Report");

    const headers = rows[HEADER_ROW].map((h: any) => String(h || "").trim());

    const cols = {
      country: findIdx(headers, ["Depot Country", "Country"]),
      name: findIdx(headers, ["Depot Name", "Name"]),
      port: findIdx(headers, ["Depot Port", "Port"]),
      agent: findIdx(headers, ["Depot Agent", "Agent"]),
      controller: findIdx(headers, ["Depot Controller", "Controller"]),
      allocated: findIdx(headers, ["Allocated"]),
      underCleaning: findIdx(headers, ["Under Cleaning"]),
      underRepair: findIdx(headers, ["Under Repair"]),
      underSurvey: findIdx(headers, ["Under Survey"]),
    };

    if (cols.name < 0) {
      const debug = headers
        .slice(0, 10)
        .map((h) => `"${h}"`)
        .join(", ");
      throw new Error(
        `Could not find 'Depot Name' column. First 10 columns: [${debug}]`
      );
    }

    // Dynamically pick up all "Available (...)" ageing buckets
    const availableCols = headers
      .map((h, i) => ({ label: h, idx: i }))
      .filter((c) => c.label.toLowerCase().startsWith("available"));

    const docs: any[] = [];

    for (let r = HEADER_ROW + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const depotName =
        cols.name >= 0 ? String(row[cols.name] ?? "").trim() : "";
      const port =
        cols.port >= 0 ? String(row[cols.port] ?? "").trim() : "";

      // Skip "TOTAL" rows that summarise each country
      if (
        !depotName ||
        depotName.toUpperCase() === "TOTAL" ||
        !port
      )
        continue;

      // Ageing buckets
      const availableBuckets: Record<string, number> = {};
      let totalAvailable = 0;
      for (const ac of availableCols) {
        const v = toNumber(row[ac.idx]);
        availableBuckets[ac.label] = v;
        totalAvailable += v;
      }

      const allocated = cols.allocated >= 0 ? toNumber(row[cols.allocated]) : 0;
      const underCleaning =
        cols.underCleaning >= 0 ? toNumber(row[cols.underCleaning]) : 0;
      const underRepair =
        cols.underRepair >= 0 ? toNumber(row[cols.underRepair]) : 0;
      const underSurvey =
        cols.underSurvey >= 0 ? toNumber(row[cols.underSurvey]) : 0;

      const raw: Record<string, any> = {};
      for (let c = 0; c < headers.length; c++) {
        const h = headers[c];
        if (h && row[c] !== undefined && row[c] !== "") raw[h] = row[c];
      }

      docs.push({
        country:
          cols.country >= 0 ? String(row[cols.country] ?? "").trim() : "",
        depotName,
        port,
        agent:
          cols.agent >= 0 ? String(row[cols.agent] ?? "").trim() : "",
        controller:
          cols.controller >= 0
            ? String(row[cols.controller] ?? "").trim()
            : "",
        allocated,
        underCleaning,
        underRepair,
        underSurvey,
        availableBuckets,
        totalAvailable,
        totalAtDepot:
          allocated +
          underCleaning +
          underRepair +
          underSurvey +
          totalAvailable,
        raw,
        syncedAt: new Date(),
      });
    }

    const db = await getDb();
    await db.collection("depotReport").deleteMany({});
    if (docs.length) await db.collection("depotReport").insertMany(docs);
    await db.collection("depotReport").createIndex({ country: 1 });
    await db.collection("depotReport").createIndex({ depotName: 1 });

    log.rowsInserted = docs.length;
    (log as any).ageingBuckets = availableCols.map((c) => c.label);
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
