"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function SyncButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  async function handleClick() {
    setMsg("Syncing all sheets…");
    try {
      const r = await fetch("/api/cron/sync-all", { method: "POST" });
      const data = await r.json();
      if (r.ok && data.ok) {
        // Build a tiny per-sheet summary, e.g. "Sales 1,268 · Inventory 1,028 · Depot 39"
        const parts = (data.results || []).map((res: any) => {
          const sheet = (res.sheet || res.path?.split("/").pop() || "")
            .replace(/Register|Report/gi, "")
            .trim();
          return `${sheet}: ${(res.rowsInserted || 0).toLocaleString("en-IN")}`;
        });
        setMsg(`Synced — ${parts.join(" · ")}`);
        startTransition(() => router.refresh());
      } else {
        const failed = (data.results || []).find((r: any) => !r.ok);
        setMsg(`Error: ${failed?.errorMsg || data.error || "unknown"}`);
      }
    } catch (err: any) {
      setMsg(`Error: ${err?.message || err}`);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-xs text-ink-secondary">{msg}</span>}
      <button
        onClick={handleClick}
        disabled={pending}
        className="px-4 py-2 rounded-xl bg-sales-dark text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
      >
        {pending ? "Syncing…" : "Sync Now"}
      </button>
    </div>
  );
}
