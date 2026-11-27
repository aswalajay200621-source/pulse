"use client";

import * as React from "react";
import Link from "next/link";
import {
  getMonitoringDashboardData,
  type MonitoringDashboardData,
} from "@/app/actions/monitoring";
import type { MonitoringWindow } from "@/lib/monitoring/stats";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { LatencyAreaChart } from "@/components/shared/simple-charts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Radio,
  ShieldAlert,
} from "lucide-react";

export default function MonitoringPage() {
  const [activeWindow, setActiveWindow] = React.useState<MonitoringWindow>("24h");
  const [selectedAppId, setSelectedAppId] = React.useState<string>("all");
  const [data, setData] = React.useState<MonitoringDashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async (win: MonitoringWindow) => {
    setLoading(true);
    setError(null);
    const res = await getMonitoringDashboardData(win);
    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setData(res.data);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadData(activeWindow);
  }, [activeWindow, loadData]);

  const applications = data?.applications ?? [];
  const selectedApp =
    selectedAppId === "all"
      ? null
      : applications.find((a) => a.id === selectedAppId) ?? null;

  const activeChecks = React.useMemo(() => {
    if (!data) return [];
    if (selectedApp) {
      return data.checksByApp[selectedApp.id] ?? [];
    }
    return Object.values(data.checksByApp).flat();
  }, [data, selectedApp]);

  const aggregateStats = React.useMemo(() => {
    if (!data) return null;
    if (selectedApp) {
      return data.statsByApp[selectedApp.id] ?? null;
    }
    const allStats = Object.values(data.statsByApp);
    const totalChecks = allStats.reduce((s, st) => s + st.totalChecks, 0);
    const successfulChecks = allStats.reduce((s, st) => s + st.successfulChecks, 0);
    const slowWarningsCount = allStats.reduce((s, st) => s + st.slowWarningsCount, 0);
    const validAvgs = allStats.map((s) => s.avgResponseTime).filter((v): v is number => v !== null);
    const validMins = allStats.map((s) => s.minResponseTime).filter((v): v is number => v !== null);
    const validMaxs = allStats.map((s) => s.maxResponseTime).filter((v): v is number => v !== null);

    const latestCheck =
      activeChecks.length > 0
        ? [...activeChecks].sort(
          (a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime()
        )[0]
        : null;

    return {
      totalChecks,
      uptimePercentage:
        totalChecks > 0 ? Number(((successfulChecks / totalChecks) * 100).toFixed(2)) : null,
      avgResponseTime:
        validAvgs.length > 0
          ? Math.round(validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length)
          : null,
      minResponseTime: validMins.length > 0 ? Math.min(...validMins) : null,
      maxResponseTime: validMaxs.length > 0 ? Math.max(...validMaxs) : null,
      slowWarningsCount,
      latestCheck,
    };
  }, [data, selectedApp, activeChecks]);

  const chartData = React.useMemo(() => {
    return [...activeChecks]
      .filter((c) => typeof c.response_time === "number")
      .sort((a, b) => new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime())
      .slice(-40)
      .map((c) => ({
        time: new Date(c.checked_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        value: c.response_time ?? 0,
      }));
  }, [activeChecks]);

  const filteredIncidents = React.useMemo(() => {
    const all = data?.incidents ?? [];
    if (!selectedApp) return all;
    return all.filter((i) => i.application_id === selectedApp.id);
  }, [data, selectedApp]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Uptime & Performance Monitoring
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Pulse checks your apps automatically every 10 minutes and alerts you if anything goes down or slows down.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedAppId}
            onChange={(e) => setSelectedAppId(e.target.value)}
            className="h-8 rounded-md border border-border/70 bg-card px-2.5 text-xs text-foreground"
          >
            <option value="all">All Applications ({applications.length})</option>
            {applications.map((app) => (
              <option key={app.id} value={app.id}>
                {app.name}
              </option>
            ))}
          </select>

          <div className="inline-flex rounded-md border border-border/70 p-0.5 bg-card">
            {(["24h", "7d", "30d"] as const).map((win) => (
              <button
                key={win}
                onClick={() => setActiveWindow(win)}
                className={`rounded px-2.5 py-1 text-xs font-mono transition-colors ${activeWindow === win
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                {win}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(activeWindow)}
            disabled={loading}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
          Failed to load monitoring data: {error}
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={`Uptime (${activeWindow})`}
          value={
            aggregateStats?.uptimePercentage !== null && aggregateStats?.uptimePercentage !== undefined
              ? `${aggregateStats.uptimePercentage}%`
              : "No data"
          }
          subtitle={
            aggregateStats?.totalChecks
              ? `Based on ${aggregateStats.totalChecks} real checks`
              : "Awaiting first scheduled check"
          }
          icon={<Radio className="h-4 w-4 text-emerald-500" />}
        />
        <StatCard
          title="Average Response Time"
          value={
            aggregateStats?.avgResponseTime !== null && aggregateStats?.avgResponseTime !== undefined
              ? `${aggregateStats.avgResponseTime} ms`
              : "—"
          }
          subtitle={
            aggregateStats?.minResponseTime !== null && aggregateStats?.maxResponseTime !== null
              ? `Min: ${aggregateStats?.minResponseTime}ms · Max: ${aggregateStats?.maxResponseTime}ms`
              : "No latency samples yet"
          }
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          title="Slow-Response Warnings"
          value={String(aggregateStats?.slowWarningsCount ?? 0)}
          subtitle="Checks exceeding 1,500 ms"
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
        />
        <StatCard
          title="Last Checked"
          value={
            aggregateStats?.latestCheck
              ? new Date(aggregateStats.latestCheck.checked_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
              : "Never"
          }
          subtitle={
            aggregateStats?.latestCheck
              ? `Status: ${aggregateStats.latestCheck.status.toUpperCase()} (${aggregateStats.latestCheck.response_time ?? "—"
              }ms)`
              : "Scheduled every 10 minutes"
          }
          icon={<Activity className="h-4 w-4" />}
        />
      </div>

      {/* Response-time graph */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm font-semibold">
              Response Time History ({activeWindow})
            </CardTitle>
            <CardDescription className="text-xs">
              How fast your app responds — measured every 10 minutes
            </CardDescription>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            Slow threshold: 1,500ms
          </span>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <LatencyAreaChart data={chartData} height={220} />
          ) : (
            <div className="flex h-[220px] items-center justify-center rounded-md border border-dashed border-border/70 text-xs text-muted-foreground">
              No monitoring checks recorded yet for this window.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Application Status Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Monitored Applications</CardTitle>
          <CardDescription className="text-xs">
            Current status, response speed, and {activeWindow} uptime per app
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {applications.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No applications configured.{" "}
              <Link href="/dashboard/applications" className="text-primary underline">
                Add an application
              </Link>{" "}
              to start monitoring.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-y border-border/70 bg-muted/40 font-mono text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Application</th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                    <th className="py-2.5 px-4 font-medium">Response Time</th>
                    <th className="py-2.5 px-4 font-medium">Uptime ({activeWindow})</th>
                    <th className="py-2.5 px-4 font-medium text-right">Last Checked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-mono">
                  {applications.map((app) => {
                    const st = data?.statsByApp[app.id];
                    const latest = st?.latestCheck;
                    return (
                      <tr key={app.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-sans font-medium text-foreground">
                          <Link
                            href={`/dashboard/applications/${app.id}`}
                            className="hover:underline"
                          >
                            {app.name}
                          </Link>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {app.url}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-sans">
                          {latest ? (
                            <StatusBadge status={latest.status} />
                          ) : (
                            <span className="text-xs text-muted-foreground">Pending</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {latest?.response_time !== null && latest?.response_time !== undefined
                            ? `${latest.response_time} ms`
                            : "—"}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {st?.uptimePercentage !== null && st?.uptimePercentage !== undefined
                            ? `${st.uptimePercentage}%`
                            : "No data"}
                        </td>
                        <td className="py-3 px-4 text-right text-xs text-muted-foreground">
                          {latest
                            ? new Date(latest.checked_at).toLocaleString()
                            : "Not checked yet"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Incidents & Recovery History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Recent Incidents & Recovery History
          </CardTitle>
          <CardDescription className="text-xs">
            Downtime is declared after 3 consecutive failed checks and resolved automatically on recovery.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredIncidents.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              No downtime incidents recorded.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredIncidents.map((inc) => {
                const appName =
                  applications.find((a) => a.id === inc.application_id)?.name ?? "Application";
                return (
                  <div
                    key={inc.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-md border border-border/70 p-3 text-xs"
                  >
                    <div className="flex items-start gap-2.5">
                      <ShieldAlert
                        className={`h-4 w-4 mt-0.5 ${inc.status === "open" ? "text-red-500" : "text-emerald-500"
                          }`}
                      />
                      <div>
                        <div className="font-medium text-foreground">
                          {appName} —{" "}
                          <span
                            className={
                              inc.status === "open" ? "text-red-500" : "text-emerald-500"
                            }
                          >
                            {inc.status === "open" ? "Ongoing Downtime" : "Recovered"}
                          </span>
                        </div>
                        <div className="text-muted-foreground mt-0.5">
                          {inc.last_error || "3 consecutive failed checks"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono text-[11px] text-muted-foreground">
                      <div>Started: {new Date(inc.started_at).toLocaleString()}</div>
                      {inc.resolved_at && (
                        <div>Resolved: {new Date(inc.resolved_at).toLocaleString()}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
