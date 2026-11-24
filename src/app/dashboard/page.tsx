"use client";

import * as React from "react";
import Link from "next/link";
import {
  getUnifiedDashboardData,
  type UnifiedDashboardData,
} from "@/app/actions/dashboard";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Activity,
  ShieldAlert,
  Clock,
  Bell,
  Search,
  RefreshCw,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const PAGE_SIZE = 5;

export default function DashboardPage() {
  const [data, setData] = React.useState<UnifiedDashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [sortBy, setSortBy] = React.useState<"name" | "uptime" | "latency">("name");
  const [sortAsc, setSortAsc] = React.useState(true);
  const [page, setPage] = React.useState(1);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getUnifiedDashboardData();
    if (res.error) setError(res.error);
    else if (res.data) setData(res.data);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const filteredApps = React.useMemo(() => {
    const list = data?.apps ?? [];
    return list
      .filter((app) => {
        if (statusFilter !== "all" && app.status !== statusFilter) return false;
        const q = search.toLowerCase();
        if (q && !app.name.toLowerCase().includes(q) && !app.url.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortBy === "name") cmp = a.name.localeCompare(b.name);
        else if (sortBy === "uptime") {
          cmp = (a.uptimePercentage ?? -1) - (b.uptimePercentage ?? -1);
        } else if (sortBy === "latency") {
          cmp = (a.latestResponseTime ?? 999999) - (b.latestResponseTime ?? 999999);
        }
        return sortAsc ? cmp : -cmp;
      });
  }, [data, search, statusFilter, sortBy, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredApps.length / PAGE_SIZE));
  const pagedApps = filteredApps.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (col: "name" | "uptime" | "latency") => {
    if (sortBy === col) setSortAsc(!sortAsc);
    else {
      setSortBy(col);
      setSortAsc(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Pulse Overview
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Unified application health, security posture, and expiry status.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading}
          className="h-8 gap-1.5 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
          {error}
        </div>
      )}

      {/* Real KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Applications Monitored"
          value={String(data?.totalApps ?? 0)}
          subtitle={`${data?.onlineApps ?? 0} online · ${data?.downApps ?? 0} down · ${data?.warningApps ?? 0} warnings`}
          icon={<Activity className="h-4 w-4 text-emerald-500" />}
        />
        <StatCard
          title="Open Security Findings"
          value={String(data?.openFindings ?? 0)}
          subtitle={`${data?.criticalFindings ?? 0} critical severity`}
          icon={<ShieldAlert className="h-4 w-4 text-rose-500" />}
        />
        <StatCard
          title="Upcoming Expiries"
          value={String(data?.upcomingExpiriesCount ?? 0)}
          subtitle="SSL, domain & credentials"
          icon={<Clock className="h-4 w-4 text-amber-500" />}
        />
        <StatCard
          title="Latest Security Scan"
          value={
            data?.latestScanAt
              ? new Date(data.latestScanAt).toLocaleDateString()
              : "No scans"
          }
          subtitle={`${data?.recentAlerts.length ?? 0} recent alerts`}
          icon={<Bell className="h-4 w-4" />}
        />
      </div>

      {/* Application Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-sm font-semibold">Applications</CardTitle>
            <CardDescription className="text-xs">
              Live status, 24h uptime, latency, and open security findings
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search apps..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="h-8 pl-8 text-xs w-44"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-8 rounded-md border border-input bg-card px-2 text-xs"
            >
              <option value="all">All Statuses</option>
              <option value="online">Online</option>
              <option value="degraded">Degraded</option>
              <option value="down">Down</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {pagedApps.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              {loading ? "Loading applications..." : "No matching applications found."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-y border-border/70 bg-muted/40 font-mono text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">
                      <button onClick={() => toggleSort("name")} className="inline-flex items-center gap-1">
                        Application <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                    <th className="py-2.5 px-4 font-medium">
                      <button onClick={() => toggleSort("uptime")} className="inline-flex items-center gap-1">
                        Uptime (24h) <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="py-2.5 px-4 font-medium">
                      <button onClick={() => toggleSort("latency")} className="inline-flex items-center gap-1">
                        Latency <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="py-2.5 px-4 font-medium">Security</th>
                    <th className="py-2.5 px-4 font-medium text-right">Last Checked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-mono">
                  {pagedApps.map((app) => (
                    <tr key={app.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-sans">
                        <Link href={`/dashboard/applications/${app.id}`} className="font-medium text-foreground hover:underline">
                          {app.name}
                        </Link>
                        <div className="text-[11px] text-muted-foreground font-mono">{app.url}</div>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        {app.status === "pending" ? (
                          <span className="text-xs text-muted-foreground">Pending</span>
                        ) : (
                          <StatusBadge status={app.status} />
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {app.uptimePercentage !== null ? `${app.uptimePercentage}%` : "No data"}
                      </td>
                      <td className="py-3 px-4">
                        {app.latestResponseTime !== null ? `${app.latestResponseTime} ms` : "—"}
                      </td>
                      <td className="py-3 px-4">
                        {app.openFindingsCount > 0 ? (
                          <span className="text-rose-500">
                            {app.openFindingsCount} open ({app.criticalFindingsCount} crit)
                          </span>
                        ) : (
                          <span className="text-emerald-500">0 open</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-muted-foreground">
                        {app.lastCheckedAt ? new Date(app.lastCheckedAt).toLocaleTimeString() : "Never"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="h-7 px-2"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-7 px-2"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom Grid: Recent Alerts & Upcoming Expiries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {(data?.recentAlerts ?? []).length === 0 ? (
              <div className="text-xs text-muted-foreground">No recent alerts.</div>
            ) : (
              data?.recentAlerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="rounded-md border border-border/60 p-2.5 text-xs">
                  <div className="font-medium text-foreground">{alert.title}</div>
                  <div className="text-muted-foreground mt-0.5">{alert.description}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Expiry Watchlist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {(data?.upcomingExpiries ?? []).length === 0 ? (
              <div className="text-xs text-muted-foreground">No expiry items tracked yet.</div>
            ) : (
              data?.upcomingExpiries.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-md border border-border/60 p-2.5 text-xs">
                  <div>
                    <div className="font-medium text-foreground">{item.name}</div>
                    <div className="text-[11px] text-muted-foreground">{item.category.replace("_", " ")}</div>
                  </div>
                  <div className="font-mono text-right">
                    <div>{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : "Unknown"}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {item.days_remaining !== null ? `${item.days_remaining}d left` : "Unverified"}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
