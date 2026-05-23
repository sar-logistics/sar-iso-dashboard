"use client";
import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="mt-3 w-full text-left text-xs text-ink-tertiary hover:text-ink-primary"
    >
      Sign out
    </button>
  );
}
