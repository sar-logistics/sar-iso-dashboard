import { auth } from "@/lib/auth";
import {
  isEnvAdmin,
  removeAllowedUser,
  updateUserRole,
} from "@/lib/allowedUsers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: { email: string } }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = decodeURIComponent(params.email).trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  // Prevent self-removal
  if (email === session.user.email.toLowerCase()) {
    return NextResponse.json(
      { error: "You cannot remove yourself" },
      { status: 400 }
    );
  }

  // Prevent removing env-locked admins
  if (isEnvAdmin(email)) {
    return NextResponse.json(
      {
        error:
          "Cannot remove env-var admins via UI. Update ALLOWED_EMAILS in Vercel.",
      },
      { status: 400 }
    );
  }

  try {
    const ok = await removeAllowedUser(email);
    if (!ok) {
      return NextResponse.json(
        { error: "Removal blocked (env admin)" },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to remove user" },
      { status: 500 }
    );
  }
}

/**
 * Update the role of a mongo-source user.
 * Body: { role: "admin" | "viewer" }
 */
export async function PATCH(
  req: Request,
  { params }: { params: { email: string } }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = decodeURIComponent(params.email).trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  // Don't let a user change their own role (could orphan admin)
  if (email === session.user.email.toLowerCase()) {
    return NextResponse.json(
      { error: "You cannot change your own role" },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const role = body.role === "admin" ? "admin" : "viewer";

    const result = await updateUserRole(email, role);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.reason || "Update failed" },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update role" },
      { status: 500 }
    );
  }
}
