import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import SignOutButton from "./SignOutButton";
import { titleCase } from "@/lib/utils";
import { SidebarNav } from "./_components/SidebarNav";

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
            <div className="text-sm font-semibold text-ink-primary leading-tight">
              SAR ISO Tank
            </div>
            <div className="text-[10px] text-ink-tertiary leading-tight">
              Business Dashboard
            </div>
          </div>
        </div>

        <SidebarNav />

        <div className="p-3 border-t border-surface-border">
          <div className="text-sm font-medium text-ink-primary truncate">
            {titleCase(session.user.name || session.user.email || "")}
          </div>
          <div className="text-[11px] text-ink-tertiary truncate">
            {session.user.email}
          </div>
          <SignOutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
