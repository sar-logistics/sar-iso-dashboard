"use client";
import { useEffect, useState } from "react";
import { Plus, X, RefreshCw, Save, Edit2, Trash2 } from "lucide-react";

interface Mapping {
  _id: string;
  chargeName: string;
  revenueCategory: string;
  source?: "sheet" | "manual";
  updatedAt?: string;
}

const REVENUE_CATEGORIES = [
  "Lease",
  "Detention",
  "EXIM",
  "M&R",
  "Credit Note",
  "Other",
];

export function ChargeMappingsTab() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Mapping>>({});
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState({
    chargeName: "",
    revenueCategory: "Other",
  });
  const [importing, setImporting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/charge-mappings", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setMappings(data.mappings || []);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (m: Mapping) => {
    setEditingId(m._id);
    setEditForm({ chargeName: m.chargeName, revenueCategory: m.revenueCategory });
    setAdding(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (id: string) => {
    try {
      const r = await fetch(`/api/admin/charge-mappings/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setMessage("Saved");
      setTimeout(() => setMessage(null), 2000);
      cancelEdit();
      load();
    } catch (err: any) {
      setError(err.message || String(err));
    }
  };

  const deleteMapping = async (id: string, name: string) => {
    if (!confirm(`Delete mapping for "${name}"?`)) return;
    try {
      const r = await fetch(`/api/admin/charge-mappings/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setMessage("Deleted");
      setTimeout(() => setMessage(null), 2000);
      load();
    } catch (err: any) {
      setError(err.message || String(err));
    }
  };

  const addNew = async () => {
    if (!newForm.chargeName.trim()) {
      setError("Charge name is required");
      return;
    }
    try {
      const r = await fetch("/api/admin/charge-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newForm),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setMessage("Added");
      setTimeout(() => setMessage(null), 2000);
      setAdding(false);
      setNewForm({ chargeName: "", revenueCategory: "Other" });
      load();
    } catch (err: any) {
      setError(err.message || String(err));
    }
  };

  const reimport = async () => {
    if (
      !confirm(
        "Re-import will OVERWRITE all manual edits with what's currently in your Google Sheet. Continue?"
      )
    )
      return;
    setImporting(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/charge-mappings/import", {
        method: "POST",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setMessage(`Re-imported ${data.count || 0} mappings from Google Sheet`);
      setTimeout(() => setMessage(null), 4000);
      load();
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setImporting(false);
    }
  };

  const filtered = filter
    ? mappings.filter(
        (m) =>
          m.chargeName.toLowerCase().includes(filter.toLowerCase()) ||
          m.revenueCategory.toLowerCase().includes(filter.toLowerCase())
      )
    : mappings;

  return (
    <div>
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-ink-tertiary">
            <span className="text-ink-primary font-medium">{mappings.length}</span>{" "}
            charge mappings · Edit revenue category to recategorize charges in
            reports without touching the Google Sheet
          </div>
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter…"
              className="bg-surface-muted px-2.5 py-1.5 rounded-md text-ink-primary border border-surface-border text-xs w-44"
            />
            <button
              onClick={() => {
                setAdding(true);
                setEditingId(null);
              }}
              className="px-3 py-1.5 rounded-md bg-info hover:bg-info/80 text-info-text text-xs font-medium transition inline-flex items-center gap-1.5"
            >
              <Plus size={12} />
              Add Mapping
            </button>
            <button
              onClick={reimport}
              disabled={importing}
              className="px-3 py-1.5 rounded-md bg-surface-muted hover:bg-surface-border text-ink-primary text-xs font-medium transition inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw size={12} className={importing ? "animate-spin" : ""} />
              {importing ? "Importing…" : "Re-import from Sheet"}
            </button>
          </div>
        </div>
        {message && (
          <div className="mt-3 text-xs text-positive bg-positive/10 px-3 py-1.5 rounded inline-block">
            {message}
          </div>
        )}
        {error && (
          <div className="mt-3 text-xs text-negative bg-negative/10 px-3 py-1.5 rounded">
            Error: {error}
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-surface-subtle border-b border-surface-border text-[10px] uppercase tracking-wider text-ink-tertiary">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Charge Name</th>
              <th className="text-left px-4 py-2.5 font-medium w-48">
                Revenue Category
              </th>
              <th className="text-right px-4 py-2.5 font-medium w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {adding && (
              <tr className="border-b border-surface-border bg-info/5">
                <td className="px-4 py-2">
                  <input
                    type="text"
                    autoFocus
                    value={newForm.chargeName}
                    onChange={(e) =>
                      setNewForm({ ...newForm, chargeName: e.target.value })
                    }
                    placeholder="e.g. Tank Wash Fee"
                    className="w-full bg-white px-2 py-1.5 rounded-md text-ink-primary border border-surface-border text-xs"
                  />
                </td>
                <td className="px-4 py-2">
                  <select
                    value={newForm.revenueCategory}
                    onChange={(e) =>
                      setNewForm({ ...newForm, revenueCategory: e.target.value })
                    }
                    className="w-full bg-white px-2 py-1.5 rounded-md text-ink-primary border border-surface-border text-xs"
                  >
                    {REVENUE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex gap-1">
                    <button
                      onClick={addNew}
                      className="p-1.5 rounded hover:bg-positive/20 text-positive"
                      title="Save"
                    >
                      <Save size={14} />
                    </button>
                    <button
                      onClick={() => {
                        setAdding(false);
                        setNewForm({ chargeName: "", revenueCategory: "Other" });
                      }}
                      className="p-1.5 rounded hover:bg-surface-muted text-ink-tertiary"
                      title="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {loading && filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center text-ink-tertiary py-6">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center text-ink-tertiary py-6">
                  No mappings match.
                </td>
              </tr>
            )}
            {filtered.map((m) => {
              const isEditing = editingId === m._id;
              return (
                <tr
                  key={m._id}
                  className="border-b border-surface-border hover:bg-surface-subtle/50"
                >
                  <td className="px-4 py-2 text-ink-primary">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.chargeName ?? ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, chargeName: e.target.value })
                        }
                        className="w-full bg-white px-2 py-1.5 rounded-md text-ink-primary border border-info text-xs"
                      />
                    ) : (
                      m.chargeName
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isEditing ? (
                      <select
                        value={editForm.revenueCategory ?? m.revenueCategory}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            revenueCategory: e.target.value,
                          })
                        }
                        className="w-full bg-white px-2 py-1.5 rounded-md text-ink-primary border border-info text-xs"
                      >
                        {REVENUE_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-surface-muted text-ink-secondary">
                        {m.revenueCategory}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {isEditing ? (
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => saveEdit(m._id)}
                          className="p-1.5 rounded hover:bg-positive/20 text-positive"
                          title="Save"
                        >
                          <Save size={14} />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1.5 rounded hover:bg-surface-muted text-ink-tertiary"
                          title="Cancel"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => startEdit(m)}
                          className="p-1.5 rounded hover:bg-info/20 text-info-text"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => deleteMapping(m._id, m.chargeName)}
                          className="p-1.5 rounded hover:bg-negative/20 text-negative"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
