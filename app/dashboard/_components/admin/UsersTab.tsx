"use client";
import { useEffect, useState } from "react";
import {
  Plus,
  X,
  Lock,
  Trash2,
  Save,
  Shield,
  Edit2,
} from "lucide-react";

interface AllowedUser {
  email: string;
  role: "admin" | "viewer";
  source: "env" | "mongo";
  addedAt?: string;
  addedBy?: string;
}

function fmtIst(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function UsersTab({ currentUserEmail }: { currentUserEmail: string }) {
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState<{
    email: string;
    role: "admin" | "viewer";
  }>({ email: "", role: "viewer" });
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<"admin" | "viewer">("viewer");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addUser = async () => {
    if (!newForm.email.trim()) {
      setError("Email is required");
      return;
    }
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newForm),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setMessage(`Added ${newForm.email}`);
      setTimeout(() => setMessage(null), 3000);
      setAdding(false);
      setNewForm({ email: "", role: "viewer" });
      load();
    } catch (err: any) {
      setError(err.message || String(err));
    }
  };

  const removeUser = async (email: string) => {
    if (
      !confirm(
        `Remove access for "${email}"? They won't be able to sign in to the dashboard anymore.`
      )
    )
      return;
    try {
      const r = await fetch(`/api/admin/users/${encodeURIComponent(email)}`, {
        method: "DELETE",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setMessage(`Removed ${email}`);
      setTimeout(() => setMessage(null), 3000);
      load();
    } catch (err: any) {
      setError(err.message || String(err));
    }
  };

  const startEditRole = (u: AllowedUser) => {
    setEditingEmail(u.email);
    setEditRole(u.role);
    setAdding(false);
  };

  const cancelEditRole = () => {
    setEditingEmail(null);
  };

  const saveRole = async (email: string) => {
    try {
      const r = await fetch(`/api/admin/users/${encodeURIComponent(email)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: editRole }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setMessage(`Updated role for ${email}`);
      setTimeout(() => setMessage(null), 3000);
      setEditingEmail(null);
      load();
    } catch (err: any) {
      setError(err.message || String(err));
    }
  };

  const envCount = users.filter((u) => u.source === "env").length;
  const mongoCount = users.filter((u) => u.source === "mongo").length;

  return (
    <div>
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-ink-tertiary">
            <span className="text-ink-primary font-medium">{users.length}</span>{" "}
            users have access · {envCount} via env var (locked) · {mongoCount}{" "}
            added via this panel
          </div>
          <button
            onClick={() => {
              setAdding(true);
              setEditingEmail(null);
            }}
            disabled={adding}
            className="px-3 py-1.5 rounded-md bg-info hover:bg-info/80 text-info-text text-xs font-medium transition inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus size={12} />
            Add User
          </button>
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
              <th className="text-left px-4 py-2.5 font-medium">Email</th>
              <th className="text-left px-4 py-2.5 font-medium w-32">Role</th>
              <th className="text-left px-4 py-2.5 font-medium w-32">Source</th>
              <th className="text-left px-4 py-2.5 font-medium w-40">Added</th>
              <th className="text-right px-4 py-2.5 font-medium w-28">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {adding && (
              <tr className="border-b border-surface-border bg-info/5">
                <td className="px-4 py-2">
                  <input
                    type="email"
                    autoFocus
                    value={newForm.email}
                    onChange={(e) =>
                      setNewForm({ ...newForm, email: e.target.value })
                    }
                    placeholder="user@sarlogisolutions.com"
                    className="w-full bg-white px-2 py-1.5 rounded-md text-ink-primary border border-surface-border text-xs"
                  />
                </td>
                <td className="px-4 py-2">
                  <select
                    value={newForm.role}
                    onChange={(e) =>
                      setNewForm({
                        ...newForm,
                        role: e.target.value as "admin" | "viewer",
                      })
                    }
                    className="w-full bg-white px-2 py-1.5 rounded-md text-ink-primary border border-surface-border text-xs"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-4 py-2 text-ink-tertiary text-[11px]">
                  via this panel
                </td>
                <td className="px-4 py-2 text-ink-tertiary text-[11px]">now</td>
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex gap-1">
                    <button
                      onClick={addUser}
                      className="p-1.5 rounded hover:bg-positive/20 text-positive"
                      title="Save"
                    >
                      <Save size={14} />
                    </button>
                    <button
                      onClick={() => {
                        setAdding(false);
                        setNewForm({ email: "", role: "viewer" });
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

            {loading && users.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-ink-tertiary py-6">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-ink-tertiary py-6">
                  No users — check your ALLOWED_EMAILS env var.
                </td>
              </tr>
            )}
            {users.map((u) => {
              const isCurrentUser =
                u.email.toLowerCase() === currentUserEmail.toLowerCase();
              const isLocked = u.source === "env";
              const isEditing = editingEmail === u.email;
              return (
                <tr
                  key={u.email}
                  className="border-b border-surface-border hover:bg-surface-subtle/50"
                >
                  <td className="px-4 py-2 text-ink-primary">
                    {u.email}
                    {isCurrentUser && (
                      <span className="ml-2 text-[10px] text-ink-tertiary">
                        (you)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isEditing ? (
                      <select
                        value={editRole}
                        onChange={(e) =>
                          setEditRole(e.target.value as "admin" | "viewer")
                        }
                        className="bg-white px-2 py-1 rounded-md text-ink-primary border border-info text-xs"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : u.role === "admin" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-accent-purple/20 text-accent-purple">
                        <Shield size={10} />
                        Admin
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-surface-muted text-ink-secondary">
                        Viewer
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-ink-tertiary text-[11px]">
                    {u.source === "env" ? (
                      <span className="inline-flex items-center gap-1">
                        <Lock size={10} />
                        Env var
                      </span>
                    ) : (
                      "Panel"
                    )}
                  </td>
                  <td className="px-4 py-2 text-ink-tertiary text-[11px]">
                    {fmtIst(u.addedAt)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {isLocked ? (
                      <span
                        className="inline-flex items-center gap-1 text-ink-tertiary text-[11px]"
                        title="Cannot modify env-var users via UI"
                      >
                        <Lock size={11} /> locked
                      </span>
                    ) : isEditing ? (
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => saveRole(u.email)}
                          className="p-1.5 rounded hover:bg-positive/20 text-positive"
                          title="Save role"
                        >
                          <Save size={14} />
                        </button>
                        <button
                          onClick={cancelEditRole}
                          className="p-1.5 rounded hover:bg-surface-muted text-ink-tertiary"
                          title="Cancel"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => startEditRole(u)}
                          disabled={isCurrentUser}
                          className="p-1.5 rounded hover:bg-info/20 text-info-text disabled:opacity-30 disabled:cursor-not-allowed"
                          title={
                            isCurrentUser
                              ? "You cannot change your own role"
                              : "Edit role"
                          }
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => removeUser(u.email)}
                          disabled={isCurrentUser}
                          className="p-1.5 rounded hover:bg-negative/20 text-negative disabled:opacity-30 disabled:cursor-not-allowed"
                          title={
                            isCurrentUser ? "You cannot remove yourself" : "Remove"
                          }
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
