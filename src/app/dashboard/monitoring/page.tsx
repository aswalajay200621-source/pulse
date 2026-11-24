"use client";

import * as React from "react";
import {
  mockApplications,
  mockAlerts,
  mockLatencyHistory,
  mockUptimeBars,
} from "@/data/mock-data";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { LatencyAreaChart, UptimeBarStrip } from "@/components/shared/simple-charts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Globe,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Radio,
} from "lucide-react";

const regionData = [
  { region: "US-East (N. Virginia)", ping: "42 ms", status: "online" as const, checks: "14,400" },
  { region: "US-West (Oregon)", ping: "68 ms", status: "online" as const, checks: "14,400" },
  { region: "EU-Central (Frankfurt)", ping: "112 ms", status: "online" as const, checks: "14,400" },
  { region: "AP-East (Tokyo)", ping: "148 ms", status: "online" as const, checks: "14,400" },
  { region: "SA-East (São Paulo)", ping: "185 ms", status: "online" as const, checks: "14,400" },
];

export default function MonitoringPage() {
  const [activeWindow, setActiveWindow] = React.useState<"24h" | "7d" | "30d">("24h");
  const incidents = mockAlerts.filter((a) => a.type === "downtime" || a.type === "latency");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Global Monitoring & Probe Network
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Continuous synthetic availability checks from 5 worldwide edge vantage points.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border/70 p-0.5 bg-card">
            {(["24h", "7d", "30d"] as const).map((win) => (
              <button
                key={win}
                onClick={() => setActiveWindow(win)}
                className={`rounded px-2.5 py-1 text-xs font-mono transition-colors ${
                  activeWindow === win
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {win}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Global Fleet Availability"
          value="99.96%"
          change="+0.04% vs last week"
          changeType="positive"
          subtitle="Past 30 days aggregate"
          icon={<Radio className="h-4 w-4 text-emerald-500" />}
        />
        <StatCard
          title="Average Response Time"
          value="84 ms"
          change="Fast (p95: 120ms)"
          changeType="positive"
          subtitle="Weighted worldwide average"
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          title="Active Edge Probes"
          value="5 Regions"
          subtitle="Dispatched every 60 seconds"
          icon={<Globe className="h-4 w-4" />}
        />
        <StatCard
          title="Total Synthetic Checks"
          value="72,000 / day"
          subtitle="100% telemetry retained"
          icon={<Server className="h-4 w-4" />}
        />
      </div>

      {/* Response-time graph */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm font-semibold">
              Global Response Time Visualization ({activeWindow})
            </CardTitle>
            <CardDescription className="text-xs">
              Periodic latency measurements across all edge nodes
            </CardDescription>
          </div>
          <span className="text-xs font-mono text-emerald-500">Normal Range: 40ms - 150ms</span>
        </CardHeader>
        <CardContent>
          <LatencyAreaChart data={mockLatencyHistory} height={220} />
        </CardContent>
      </Card>

      {/* Multi-region Edge Probe Latency Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Geographic Probe Node Health
          </CardTitle>
          <CardDescription className="text-xs">
            Latency and uptime status per telemetry edge node
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-y border-border/70 bg-muted/40 font-mono text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Probe Region</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                  <th className="py-2.5 px-4 font-medium">Latency</th>
                  <th className="py-2.5 px-4 font-medium">24h Checks</th>
                  <th className="py-2.5 px-4 font-medium text-right">Reliability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono">
                {regionData.map((reg) => (
                  <tr key={reg.region} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-sans font-medium text-foreground flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      {reg.region}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <StatusBadge status={reg.status} />
                    </td>
                    <td className="py-3 px-4 text-foreground">{reg.ping}</td>
                    <td className="py-3 px-4 text-muted-foreground">{reg.checks}</td>
                    <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                      99.99%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Incidents History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Incidents & Degradation History
          </CardTitle>
          <CardDescription className="text-xs">
            Recorded downtime events, latency surges, and remediation timestamps
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {incidents.map((inc) => (
            <div
              key={inc.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border/60 bg-card p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={inc.severity} />
                  <span className="font-semibold text-xs sm:text-sm text-foreground">
                    {inc.title}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{inc.message}</p>
                <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-muted-foreground">
                  <span>Target: {inc.appName}</span>
                  <span>•</span>
                  <span>Triggered {inc.timestamp}</span>
                </div>
              </div>

              <div className="shrink-0">
                <span className="inline-flex rounded border border-border/70 bg-muted/40 px-2 py-1 font-mono text-xs text-muted-foreground">
                  Auto-diagnostic captured
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
