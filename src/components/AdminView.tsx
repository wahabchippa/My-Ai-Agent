"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ClaudeLogo, MenuIcon, SearchIcon, RefreshIcon, CloseIcon } from "./icons";
import { cn } from "../utils/cn";

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════
interface DashboardData {
  users: { total: number; active: number; newToday: number; newThisMonth: number; free: number; pro: number; premium: number };
  usage: { requestsToday: number; requestsThisMonth: number; failedRequests: number; searchRequests: number };
  costs: { monthlyCost: string };
  subscriptions: { active: number; cancelled: number };
  modelUsage: { model: string; count: number }[];
  dailyUsage: { date: string; count: number }[];
  topUsers: { id: number; email: string; name: string; plan: string; requests: number }[];
}

interface ManagedUser {
  id: number; email: string; name: string; role: string;
  plan: string; status: string; credits: number;
  createdAt: string; lastActive: string | null;
}

interface AuditLog {
  id: number; adminEmail: string; action: string;
  targetId: number | null; targetEmail: string | null;
  details: string | null; createdAt: string;
}

interface SettingsData {
  settings: { id: number; key: string; value: string; category: string }[];
  featureFlags: { id: number; key: string; label: string; enabled: boolean; minPlan: string }[];
  plans: { id: number; name: string; slug: string; price: string; interval: string; messageLimit: number; agentLimit: number; researchLimit: number; projectLimit: number; allowedModels: string; features: string; isActive: boolean }[];
}

interface ModelEntry {
  id: number; provider: string; modelId: string; displayName: string;
  accessLevel: string; status: string; priority: number;
  costPerMtok: string; capabilities: string;
}

type AdminTab = "overview" | "users" | "settings" | "models" | "audit";

// ═══════════════════════════════════════════
// ADMIN VIEW — Master Component
// ═══════════════════════════════════════════
export function AdminView({ email, onOpenSidebar }: { email: string; onOpenSidebar: () => void }) {
  const [tab, setTab] = useState<AdminTab>("overview");

  const tabs: { key: AdminTab; label: string; icon: string }[] = [
    { key: "overview", label: "Overview", icon: "📊" },
    { key: "users", label: "Users", icon: "👥" },
    { key: "settings", label: "Settings", icon: "⚙️" },
    { key: "models", label: "Models", icon: "🤖" },
    { key: "audit", label: "Audit Logs", icon: "📋" },
  ];

  return (
    <div className="flex h-full flex-col bg-cream dark:bg-night">
      {/* Header */}
      <header className="flex items-center gap-2 border-b border-line px-3 py-2.5 sm:px-5 dark:border-night-surface">
        <button onClick={onOpenSidebar} className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft hover:bg-cream-deep lg:hidden dark:text-cream">
          <MenuIcon size={20} />
        </button>
        <span className="text-coral"><ClaudeLogo size={20} /></span>
        <span className="text-[15px] font-semibold text-ink dark:text-cream">Admin Dashboard</span>
        <span className="ml-auto rounded-full bg-coral/10 px-3 py-1 text-[12px] font-medium text-coral">
          👑 {email}
        </span>
      </header>

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-line px-3 pt-1 sm:px-5 dark:border-night-surface overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3.5 py-2.5 text-[13px] font-medium transition",
              tab === t.key
                ? "border-b-2 border-coral bg-coral/5 text-coral"
                : "text-muted hover:text-ink-soft dark:hover:text-cream"
            )}
          >
            <span className="text-[14px]">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-4 sm:px-6">
          {tab === "overview" && <OverviewTab email={email} />}
          {tab === "users" && <UsersTab email={email} />}
          {tab === "settings" && <SettingsTab email={email} />}
          {tab === "models" && <ModelsTab email={email} />}
          {tab === "audit" && <AuditTab email={email} />}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════
function fetchAdmin(url: string, email: string, opts?: RequestInit) {
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-admin-email": email,
      ...(opts?.headers || {}),
    },
  });
}

function StatCard({ label, value, sub, color = "coral", icon }: { label: string; value: string | number; sub?: string; color?: string; icon: string }) {
  const colorMap: Record<string, string> = {
    coral: "from-coral/10 to-coral/5 border-coral/20",
    emerald: "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20",
    blue: "from-blue-500/10 to-blue-500/5 border-blue-500/20",
    amber: "from-amber-500/10 to-amber-500/5 border-amber-500/20",
    purple: "from-purple-500/10 to-purple-500/5 border-purple-500/20",
    red: "from-red-500/10 to-red-500/5 border-red-500/20",
  };
  const textMap: Record<string, string> = {
    coral: "text-coral",
    emerald: "text-emerald-600 dark:text-emerald-400",
    blue: "text-blue-600 dark:text-blue-400",
    amber: "text-amber-600 dark:text-amber-400",
    purple: "text-purple-600 dark:text-purple-400",
    red: "text-red-600 dark:text-red-400",
  };
  return (
    <div className={cn("rounded-2xl border bg-gradient-to-br p-4", colorMap[color] || colorMap.coral)}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className={cn("mt-1 text-2xl font-bold", textMap[color] || textMap.coral)}>{value}</div>
      {sub && <div className="mt-0.5 text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-coral" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="py-10 text-center text-[14px] text-muted">{message}</p>;
}

// ═══════════════════════════════════════════
// MINI BAR CHART (pure CSS, no library needed)
// ═══════════════════════════════════════════
function MiniBarChart({ data, labelKey, valueKey }: { data: Record<string, unknown>[]; labelKey: string; valueKey: string }) {
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const val = Number(d[valueKey]) || 0;
        const pct = (val / max) * 100;
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="w-28 truncate text-[12px] text-muted">{String(d[labelKey] || "unknown")}</span>
            <div className="flex-1">
              <div className="h-5 w-full rounded-full bg-cream-deep dark:bg-night-surface">
                <div
                  className="flex h-full items-center rounded-full bg-gradient-to-r from-coral to-coral-hover px-2 text-[10px] font-semibold text-white transition-all duration-500"
                  style={{ width: `${Math.max(pct, 8)}%` }}
                >
                  {val}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DailyChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height: 120 }}>
      {data.map((d, i) => {
        const h = Math.max((d.count / max) * 100, 4);
        const dayLabel = new Date(d.date).toLocaleDateString("en", { weekday: "short" });
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] font-medium text-muted">{d.count}</span>
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-coral to-coral-hover transition-all duration-500"
              style={{ height: `${h}%`, minHeight: 4 }}
            />
            <span className="text-[10px] text-muted-2">{dayLabel}</span>
          </div>
        );
      })}
      {data.length === 0 && <EmptyState message="No usage data yet" />}
    </div>
  );
}

// ═══════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════
function OverviewTab({ email }: { email: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetchAdmin("/api/admin/dashboard", email)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [email]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner />;
  if (!data) return <EmptyState message="Failed to load dashboard data" />;

  return (
    <div className="space-y-6 animate-rise">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard icon="👥" label="Total Users" value={data.users.total} sub={`${data.users.newToday} new today`} color="blue" />
        <StatCard icon="✅" label="Active Users" value={data.users.active} color="emerald" />
        <StatCard icon="📨" label="Requests Today" value={data.usage.requestsToday} color="coral" />
        <StatCard icon="📈" label="Monthly Requests" value={data.usage.requestsThisMonth} color="purple" />
        <StatCard icon="💰" label="Monthly Cost" value={`$${Number(data.costs.monthlyCost).toFixed(2)}`} color="amber" />
        <StatCard icon="❌" label="Failed Requests" value={data.usage.failedRequests} color="red" />
      </div>

      {/* Plan Distribution */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-5 dark:border-night-surface dark:bg-night-deep">
          <h3 className="mb-4 text-[14px] font-semibold text-ink dark:text-cream">📊 User Distribution by Plan</h3>
          <div className="space-y-3">
            {[
              { label: "Free", count: data.users.free, color: "bg-blue-500", total: data.users.total },
              { label: "Pro", count: data.users.pro, color: "bg-emerald-500", total: data.users.total },
              { label: "Premium", count: data.users.premium, color: "bg-purple-500", total: data.users.total },
            ].map((p) => {
              const pct = data.users.total > 0 ? (p.count / p.total) * 100 : 0;
              return (
                <div key={p.label} className="flex items-center gap-3">
                  <span className="w-16 text-[12px] font-medium text-muted">{p.label}</span>
                  <div className="flex-1 h-4 rounded-full bg-cream-deep dark:bg-night-surface">
                    <div className={cn("h-full rounded-full transition-all duration-500", p.color)} style={{ width: `${Math.max(pct, 2)}%` }} />
                  </div>
                  <span className="w-12 text-right text-[12px] font-semibold text-ink dark:text-cream">{p.count}</span>
                  <span className="w-10 text-right text-[11px] text-muted">{pct.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-cream-deep/60 p-3 dark:bg-night-surface">
              <div className="text-[11px] text-muted">Active Subs</div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{data.subscriptions.active}</div>
            </div>
            <div className="rounded-xl bg-cream-deep/60 p-3 dark:bg-night-surface">
              <div className="text-[11px] text-muted">Cancelled</div>
              <div className="text-lg font-bold text-red-500">{data.subscriptions.cancelled}</div>
            </div>
          </div>
        </div>

        {/* Daily Usage Chart */}
        <div className="rounded-2xl border border-line bg-white p-5 dark:border-night-surface dark:bg-night-deep">
          <h3 className="mb-4 text-[14px] font-semibold text-ink dark:text-cream">📈 Usage (Last 7 Days)</h3>
          <DailyChart data={data.dailyUsage} />
        </div>
      </div>

      {/* Model Usage + Top Users */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-5 dark:border-night-surface dark:bg-night-deep">
          <h3 className="mb-4 text-[14px] font-semibold text-ink dark:text-cream">🤖 Model Usage (This Month)</h3>
          {data.modelUsage.length > 0 ? (
            <MiniBarChart data={data.modelUsage} labelKey="model" valueKey="count" />
          ) : (
            <EmptyState message="No model usage data yet" />
          )}
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 dark:border-night-surface dark:bg-night-deep">
          <h3 className="mb-4 text-[14px] font-semibold text-ink dark:text-cream">🏆 Top Users (This Month)</h3>
          {data.topUsers.length > 0 ? (
            <div className="space-y-2">
              {data.topUsers.slice(0, 8).map((u, i) => (
                <div key={u.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-cream-deep dark:hover:bg-night-surface">
                  <span className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white",
                    i === 0 ? "bg-amber-500" : i === 1 ? "bg-gray-400" : i === 2 ? "bg-amber-700" : "bg-muted"
                  )}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-[13px] font-medium text-ink dark:text-cream">{u.email}</div>
                    <div className="text-[11px] text-muted">{u.name || "—"} · {u.plan}</div>
                  </div>
                  <span className="rounded-full bg-coral/10 px-2.5 py-0.5 text-[12px] font-semibold text-coral">
                    {u.requests} req
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No usage data yet" />
          )}
        </div>
      </div>

      {/* Refresh button */}
      <div className="flex justify-center">
        <button onClick={load} className="flex items-center gap-2 rounded-xl bg-cream-deep px-4 py-2 text-[13px] font-medium text-muted hover:text-ink transition dark:bg-night-surface dark:hover:text-cream">
          <RefreshIcon size={14} /> Refresh Dashboard
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// USERS TAB
// ═══════════════════════════════════════════
function UsersTab({ email }: { email: string }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (planFilter !== "all") params.set("plan", planFilter);
    fetchAdmin(`/api/admin/manage-user?${params}`, email)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setUsers(d.users || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [email, search, planFilter]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (action: string, userId: number, value?: string) => {
    setActionLoading(userId);
    try {
      const r = await fetchAdmin("/api/admin/manage-user", email, {
        method: "POST",
        body: JSON.stringify({ action, userId, value }),
      });
      if (r.ok) {
        load();
        setSelectedUser(null);
      }
    } catch {}
    setActionLoading(null);
  };

  const planBadge = (plan: string) => {
    const colors: Record<string, string> = {
      free: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
      pro: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      premium: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
      admin: "bg-coral/10 text-coral",
    };
    return (
      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", colors[plan] || colors.free)}>
        {plan}
      </span>
    );
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
      suspended: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
      deleted: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
    };
    return (
      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", colors[status] || colors.active)}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-4 animate-rise">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 dark:border-night-surface dark:bg-night-deep">
          <SearchIcon size={15} className="text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="w-full bg-transparent text-[13px] text-ink placeholder:text-muted focus:outline-none dark:text-cream"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="rounded-xl border border-line bg-white px-3 py-2.5 text-[13px] text-ink focus:outline-none dark:border-night-surface dark:bg-night-deep dark:text-cream"
        >
          <option value="all">All Plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="premium">Premium</option>
          <option value="admin">Admin</option>
        </select>
        <button onClick={load} className="flex items-center gap-1.5 rounded-xl bg-coral px-4 py-2.5 text-[13px] font-medium text-white hover:bg-coral-hover transition">
          <RefreshIcon size={14} /> Refresh
        </button>
      </div>

      {/* Count */}
      <div className="text-[13px] text-muted">{users.length} users found</div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner />
      ) : users.length === 0 ? (
        <EmptyState message="No users found" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line dark:border-night-surface">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-cream-deep dark:bg-night-deep">
              <tr>
                <th className="px-4 py-3 font-semibold text-muted">User</th>
                <th className="px-4 py-3 font-semibold text-muted">Plan</th>
                <th className="px-4 py-3 font-semibold text-muted">Status</th>
                <th className="px-4 py-3 font-semibold text-muted">Credits</th>
                <th className="px-4 py-3 font-semibold text-muted">Joined</th>
                <th className="px-4 py-3 font-semibold text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line dark:divide-night-surface">
              {users.map((u) => (
                <tr key={u.id} className="bg-white hover:bg-cream-deep/40 dark:bg-night dark:hover:bg-night-surface/40 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-coral to-coral-hover text-[12px] font-bold text-white">
                        {(u.email[0] || "?").toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-ink dark:text-cream">{u.email}</div>
                        <div className="text-[11px] text-muted">{u.name || "—"} · {u.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{planBadge(u.plan)}</td>
                  <td className="px-4 py-3">{statusBadge(u.status)}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[12px] text-ink dark:text-cream">{u.credits}</span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-muted">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedUser(u)}
                      className="rounded-lg bg-cream-deep px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-coral hover:text-white transition dark:bg-night-surface dark:text-cream dark:hover:bg-coral"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* User Action Modal */}
      {selectedUser && (
        <UserActionModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onAction={doAction}
          loading={actionLoading === selectedUser.id}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// USER ACTION MODAL
// ═══════════════════════════════════════════
function UserActionModal({
  user, onClose, onAction, loading,
}: {
  user: ManagedUser; onClose: () => void;
  onAction: (action: string, userId: number, value?: string) => void;
  loading: boolean;
}) {
  const [creditAmount, setCreditAmount] = useState(String(user.credits));
  const [selectedPlan, setSelectedPlan] = useState(user.plan);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="animate-rise mx-4 w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-2xl dark:border-night-surface dark:bg-night" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-semibold text-ink dark:text-cream">Manage User</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-cream-deep dark:hover:bg-night-surface">
            <CloseIcon size={16} />
          </button>
        </div>

        {/* User info */}
        <div className="rounded-xl bg-cream-deep p-3 mb-4 dark:bg-night-surface">
          <div className="text-[14px] font-medium text-ink dark:text-cream">{user.email}</div>
          <div className="text-[12px] text-muted">{user.name || "No name"} · ID #{user.id} · {user.role} · {user.plan} · {user.credits} credits</div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {/* Change Plan */}
          <div className="flex items-center gap-2">
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-[13px] dark:border-night-surface dark:bg-night-deep dark:text-cream"
            >
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="premium">Premium</option>
              <option value="admin">Admin</option>
            </select>
            <button
              onClick={() => onAction("change_plan", user.id, selectedPlan)}
              disabled={loading || selectedPlan === user.plan}
              className="rounded-lg bg-blue-500 px-3 py-2 text-[12px] font-medium text-white hover:bg-blue-600 transition disabled:opacity-40"
            >
              Change Plan
            </button>
          </div>

          {/* Set Credits */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-[13px] dark:border-night-surface dark:bg-night-deep dark:text-cream"
              min="0"
            />
            <button
              onClick={() => onAction("set_credits", user.id, creditAmount)}
              disabled={loading}
              className="rounded-lg bg-amber-500 px-3 py-2 text-[12px] font-medium text-white hover:bg-amber-600 transition disabled:opacity-40"
            >
              Set Credits
            </button>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => onAction("grant_premium", user.id)}
              disabled={loading}
              className="rounded-lg bg-purple-500 px-3 py-2.5 text-[12px] font-medium text-white hover:bg-purple-600 transition disabled:opacity-40"
            >
              🎁 Grant Premium
            </button>
            <button
              onClick={() => onAction("reset_usage", user.id)}
              disabled={loading}
              className="rounded-lg bg-emerald-500 px-3 py-2.5 text-[12px] font-medium text-white hover:bg-emerald-600 transition disabled:opacity-40"
            >
              🔄 Reset Usage
            </button>
            {user.status === "active" ? (
              <button
                onClick={() => onAction("suspend", user.id)}
                disabled={loading}
                className="rounded-lg bg-red-500 px-3 py-2.5 text-[12px] font-medium text-white hover:bg-red-600 transition disabled:opacity-40"
              >
                🚫 Suspend
              </button>
            ) : (
              <button
                onClick={() => onAction("unsuspend", user.id)}
                disabled={loading}
                className="rounded-lg bg-emerald-600 px-3 py-2.5 text-[12px] font-medium text-white hover:bg-emerald-700 transition disabled:opacity-40"
              >
                ✅ Unsuspend
              </button>
            )}
            <button
              onClick={() => {
                if (confirm(`Delete user ${user.email}?`)) onAction("delete", user.id);
              }}
              disabled={loading}
              className="rounded-lg bg-red-600 px-3 py-2.5 text-[12px] font-medium text-white hover:bg-red-700 transition disabled:opacity-40"
            >
              🗑️ Delete
            </button>
          </div>
        </div>

        {loading && <div className="mt-3 text-center text-[12px] text-muted">Processing...</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// SETTINGS TAB — Plans, Feature Flags, System Settings
// ═══════════════════════════════════════════
function SettingsTab({ email }: { email: string }) {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<"plans" | "flags" | "settings">("plans");

  const load = useCallback(() => {
    setLoading(true);
    fetchAdmin("/api/admin/settings", email)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [email]);

  useEffect(() => { load(); }, [load]);

  const toggleFlag = async (flagId: number, enabled: boolean) => {
    await fetchAdmin("/api/admin/settings", email, {
      method: "POST",
      body: JSON.stringify({ type: "flag", id: String(flagId), value: enabled }),
    });
    load();
  };

  const updateSetting = async (key: string, value: string) => {
    await fetchAdmin("/api/admin/settings", email, {
      method: "POST",
      body: JSON.stringify({ type: "setting", key, value }),
    });
    load();
  };

  if (loading) return <LoadingSpinner />;
  if (!data) return <EmptyState message="Failed to load settings" />;

  return (
    <div className="space-y-4 animate-rise">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        {([
          { key: "plans" as const, label: "💳 Plans", count: data.plans.length },
          { key: "flags" as const, label: "🚩 Feature Flags", count: data.featureFlags.length },
          { key: "settings" as const, label: "🔧 System Settings", count: data.settings.length },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={cn(
              "rounded-xl px-4 py-2 text-[13px] font-medium transition",
              subTab === t.key
                ? "bg-coral text-white"
                : "bg-cream-deep text-muted hover:text-ink dark:bg-night-surface dark:hover:text-cream"
            )}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Plans */}
      {subTab === "plans" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.plans.map((plan) => (
            <div key={plan.id} className={cn(
              "rounded-2xl border p-5 transition",
              plan.isActive
                ? "border-line bg-white dark:border-night-surface dark:bg-night-deep"
                : "border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-900/10"
            )}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[15px] font-semibold text-ink dark:text-cream">{plan.name}</h4>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  plan.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-red-100 text-red-600"
                )}>
                  {plan.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="text-2xl font-bold text-coral mb-3">${plan.price}<span className="text-[13px] text-muted">/{plan.interval}</span></div>
              <div className="space-y-1.5 text-[12px] text-muted">
                <div className="flex justify-between"><span>Messages</span><span className="font-medium text-ink dark:text-cream">{plan.messageLimit}/mo</span></div>
                <div className="flex justify-between"><span>Agents</span><span className="font-medium text-ink dark:text-cream">{plan.agentLimit}</span></div>
                <div className="flex justify-between"><span>Research</span><span className="font-medium text-ink dark:text-cream">{plan.researchLimit}/mo</span></div>
                <div className="flex justify-between"><span>Projects</span><span className="font-medium text-ink dark:text-cream">{plan.projectLimit}</span></div>
              </div>
              <div className="mt-3 pt-3 border-t border-line dark:border-night-surface">
                <div className="text-[11px] text-muted mb-1">Allowed Models:</div>
                <div className="flex flex-wrap gap-1">
                  {plan.allowedModels.split(",").map((m) => (
                    <span key={m} className="rounded bg-cream-deep px-1.5 py-0.5 text-[10px] font-mono text-ink-soft dark:bg-night-surface dark:text-cream/70">
                      {m.trim()}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-2">
                <div className="text-[11px] text-muted mb-1">Features:</div>
                <div className="flex flex-wrap gap-1">
                  {plan.features.split(",").map((f) => (
                    <span key={f} className="rounded bg-coral/10 px-1.5 py-0.5 text-[10px] font-medium text-coral">
                      {f.trim()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {data.plans.length === 0 && <EmptyState message="No plans configured. Add plans via database." />}
        </div>
      )}

      {/* Feature Flags */}
      {subTab === "flags" && (
        <div className="space-y-2">
          {data.featureFlags.length === 0 ? (
            <EmptyState message="No feature flags configured" />
          ) : (
            data.featureFlags.map((flag) => (
              <div key={flag.id} className="flex items-center gap-4 rounded-xl border border-line bg-white p-4 dark:border-night-surface dark:bg-night-deep">
                <button
                  onClick={() => toggleFlag(flag.id, !flag.enabled)}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors",
                    flag.enabled ? "bg-emerald-500" : "bg-gray-300 dark:bg-night-surface"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                    flag.enabled ? "left-[22px]" : "left-0.5"
                  )} />
                </button>
                <div className="flex-1">
                  <div className="text-[14px] font-medium text-ink dark:text-cream">{flag.label}</div>
                  <div className="text-[12px] text-muted">Key: <code className="font-mono">{flag.key}</code> · Min plan: <span className="font-semibold">{flag.minPlan}</span></div>
                </div>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  flag.enabled ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-gray-100 text-gray-500"
                )}>
                  {flag.enabled ? "ON" : "OFF"}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* System Settings */}
      {subTab === "settings" && (
        <div className="space-y-2">
          {data.settings.length === 0 ? (
            <EmptyState message="No system settings configured" />
          ) : (
            data.settings.map((s) => (
              <SettingRow key={s.id} setting={s} onSave={updateSetting} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SettingRow({ setting, onSave }: { setting: { key: string; value: string; category: string }; onSave: (key: string, value: string) => void }) {
  const [value, setValue] = useState(setting.value);
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 dark:border-night-surface dark:bg-night-deep">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-ink dark:text-cream">{setting.key}</div>
        <div className="text-[11px] text-muted">Category: {setting.category}</div>
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-48 rounded-lg border border-line bg-cream-deep px-2 py-1 text-[12px] focus:outline-none dark:border-night-surface dark:bg-night-surface dark:text-cream"
          />
          <button onClick={() => { onSave(setting.key, value); setEditing(false); }} className="rounded-lg bg-coral px-2.5 py-1 text-[11px] font-medium text-white hover:bg-coral-hover">
            Save
          </button>
          <button onClick={() => { setValue(setting.value); setEditing(false); }} className="text-[11px] text-muted hover:text-ink dark:hover:text-cream">
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <code className="max-w-[200px] truncate rounded bg-cream-deep px-2 py-1 text-[12px] font-mono text-ink-soft dark:bg-night-surface dark:text-cream/70">
            {setting.value}
          </code>
          <button onClick={() => setEditing(true)} className="text-[12px] text-coral hover:text-coral-hover font-medium">
            Edit
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// MODELS TAB
// ═══════════════════════════════════════════
function ModelsTab({ email }: { email: string }) {
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchAdmin("/api/admin/models", email)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setModels(d.models || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [email]);

  useEffect(() => { load(); }, [load]);

  const toggleStatus = async (id: number) => {
    await fetchAdmin("/api/admin/models", email, {
      method: "POST",
      body: JSON.stringify({ action: "toggle_status", id }),
    });
    load();
  };

  const deleteModel = async (id: number) => {
    if (!confirm("Delete this model?")) return;
    await fetchAdmin("/api/admin/models", email, {
      method: "POST",
      body: JSON.stringify({ action: "delete", id }),
    });
    load();
  };

  const addModel = async (data: Partial<ModelEntry>) => {
    await fetchAdmin("/api/admin/models", email, {
      method: "POST",
      body: JSON.stringify({ action: "create", data }),
    });
    setShowAdd(false);
    load();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4 animate-rise">
      <div className="flex items-center justify-between">
        <div className="text-[14px] font-semibold text-ink dark:text-cream">{models.length} Models Registered</div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 rounded-xl bg-coral px-4 py-2 text-[13px] font-medium text-white hover:bg-coral-hover transition"
        >
          {showAdd ? "Cancel" : "➕ Add Model"}
        </button>
      </div>

      {showAdd && <AddModelForm onSubmit={addModel} />}

      {models.length === 0 ? (
        <EmptyState message="No models registered. Click 'Add Model' to create one." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line dark:border-night-surface">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-cream-deep dark:bg-night-deep">
              <tr>
                <th className="px-4 py-3 font-semibold text-muted">Model</th>
                <th className="px-4 py-3 font-semibold text-muted">Provider</th>
                <th className="px-4 py-3 font-semibold text-muted">Access</th>
                <th className="px-4 py-3 font-semibold text-muted">Status</th>
                <th className="px-4 py-3 font-semibold text-muted">Priority</th>
                <th className="px-4 py-3 font-semibold text-muted">Cost/MTok</th>
                <th className="px-4 py-3 font-semibold text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line dark:divide-night-surface">
              {models.map((m) => (
                <tr key={m.id} className="bg-white hover:bg-cream-deep/40 dark:bg-night dark:hover:bg-night-surface/40 transition">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink dark:text-cream">{m.displayName}</div>
                    <div className="text-[11px] text-muted font-mono">{m.modelId}</div>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-muted">{m.provider}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      m.accessLevel === "free" ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" :
                      m.accessLevel === "pro" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                      m.accessLevel === "premium" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" :
                      "bg-coral/10 text-coral"
                    )}>
                      {m.accessLevel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleStatus(m.id)}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold cursor-pointer transition",
                        m.status === "active"
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                      )}
                    >
                      {m.status}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-ink dark:text-cream">{m.priority}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-muted">${m.costPerMtok}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => deleteModel(m.id)}
                      className="rounded-lg bg-red-100 px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-200 transition dark:bg-red-900/30 dark:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AddModelForm({ onSubmit }: { onSubmit: (data: Partial<ModelEntry>) => void }) {
  const [form, setForm] = useState({
    provider: "", modelId: "", displayName: "", accessLevel: "free",
    status: "active", priority: 50, costPerMtok: "0", capabilities: "general",
  });
  const set = (key: string, value: string | number) => setForm((p) => ({ ...p, [key]: value }));

  return (
    <div className="rounded-2xl border border-coral/30 bg-coral/5 p-5 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-medium text-muted mb-1 block">Provider</label>
          <input value={form.provider} onChange={(e) => set("provider", e.target.value)} placeholder="groq" className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] focus:outline-none dark:border-night-surface dark:bg-night-deep dark:text-cream" />
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted mb-1 block">Model ID</label>
          <input value={form.modelId} onChange={(e) => set("modelId", e.target.value)} placeholder="llama-3.3-70b-versatile" className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] focus:outline-none dark:border-night-surface dark:bg-night-deep dark:text-cream" />
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted mb-1 block">Display Name</label>
          <input value={form.displayName} onChange={(e) => set("displayName", e.target.value)} placeholder="Groq Llama 3.3 70B" className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] focus:outline-none dark:border-night-surface dark:bg-night-deep dark:text-cream" />
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted mb-1 block">Access Level</label>
          <select value={form.accessLevel} onChange={(e) => set("accessLevel", e.target.value)} className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] focus:outline-none dark:border-night-surface dark:bg-night-deep dark:text-cream">
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="premium">Premium</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted mb-1 block">Priority (0-100)</label>
          <input type="number" value={form.priority} onChange={(e) => set("priority", parseInt(e.target.value) || 50)} className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] focus:outline-none dark:border-night-surface dark:bg-night-deep dark:text-cream" />
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted mb-1 block">Cost per MTok ($)</label>
          <input value={form.costPerMtok} onChange={(e) => set("costPerMtok", e.target.value)} placeholder="0.27" className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] focus:outline-none dark:border-night-surface dark:bg-night-deep dark:text-cream" />
        </div>
      </div>
      <div>
        <label className="text-[11px] font-medium text-muted mb-1 block">Capabilities (comma-separated)</label>
        <input value={form.capabilities} onChange={(e) => set("capabilities", e.target.value)} placeholder="general,coding,research" className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] focus:outline-none dark:border-night-surface dark:bg-night-deep dark:text-cream" />
      </div>
      <button
        onClick={() => {
          if (form.provider && form.modelId && form.displayName) onSubmit(form);
        }}
        disabled={!form.provider || !form.modelId || !form.displayName}
        className="rounded-xl bg-coral px-5 py-2.5 text-[13px] font-medium text-white hover:bg-coral-hover transition disabled:opacity-40"
      >
        Add Model
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════
// AUDIT LOG TAB
// ═══════════════════════════════════════════
function AuditTab({ email }: { email: string }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    fetchAdmin(`/api/admin/audit-logs?page=${page}&limit=30`, email)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setLogs(d.logs || []);
          setTotal(d.total || 0);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [email, page]);

  useEffect(() => { load(); }, [load]);

  const actionColor = (action: string) => {
    if (action.includes("delete") || action.includes("suspend")) return "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300";
    if (action.includes("grant") || action.includes("unsuspend")) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    if (action.includes("plan") || action.includes("role")) return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    if (action.includes("model")) return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
    return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4 animate-rise">
      <div className="flex items-center justify-between">
        <div className="text-[14px] font-semibold text-ink dark:text-cream">{total} Audit Entries</div>
        <button onClick={load} className="flex items-center gap-1.5 rounded-xl bg-cream-deep px-4 py-2 text-[13px] font-medium text-muted hover:text-ink transition dark:bg-night-surface dark:hover:text-cream">
          <RefreshIcon size={14} /> Refresh
        </button>
      </div>

      {logs.length === 0 ? (
        <EmptyState message="No audit logs yet. Admin actions will be tracked here." />
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 rounded-xl border border-line bg-white p-4 dark:border-night-surface dark:bg-night-deep">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cream-deep text-[14px] dark:bg-night-surface">
                📋
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", actionColor(log.action))}>
                    {log.action}
                  </span>
                  {log.targetEmail && (
                    <span className="text-[12px] text-muted">→ {log.targetEmail}</span>
                  )}
                </div>
                {log.details && <div className="mt-1 text-[12px] text-ink-soft dark:text-cream/70">{log.details}</div>}
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                  <span>by {log.adminEmail}</span>
                  <span>·</span>
                  <span>{new Date(log.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 30 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg bg-cream-deep px-3 py-1.5 text-[12px] font-medium text-muted hover:text-ink transition disabled:opacity-40 dark:bg-night-surface"
          >
            ← Previous
          </button>
          <span className="text-[12px] text-muted">Page {page} of {Math.ceil(total / 30)}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page * 30 >= total}
            className="rounded-lg bg-cream-deep px-3 py-1.5 text-[12px] font-medium text-muted hover:text-ink transition disabled:opacity-40 dark:bg-night-surface"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
