import Link from "next/link";
import { signOut } from "next-auth/react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import SignOutButton from "./SignOutButton";
import { titleCase } from "@/lib/utils";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen flex bg-surface-muted">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-surface-border flex flex-col">
        <div className="px-6 py-5 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sales flex items-center justify-center text-sm font-bold text-sales-text">
              S
            </div>
            <div>
              <div className="text-sm font-semibold text-ink-primary">SAR ISO</div>
              <div className="text-xs text-ink-tertiary">Tank Dashboard</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-6 text-sm">
          <div>
            <div className="px-3 text-xs font-medium uppercase tracking-wider text-ink-tertiary mb-2">
              Overview
            </div>
            <Link href="/dashboard" className="block px-3 py-2 rounded-lg hover:bg-surface-muted">
              Summary
            </Link>
          </div>

          <div>
            <div className="px-3 text-xs font-medium uppercase tracking-wider text-sales-text mb-2">
              Sales
            </div>
            <div className="space-y-1 text-ink-secondary">
              <div className="px-3 py-1.5 opacity-50">Revenue Breakup</div>
              <div className="px-3 py-1.5 opacity-50">Detention</div>
              <div className="px-3 py-1.5 opacity-50">Monthly Export</div>
              <div className="px-3 py-1.5 opacity-50">Lease Report</div>
            </div>
          </div>

          <div>
            <div className="px-3 text-xs font-medium uppercase tracking-wider text-mr-text mb-2">
              M&R
            </div>
            <div className="space-y-1 text-ink-secondary">
              <div className="px-3 py-1.5 opacity-50">Available Tanks</div>
              <div className="px-3 py-1.5 opacity-50">Under Repair</div>
            </div>
          </div>

          <div>
            <div className="px-3 text-xs font-medium uppercase tracking-wider text-finance-text mb-2">
              Finance
            </div>
            <div className="space-y-1 text-ink-secondary">
              <div className="px-3 py-1.5 opacity-50">Outstanding (soon)</div>
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-surface-border">
          <div className="text-sm font-medium text-ink-primary truncate">
            {titleCase(session.user.name || session.user.email || "")}
          </div>
          <div className="text-xs text-ink-tertiary truncate">{session.user.email}</div>
          <SignOutButton />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
