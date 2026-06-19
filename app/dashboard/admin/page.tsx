import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminTabs } from "../_components/AdminTabs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const initialTab =
    searchParams.tab === "mappings" ||
    searchParams.tab === "users" ||
    searchParams.tab === "status"
      ? searchParams.tab
      : "history";

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink-primary">
          Admin Panel
        </h1>
        <p className="text-xs text-ink-tertiary mt-0.5">
          Operational visibility and configuration · Signed in as{" "}
          <span className="text-ink-secondary">{session.user.email}</span>
        </p>
      </div>

      <AdminTabs
        initialTab={initialTab as "history" | "mappings" | "users" | "status"}
        currentUserEmail={session.user.email}
      />
    </div>
  );
}
