"use client";

import { useState, useEffect, useCallback } from "react";
import { UsersIcon, CreditCardIcon, BarChartIcon, ActivityIcon, SettingsIcon, ShieldIcon, ClipboardIcon, DatabaseIcon, RefreshIcon, SearchIcon, ChevronDownIcon, CheckIcon, CloseIcon, EditIcon, TrashIcon } from "../ui/icons";
import { cn } from "@/utils/cn";

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

type AdminTab = "overview" | "users" | "models" | "settings" | "audit";

// ═══════════════════════════════════════════
// ADMIN DASHBOARD
// ═══════════════════════════════════════════
export function AdminDashboard({ email }: { email: string }) {
  const [tab, setTab] = useState<AdminTab>("overview");

  const tabs: { key: AdminTab; label: string; icon: React.FC<{ size?: number }> }[] = [
    { key: "overview", label: "Overview", icon: BarChartIcon },
    { key: "users", label: "Users", icon: UsersIcon },
    { key: "models", label: "AI Models", icon: DatabaseIcon },
    { key: "settings", label: "Settings", icon: SettingsIcon },
    { key: "audit", label: "Audit Logs", icon: ClipboardIcon },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Tab Navigation */}
      <div className="border-b border-border bg-surface px-4">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition",
                  tab === t.key
                    ? "border-accent text-accent"
                    : "border-transparent text-text-secondary hover:text-text"
                )}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl">
          {tab === "overview" && <OverviewTab email={email} />}
          {tab === "users" && <UsersTab email={email} />}
          {tab === "models" && <ModelsTab email={email} />}
          {tab === "settings" && <SettingsTab email={email} />}
          {tab === "audit" && <AuditTab email={email} />}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// STAT CARD
// ═══════════════════════════════════════════
function StatCard({ icon: Icon, label, value, change, changeType }: {
  icon: React.FC<{ size?: number }>;
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Icon size={20} />
        </div>
        {change && (
          <span className={cn(
            "text-xs font-medium",
            changeType === "positive" ? "text-success" :
            changeType === "negative" ? "text-danger" : "text-text-muted"
          )}>
            {change}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-text">{value}</div>
      <div className="text-sm text-text-muted">{label}</div>
    </div>
  );
}

// ═══════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════
function OverviewTab({ email }: { email: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/dashboard", {
        headers: { "x-admin-email": email },
      });
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }, [email]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-text-muted">
        Failed to load dashboard data
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        <StatCard icon={UsersIcon} label="Total Users" value={data.users.total} change={`+${data.users.newToday} today`} changeType="positive" />
        <StatCard icon={ActivityIcon} label="Active Users" value={data.users.active} />
        <StatCard icon={BarChartIcon} label="Requests Today" value={data.usage.requestsToday} />
        <StatCard icon={BarChartIcon} label="Monthly Requests" value={data.usage.requestsThisMonth} />
        <StatCard icon={CreditCardIcon} label="Est. Cost" value={`$${Number(data.costs.monthlyCost).toFixed(2)}`} />
        <StatCard icon={ShieldIcon} label="Failed" value={data.usage.failedRequests} changeType="negative" />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Usage Chart */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="text-sm font-semibold text-text mb-4">Usage (Last 7 Days)</h3>
          <div className="flex items-end gap-2 h-32">
            {data.dailyUsage.length > 0 ? (
              data.dailyUsage.map((d, i) => {
                const max = Math.max(...data.dailyUsage.map((x) => x.count), 1);
                const h = Math.max((d.count / max) * 100, 4);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-text-muted">{d.count}</span>
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-accent to-nebula transition-all"
                      style={{ height: `${h}%` }}
                    />
                    <span className="text-[10px] text-text-dim">
                      {new Date(d.date).toLocaleDateString("en", { weekday: "short" })}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-text-muted">
                No data yet
              </div>
            )}
          </div>
        </div>

        {/* Top Users */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="text-sm font-semibold text-text mb-4">Top Users</h3>
          <div className="space-y-2">
            {data.topUsers.length > 0 ? (
              data.topUsers.slice(0, 5).map((u, i) => (
                <div key={u.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-subtle transition">
                  <span className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-void",
                    i === 0 ? "bg-warning" : i === 1 ? "bg-text-muted" : i === 2 ? "bg-amber-700" : "bg-subtle text-text-secondary"
                  )}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm text-text">{u.email}</div>
                    <div className="text-xs text-text-muted">{u.plan}</div>
                  </div>
                  <span className="text-sm font-medium text-accent">{u.requests}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-text-muted text-center py-4">No usage data</div>
            )}
          </div>
        </div>
      </div>

      {/* Plan Distribution */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold text-text mb-4">User Distribution</h3>
        <div className="space-y-3">
          {[
            { label: "Free", count: data.users.free, color: "bg-info" },
            { label: "Pro", count: data.users.pro, color: "bg-success" },
            { label: "Premium", count: data.users.premium, color: "bg-nebula" },
          ].map((p) => {
            const pct = data.users.total > 0 ? (p.count / data.users.total) * 100 : 0;
            return (
              <div key={p.label} className="flex items-center gap-3">
                <span className="w-16 text-sm text-text-secondary">{p.label}</span>
                <div className="flex-1 h-3 rounded-full bg-subtle overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", p.color)}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
                <span className="w-16 text-right text-sm font-medium text-text">{p.count}</span>
                <span className="w-12 text-right text-xs text-text-muted">{pct.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Refresh */}
      <div className="flex justify-center">
        <button onClick={fetchData} className="btn btn-secondary gap-2">
          <RefreshIcon size={16} />
          Refresh
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

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (planFilter !== "all") params.set("plan", planFilter);

    try {
      const res = await fetch(`/api/admin/manage-user?${params}`, {
        headers: { "x-admin-email": email },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch {}
    setLoading(false);
  }, [email, search, planFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const doAction = async (action: string, userId: number, value?: string) => {
    await fetch("/api/admin/manage-user", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-email": email },
      body: JSON.stringify({ action, userId, value }),
    });
    fetchUsers();
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="input !pl-10"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="all">All Plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="premium">Premium</option>
        </select>
        <button onClick={fetchUsers} className="btn btn-primary gap-2">
          <RefreshIcon size={16} />
          Refresh
        </button>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-elevated">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">User</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Plan</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Status</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Credits</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Joined</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="bg-surface hover:bg-subtle transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent to-nebula text-xs font-bold text-void">
                        {u.email[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-text">{u.email}</div>
                        <div className="text-xs text-text-muted">{u.name || "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "badge",
                      u.plan === "free" ? "badge-neutral" :
                      u.plan === "pro" ? "badge-info" :
                      u.plan === "premium" ? "badge-accent" : "badge-warning"
                    )}>
                      {u.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "badge",
                      u.status === "active" ? "badge-success" :
                      u.status === "suspended" ? "badge-danger" : "badge-neutral"
                    )}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-text">{u.credits}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => doAction("grant_premium", u.id)}
                        className="btn btn-sm btn-ghost"
                        title="Grant Premium"
                      >
                        🎁
                      </button>
                      <button
                        onClick={() => doAction(u.status === "active" ? "suspend" : "unsuspend", u.id)}
                        className="btn btn-sm btn-ghost"
                        title={u.status === "active" ? "Suspend" : "Unsuspend"}
                      >
                        {u.status === "active" ? "🚫" : "✅"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-text-muted">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// PLACEHOLDER TABS
// ═══════════════════════════════════════════
function ModelsTab({ email }: { email: string }) {
  return (
    <div className="text-center py-20">
      <div className="text-4xl mb-4">🤖</div>
      <h2 className="text-xl font-semibold text-text mb-2">AI Models</h2>
      <p className="text-text-secondary">Manage model registry and access levels</p>
    </div>
  );
}

function SettingsTab({ email }: { email: string }) {
  return (
    <div className="text-center py-20">
      <div className="text-4xl mb-4">⚙️</div>
      <h2 className="text-xl font-semibold text-text mb-2">Settings</h2>
      <p className="text-text-secondary">System settings and feature flags</p>
    </div>
  );
}

function AuditTab({ email }: { email: string }) {
  return (
    <div className="text-center py-20">
      <div className="text-4xl mb-4">📋</div>
      <h2 className="text-xl font-semibold text-text mb-2">Audit Logs</h2>
      <p className="text-text-secondary">View admin action history</p>
    </div>
  );
}
