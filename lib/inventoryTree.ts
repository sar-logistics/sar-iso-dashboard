import { getDb } from "@/lib/mongodb";

export interface InventoryNode {
  label: string;
  count: number;
  level: "principal" | "activity" | "from" | "to";
  children?: InventoryNode[];
  // Filter context — used by drill-down
  principal?: string;
  activity?: string;
  fromLocation?: string;
  toLocation?: string;
}

export interface InventoryTree {
  rows: InventoryNode[];
  totalCount: number;
  byActivity: { label: string; count: number }[];
  byPrincipal: { label: string; count: number }[];
  // Quick KPI counts
  kpis: {
    total: number;
    empty: number;
    loadedFull: number;
    onLease: number;
    underCleaning: number;
    underRepair: number;
    underSurvey: number;
    sentToConsignee: number;
  };
}

function classify(activity: string): {
  empty: number;
  loadedFull: number;
  onLease: number;
  underCleaning: number;
  underRepair: number;
  underSurvey: number;
  sentToConsignee: number;
} {
  const a = (activity || "").toUpperCase();
  return {
    empty: a.includes("EMPTY") ? 1 : 0,
    loadedFull: a.includes("LOADED") ? 1 : 0,
    onLease: a.includes("SUB LEASE") || a.includes("ON HIRE") ? 1 : 0,
    underCleaning: a.includes("CLEAN") || a.includes("WASH") ? 1 : 0,
    underRepair: a.includes("REPAIR") ? 1 : 0,
    underSurvey: a.includes("SURVEY") ? 1 : 0,
    sentToConsignee: a.includes("SENT TO CONSIGNEE") ? 1 : 0,
  };
}

/**
 * Build a 4-level tree: Principal → Activity → From → To.
 * Each leaf has a count of containers.
 */
export async function buildInventoryTree(): Promise<InventoryTree> {
  const db = await getDb();
  const col = db.collection("currentInventory");

  const agg = await col
    .aggregate([
      {
        $group: {
          _id: {
            principal: { $ifNull: ["$principal", "—"] },
            activity: { $ifNull: ["$activityName", "—"] },
            fromLocation: { $ifNull: ["$fromLocation", "—"] },
            toLocation: { $ifNull: ["$toLocation", "—"] },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ])
    .toArray();

  type Acc = Record<
    string,
    {
      label: string;
      count: number;
      children: Record<
        string,
        {
          label: string;
          count: number;
          children: Record<
            string,
            {
              label: string;
              count: number;
              children: Record<string, { label: string; count: number }>;
            }
          >;
        }
      >;
    }
  >;

  const tree: Acc = {};
  let totalCount = 0;
  const activityTotals: Record<string, number> = {};
  const principalTotals: Record<string, number> = {};
  const kpis = {
    total: 0,
    empty: 0,
    loadedFull: 0,
    onLease: 0,
    underCleaning: 0,
    underRepair: 0,
    underSurvey: 0,
    sentToConsignee: 0,
  };

  for (const row of agg) {
    const principal = String(row._id.principal || "—").trim() || "—";
    const activity = String(row._id.activity || "—").trim() || "—";
    const fromLoc = String(row._id.fromLocation || "—").trim() || "—";
    const toLoc = String(row._id.toLocation || "—").trim() || "—";
    const count = row.count as number;
    totalCount += count;
    activityTotals[activity] = (activityTotals[activity] || 0) + count;
    principalTotals[principal] = (principalTotals[principal] || 0) + count;

    const c = classify(activity);
    kpis.total += count;
    kpis.empty += c.empty * count;
    kpis.loadedFull += c.loadedFull * count;
    kpis.onLease += c.onLease * count;
    kpis.underCleaning += c.underCleaning * count;
    kpis.underRepair += c.underRepair * count;
    kpis.underSurvey += c.underSurvey * count;
    kpis.sentToConsignee += c.sentToConsignee * count;

    if (!tree[principal]) tree[principal] = { label: principal, count: 0, children: {} };
    tree[principal].count += count;
    if (!tree[principal].children[activity])
      tree[principal].children[activity] = { label: activity, count: 0, children: {} };
    tree[principal].children[activity].count += count;
    if (!tree[principal].children[activity].children[fromLoc])
      tree[principal].children[activity].children[fromLoc] = {
        label: fromLoc,
        count: 0,
        children: {},
      };
    tree[principal].children[activity].children[fromLoc].count += count;
    if (
      !tree[principal].children[activity].children[fromLoc].children[toLoc]
    )
      tree[principal].children[activity].children[fromLoc].children[toLoc] = {
        label: toLoc,
        count: 0,
      };
    tree[principal].children[activity].children[fromLoc].children[toLoc].count +=
      count;
  }

  // Convert nested maps to sorted arrays
  const rows: InventoryNode[] = Object.values(tree)
    .sort((a, b) => b.count - a.count)
    .map((p) => ({
      label: p.label,
      count: p.count,
      level: "principal" as const,
      principal: p.label,
      children: Object.values(p.children)
        .sort((a, b) => b.count - a.count)
        .map((a) => ({
          label: a.label,
          count: a.count,
          level: "activity" as const,
          principal: p.label,
          activity: a.label,
          children: Object.values(a.children)
            .sort((x, y) => y.count - x.count)
            .map((f) => ({
              label: f.label,
              count: f.count,
              level: "from" as const,
              principal: p.label,
              activity: a.label,
              fromLocation: f.label,
              children: Object.values(f.children)
                .sort((x, y) => y.count - x.count)
                .map((t) => ({
                  label: t.label,
                  count: t.count,
                  level: "to" as const,
                  principal: p.label,
                  activity: a.label,
                  fromLocation: f.label,
                  toLocation: t.label,
                })),
            })),
        })),
    }));

  const byActivity = Object.entries(activityTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));

  const byPrincipal = Object.entries(principalTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, count]) => ({ label, count }));

  return { rows, totalCount, byActivity, byPrincipal, kpis };
}
