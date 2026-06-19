import { getDb } from "@/lib/mongodb";

export interface AllowedUser {
  email: string;
  role: "admin" | "viewer";
  source: "env" | "mongo";
  addedAt?: Date;
  addedBy?: string;
}

/**
 * Returns the set of emails that are baked in via the ALLOWED_EMAILS env var.
 * These are treated as ADMINS — they cannot be removed via the UI to prevent
 * accidental lockout.
 */
export function getEnvAdminEmails(): string[] {
  return (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Whether the given email is in the env-var ADMIN allowlist.
 */
export function isEnvAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return getEnvAdminEmails().includes(email.toLowerCase());
}

/**
 * Full list of allowed users: env admins + mongo-added users.
 * env admins always appear with role=admin and source=env.
 */
export async function listAllowedUsers(): Promise<AllowedUser[]> {
  const envAdmins = getEnvAdminEmails().map<AllowedUser>((email) => ({
    email,
    role: "admin",
    source: "env",
  }));

  const db = await getDb();
  const mongoUsers = await db
    .collection("allowedUsers")
    .find({})
    .sort({ addedAt: -1 })
    .toArray();

  // Filter out mongo-users whose email is already covered by env admins
  const envSet = new Set(envAdmins.map((u) => u.email));
  const mongoOnly = mongoUsers
    .filter((u: any) => !envSet.has(String(u.email || "").toLowerCase()))
    .map<AllowedUser>((u: any) => ({
      email: u.email,
      role: u.role === "admin" ? "admin" : "viewer",
      source: "mongo",
      addedAt: u.addedAt,
      addedBy: u.addedBy,
    }));

  return [...envAdmins, ...mongoOnly];
}

/**
 * Whether the user is allowed to access the dashboard at all.
 * Used by NextAuth signIn callback.
 */
export async function isAllowed(
  email: string | null | undefined
): Promise<boolean> {
  if (!email) return false;
  const e = email.toLowerCase();
  if (isEnvAdmin(e)) return true;
  try {
    const db = await getDb();
    const row = await db.collection("allowedUsers").findOne({
      email: e,
    });
    return !!row;
  } catch {
    // If DB is down, fall back to env-only
    return isEnvAdmin(e);
  }
}

/**
 * Add a new allowed user (always stored in mongo).
 * Email is normalized to lowercase. Idempotent — re-adding is a no-op
 * except for updating the role.
 */
export async function addAllowedUser(
  email: string,
  role: "admin" | "viewer",
  addedBy: string
): Promise<void> {
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
    throw new Error("Invalid email format");
  }
  const db = await getDb();
  await db.collection("allowedUsers").updateOne(
    { email: e },
    {
      $set: { email: e, role, addedBy: addedBy.toLowerCase() },
      $setOnInsert: { addedAt: new Date() },
    },
    { upsert: true }
  );
}

/**
 * Update the role of a mongo-source user. Env-locked admins cannot be modified.
 * Returns true if updated, false if user is env-locked or not found.
 */
export async function updateUserRole(
  email: string,
  role: "admin" | "viewer"
): Promise<{ ok: boolean; reason?: string }> {
  const e = email.trim().toLowerCase();
  if (isEnvAdmin(e)) {
    return { ok: false, reason: "Env-locked admins cannot be modified via UI" };
  }
  const db = await getDb();
  const r = await db
    .collection("allowedUsers")
    .updateOne({ email: e }, { $set: { role } });
  if (r.matchedCount === 0) {
    return { ok: false, reason: "User not found" };
  }
  return { ok: true };
}

/**
 * Remove an allowed user. Returns false if the email is an env admin
 * (cannot be removed via UI).
 */
export async function removeAllowedUser(email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  if (isEnvAdmin(e)) return false;
  const db = await getDb();
  await db.collection("allowedUsers").deleteOne({ email: e });
  return true;
}
