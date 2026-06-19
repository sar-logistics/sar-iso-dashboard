import { auth } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toObjectId(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const _id = toObjectId(params.id);
  if (!_id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const updates: any = { updatedAt: new Date(), updatedBy: session.user.email };
    if (typeof body.chargeName === "string" && body.chargeName.trim()) {
      updates.chargeName = body.chargeName.trim();
    }
    if (typeof body.revenueCategory === "string") {
      updates.revenueCategory = body.revenueCategory.trim();
    }
    updates.source = "manual";

    const db = await getDb();
    const r = await db
      .collection("chargeMappings")
      .updateOne({ _id }, { $set: updates });

    if (r.matchedCount === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update mapping" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const _id = toObjectId(params.id);
  if (!_id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const r = await db.collection("chargeMappings").deleteOne({ _id });

    if (r.deletedCount === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to delete mapping" },
      { status: 500 }
    );
  }
}
