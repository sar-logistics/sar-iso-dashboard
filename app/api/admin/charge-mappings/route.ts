import { auth } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const docs = await db
      .collection("chargeMappings")
      .find({})
      .sort({ chargeName: 1 })
      .toArray();

    return NextResponse.json({
      mappings: docs.map((d: any) => ({
        _id: String(d._id),
        chargeName: d.chargeName || "",
        revenueCategory: d.revenueCategory || "Other",
        source: d.source || "sheet",
        updatedAt: d.updatedAt
          ? new Date(d.updatedAt).toISOString()
          : null,
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load mappings" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const chargeName = String(body.chargeName || "").trim();
    const revenueCategory = String(body.revenueCategory || "Other").trim();
    if (!chargeName) {
      return NextResponse.json(
        { error: "chargeName is required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    // Upsert by chargeName (case-insensitive uniqueness)
    const existing = await db.collection("chargeMappings").findOne({
      chargeName: { $regex: `^${chargeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    });
    if (existing) {
      return NextResponse.json(
        { error: `A mapping for "${existing.chargeName}" already exists` },
        { status: 409 }
      );
    }

    const r = await db.collection("chargeMappings").insertOne({
      chargeName,
      revenueCategory,
      source: "manual",
      updatedAt: new Date(),
      updatedBy: session.user.email,
    });

    return NextResponse.json({ _id: String(r.insertedId), ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create mapping" },
      { status: 500 }
    );
  }
}
