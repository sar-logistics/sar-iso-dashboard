"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function SyncButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  async function handleClick() {
    setMsg(null);
    try {
      const r = await fetch("/api/sync/sales", { method: "POST" });
      const data = await r.json();
      if (r.ok) {
        setMsg(`Synced ${data.rowsInserted} rows`);
        startTransition(() => router.refresh());
      } else {
        setMsg(`Error: ${data.errorMsg || data.error || "unknown"}`);
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
