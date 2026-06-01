import { getDb } from "@/lib/mongodb";

export interface InventoryNode {
  label: string;
  count: number;
  level: "principal" | "activity" | "from" | "to" | "agent";
  children?: InventoryNode[];
  // Filter context — used by drill-down
  principal?: string;
  activity?: string;
  fromLocation?: string;
  toLocation?: string;
  agent?: string;
}

export interface InventoryTree {
  rows: InventoryNode[];
  totalCount: number;
  byActivity: { label: string; count: number }[];
  byPrincipal: { label: string; count: number }[];
  byAgent: { label: string; count: number }[];
  kpis: {
    total: number;
    empty: number;
    loadedFull: number;
    onLease: number;
    underCleaning: number;
    underRepair: number;
    underSurvey: number;
    sentToConsignee: number;
    other: number;
  };
}

function classify(activity: string) {
  const a = (activity || "").toUpperCase();
  const c = {
    empty: a.includes("EMPTY") ? 1 : 0,
    loadedFull: a.includes("LOADED") ? 1 : 0,
    onLease: a.includes("SUB LEASE") || a.includes("ON HIRE") ? 1 : 0,
    underCleaning: a.includes("CLEAN") || a.includes("WASH") ? 1 : 0,
    underRepair: a.includes("REPAIR") ? 1 : 0,
    underSurvey: a.includes("SURVEY") ? 1 : 0,
    sentToConsignee: a.includes("SENT TO CONSIGNEE") ? 1 : 0,
  };
  // If no bucket matched, count as "Other Activity"
  const matched =
    c.empty +
    c.loadedFull +
    c.onLease +
    c.underCleaning +
    c.underRepair +
    c.underSurvey +
    c.sentToConsignee;
  return { ...c, other: matched === 0 ? 1 : 0 };
}

/**
 * Build a 5-level tree: Principal → Activity → From → To → Agent.
 * Each leaf has a container count.
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
            agent: { $ifNull: ["$agent", "—"] },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ])
    .toArray();

  // Map: principal → activity → from → to → agent → count
  type LeafAgent = { label: string; count: number };
  type LeafTo = {
    label: string;
    count: number;
    children: Record<string, LeafAgent>;
  };
  type LeafFrom = {
    label: string;
    count: number;
    children: Record<string, LeafTo>;
  };
  type LeafActivity = {
    label: string;
    count: number;
    children: Record<string, LeafFrom>;
  };
  type LeafPrincipal = {
    label: string;
    count: number;
    children: Record<string, LeafActivity>;
  };

  const tree: Record<string, LeafPrincipal> = {};
  let totalCount = 0;
  const activityTotals: Record<string, number> = {};
  const principalTotals: Record<string, number> = {};
  const agentTotals: Record<string, number> = {};

  const kpis = {
    total: 0,
    empty: 0,
    loadedFull: 0,
    onLease: 0,
    underCleaning: 0,
    underRepair: 0,
    underSurvey: 0,
    sentToConsignee: 0,
    other: 0,
  };

  for (const row of agg) {
    const principal = String(row._id.principal || "—").trim() || "—";
    const activity = String(row._id.activity || "—").trim() || "—";
    const fromLoc = String(row._id.fromLocation || "—").trim() || "—";
    const toLoc = String(row._id.toLocation || "—").trim() || "—";
    const agent = String(row._id.agent || "—").trim() || "—";
    const count = row.count as number;

    totalCount += count;
    activityTotals[activity] = (activityTotals[activity] || 0) + count;
    principalTotals[principal] = (principalTotals[principal] || 0) + count;
    if (agent !== "—")
      agentTotals[agent] = (agentTotals[agent] || 0) + count;

    const c = classify(activity);
    kpis.total += count;
    kpis.empty += c.empty * count;
    kpis.loadedFull += c.loadedFull * count;
    kpis.onLease += c.onLease * count;
    kpis.underCleaning += c.underCleaning * count;
    kpis.underRepair += c.underRepair * count;
    kpis.underSurvey += c.underSurvey * count;
    kpis.sentToConsignee += c.sentToConsignee * count;
    kpis.other += c.other * count;

    if (!tree[principal])
      tree[principal] = { label: principal, count: 0, children: {} };
    tree[principal].count += count;

    if (!tree[principal].children[activity])
      tree[principal].children[activity] = {
        label: activity,
        count: 0,
        children: {},
      };
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
        children: {},
      };
    tree[principal].children[activity].children[fromLoc].children[toLoc].count +=
      count;

    if (
      !tree[principal].children[activity].children[fromLoc].children[toLoc]
        .children[agent]
    )
      tree[principal].children[activity].children[fromLoc].children[
        toLoc
      ].children[agent] = { label: agent, count: 0 };
    tree[principal].children[activity].children[fromLoc].children[toLoc].children[
      agent
    ].count += count;
  }

  // Convert to sorted nested array structure
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
                  children: Object.values(t.children)
                    .sort((x, y) => y.count - x.count)
                    .map((g) => ({
                      label: g.label,
                      count: g.count,
                      level: "agent" as const,
                      principal: p.label,
                      activity: a.label,
                      fromLocation: f.label,
                      toLocation: t.label,
                      agent: g.label,
                    })),
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

  const byAgent = Object.entries(agentTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, count]) => ({ label, count }));

  return { rows, totalCount, byActivity, byPrincipal, byAgent, kpis };
}
