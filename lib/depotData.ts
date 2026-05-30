import { getDb } from "@/lib/mongodb";

export interface DepotRow {
  _id: string;
  country: string;
  depotName: string;
  port: string;
  agent: string;
  controller: string;
  allocated: number;
  underCleaning: number;
  underRepair: number;
  underSurvey: number;
  availableBuckets: Record<string, number>;
  totalAvailable: number;
  totalAtDepot: number;
}

export interface DepotData {
  rows: DepotRow[];
  ageingBuckets: string[]; // ordered list of Available bucket labels
  kpis: {
    total: number;
    allocated: number;
    underCleaning: number;
    underRepair: number;
    underSurvey: number;
    available: number;
    agedOver60: number; // sum of all buckets that don't start with "(<" or "(<30"
  };
  byCountry: { label: string; count: number }[];
  statusMix: { label: string; count: number }[];
}

/** Heuristic — buckets with "<30" or "0-30" are NOT aged, the rest with numbers >60 are. */
function isAgedBucket(label: string): boolean {
  const lower = label.toLowerCase();
  // matches "(61-90)" "(61+)" "(>60)" "(>90)" — but NOT "(<30)" or "(0-30)"
  if (/<\s*\d+/.test(lower)) return false;
  if (/^available\s*\(?\s*0/.test(lower)) return false;
  const m = lower.match(/(\d+)/);
  if (!m) return false;
  return parseInt(m[1], 10) >= 60;
}

export async function buildDepotData(): Promise<DepotData> {
  const db = await getDb();
  const docs = (await db
    .collection("depotReport")
    .find({})
    .sort({ country: 1, depotName: 1 })
    .toArray()) as any[];

  // Collect all ageing-bucket labels in stable order — preserve sheet column order
  const bucketSet = new Set<string>();
  const bucketOrder: string[] = [];
  for (const d of docs) {
    const buckets = d.availableBuckets || {};
    for (const k of Object.keys(buckets)) {
      if (!bucketSet.has(k)) {
        bucketSet.add(k);
        bucketOrder.push(k);
      }
    }
  }

  const rows: DepotRow[] = docs.map((d) => ({
    _id: String(d._id),
    country: d.country || "—",
    depotName: d.depotName || "—",
    port: d.port || "—",
    agent: d.agent || "—",
    controller: d.controller || "—",
    allocated: d.allocated || 0,
    underCleaning: d.underCleaning || 0,
    underRepair: d.underRepair || 0,
    underSurvey: d.underSurvey || 0,
    availableBuckets: d.availableBuckets || {},
    totalAvailable: d.totalAvailable || 0,
    totalAtDepot: d.totalAtDepot || 0,
  }));

  const kpis = {
    total: 0,
    allocated: 0,
    underCleaning: 0,
    underRepair: 0,
    underSurvey: 0,
    available: 0,
    agedOver60: 0,
  };
  const byCountryMap: Record<string, number> = {};

  for (const r of rows) {
    kpis.total += r.totalAtDepot;
    kpis.allocated += r.allocated;
    kpis.underCleaning += r.underCleaning;
    kpis.underRepair += r.underRepair;
    kpis.underSurvey += r.underSurvey;
    kpis.available += r.totalAvailable;
    for (const [label, v] of Object.entries(r.availableBuckets)) {
      if (isAgedBucket(label)) kpis.agedOver60 += v as number;
    }
    byCountryMap[r.country] = (byCountryMap[r.country] || 0) + r.totalAtDepot;
  }

  const byCountry = Object.entries(byCountryMap)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));

  const statusMix = [
    { label: "Allocated", count: kpis.allocated },
    { label: "Under Cleaning", count: kpis.underCleaning },
    { label: "Under Repair", count: kpis.underRepair },
    { label: "Under Survey", count: kpis.underSurvey },
    { label: "Available", count: kpis.available },
  ].filter((d) => d.count > 0);

  return {
    rows,
    ageingBuckets: bucketOrder,
    kpis,
    byCountry,
    statusMix,
  };
}
