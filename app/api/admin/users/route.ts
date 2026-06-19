import { auth } from "@/lib/auth";
import {
  addAllowedUser,
  listAllowedUsers,
} from "@/lib/allowedUsers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const users = await listAllowedUsers();
    return NextResponse.json({
      users: users.map((u) => ({
        ...u,
        addedAt: u.addedAt ? new Date(u.addedAt).toISOString() : null,
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load users" },
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
    const email = String(body.email || "").trim();
    const role = body.role === "admin" ? "admin" : "viewer";
    if (!email) {
      return NextResponse.json(
        { error: "email is required" },
        { status: 400 }
      );
    }

    await addAllowedUser(email, role, session.user.email);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to add user" },
      { status: 500 }
    );
  }
}
