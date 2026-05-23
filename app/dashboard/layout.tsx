import Link from "next/link";
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
      <aside className="w-56 bg-white border-r border-surface-border flex flex-col">
        <div className="px-4 py-4 border-b border-surface-border flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sales flex items-center justify-center text-sm font-bold text-sales-text">
            S
          </div>
          <div>
            <div className="text-sm font-semibold text-ink-primary leading-tight">SAR ISO Tank</div>
            <div className="text-[10px] text-ink-tertiary leading-tight">Business Dashboard</div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-5">
          <div>
            <div className="sidebar-section-label text-sales-text">Sales</div>
            <Link href="/dashboard" className="sidebar-link sidebar-link-active">
              Sales Performance
            </Link>
            <div className="space-y-0.5 opacity-50 mt-0.5">
              <div className="sidebar-link cursor-not-allowed">Revenue Breakup</div>
              <div className="sidebar-link cursor-not-allowed">Detention</div>
              <div className="sidebar-link cursor-not-allowed">Monthly Export</div>
              <div className="sidebar-link cursor-not-allowed">Lease Report</div>
            </div>
          </div>

          <div>
            <div className="sidebar-section-label text-mr-text">M&amp;R</div>
            <div className="space-y-0.5 opacity-50">
              <div className="sidebar-link cursor-not-allowed">Available Tanks</div>
              <div className="sidebar-link cursor-not-allowed">Under Repair</div>
            </div>
          </div>

          <div>
            <div className="sidebar-section-label text-finance-text">Finance</div>
            <div className="space-y-0.5 opacity-50">
              <div className="sidebar-link cursor-not-allowed">Outstanding (soon)</div>
            </div>
          </div>
        </nav>

        <div className="p-3 border-t border-surface-border">
          <div className="text-sm font-medium text-ink-primary truncate">
            {titleCase(session.user.name || session.user.email || "")}
          </div>
          <div className="text-[11px] text-ink-tertiary truncate">{session.user.email}</div>
          <SignOutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
