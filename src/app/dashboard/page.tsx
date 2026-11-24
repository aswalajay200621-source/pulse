"use client";

import * as React from "react";
import Link from "next/link";
import {
  mockApplications,
  mockSecurityFindings,
  mockRecentActivity,
  mockLatencyHistory,
  mockUptimeBars,
} from "@/data/mock-data";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { LatencyAreaChart, UptimeBarStrip } from "@/components/shared/simple-charts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Server,
  CheckCircle2,
  AlertOctagon,
  ShieldAlert,
  ArrowUpRight,
  ExternalLink,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  Clock,
  ChevronRight,
  Layers,
} from "lucide-react";

export default function DashboardOverviewPage() {
  const totalApps = mockApplications.length;
  const onlineApps = mockApplications.filter((a) => a.status === "online").length;
  const downApps = mockApplications.filter((a) => a.status === "down").length;
  const degradedApps = mockApplications.filter((a) => a.status === "degraded").length;

  const totalCriticalSecurity = mockApplications.reduce(
    (acc, a) => acc + a.securityIssuesCount.critical,
    0
  );
  const totalHighSecurity = mockApplications.reduce(
    (acc, a) => acc + a.securityIssuesCount.high,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            System Overview
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Real-time status across your 5 monitored applications and security posture.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/dashboard/applications">
            <Button size="sm" variant="outline" className="gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Manage Apps
            </Button>
          </Link>
          <Link href="/dashboard/security">
            <Button size="sm" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Run Security Audit
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Statistic Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Applications"
          value={totalApps}
          subtitle="All active synthetic checks"
          icon={<Server className="h-4 w-4" />}
        />
        <StatCard
          title="Applications Online"
          value={onlineApps}
          change="3 healthy"
          changeType="positive"
          subtitle={`${degradedApps} degraded service`}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
        />
        <StatCard
          title="Applications Down"
          value={downApps}
          change={downApps > 0 ? "Requires action" : "All clear"}
          changeType={downApps > 0 ? "negative" : "positive"}
          subtitle="Outage on Staging API"
          icon={<AlertOctagon className="h-4 w-4 text-rose-500" />}
        />
        <StatCard
          title="Security Issues"
          value={totalCriticalSecurity + totalHighSecurity}
          change={`${totalCriticalSecurity} Critical`}
          changeType="negative"
          subtitle="Across headers & TLS"
          icon={<ShieldAlert className="h-4 w-4 text-amber-500" />}
        />
      </div>

      {/* Uptime Trend & System Latency */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-semibold">
                Network Latency Benchmark (24 Hours)
              </CardTitle>
              <CardDescription className="text-xs">
                Average global response time across synthetic probes (84ms current avg)
              </CardDescription>
            </div>
            <Link
              href="/dashboard/monitoring"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              Details <ChevronRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            <LatencyAreaChart data={mockLatencyHistory} height={180} />
          </CardContent>
        </Card>

        {/* Global Uptime strip & SLA card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              30-Day Fleet Health & SLA
            </CardTitle>
            <CardDescription className="text-xs">
              Aggregate availability calculated across 43,200 probes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Rolling SLA Target</span>
                <span className="font-mono text-sm font-bold text-foreground">99.90%</span>
              </div>
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-xs text-muted-foreground">Current Realized</span>
                <span className="font-mono text-sm font-bold text-emerald-500">99.94%</span>
              </div>
              <UptimeBarStrip bars={mockUptimeBars} />
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1">
              <div className="flex items-center justify-between text-xs font-medium text-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" /> MTTR (Mean Time to Recovery)
                </span>
                <span className="font-mono">8.4 mins</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Downtime response SLA honored within agreed target bounds.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Applications Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm sm:text-base font-semibold">
              Monitored Applications
            </CardTitle>
            <CardDescription className="text-xs">
              Status, availability, and vulnerability overview per endpoint
            </CardDescription>
          </div>
          <Link href="/dashboard/applications">
            <Button variant="outline" size="sm" className="text-xs">
              View All ({mockApplications.length})
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-y border-border/70 bg-muted/40 font-mono text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Application</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                  <th className="py-2.5 px-4 font-medium">Uptime</th>
                  <th className="py-2.5 px-4 font-medium">Latency</th>
                  <th className="py-2.5 px-4 font-medium">Security Issues</th>
                  <th className="py-2.5 px-4 font-medium">Certificate</th>
                  <th className="py-2.5 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {mockApplications.map((app) => (
                  <tr
                    key={app.id}
                    className="hover:bg-muted/30 transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <Link
                          href={`/dashboard/applications/${app.id}`}
                          className="font-medium text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5"
                        >
                          {app.name}
                          <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                        <span className="font-mono text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          {app.url}
                          <a
                            href={app.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground/60 hover:text-foreground"
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="py-3 px-4 font-mono font-medium">
                      {app.uptimePercent}%
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {app.avgLatencyMs > 0 ? `${app.avgLatencyMs} ms` : "—"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-xs font-mono">
                        {app.securityIssuesCount.critical > 0 && (
                          <span className="rounded bg-rose-500/10 text-rose-500 border border-rose-500/20 px-1 py-0.2">
                            {app.securityIssuesCount.critical} crit
                          </span>
                        )}
                        {app.securityIssuesCount.high > 0 && (
                          <span className="rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1 py-0.2">
                            {app.securityIssuesCount.high} high
                          </span>
                        )}
                        {app.securityIssuesCount.critical === 0 &&
                          app.securityIssuesCount.high === 0 && (
                            <span className="text-muted-foreground">Clean</span>
                          )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge
                        status={app.sslCertificate.status}
                        showIcon={false}
                      />
                      <span className="ml-1.5 text-[11px] font-mono text-muted-foreground">
                        {app.sslCertificate.daysRemaining}d left
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/dashboard/applications/${app.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                          Inspect
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Two-column layout: Recent Activity & Upcoming Expiry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              Recent System Activity
            </CardTitle>
            <CardDescription className="text-xs">
              Automated audit scans, status transitions, and threshold alerts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockRecentActivity.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/60 p-3"
              >
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs">
                    <p className="font-semibold text-foreground truncate">
                      {item.title}
                    </p>
                    <span className="font-mono text-[11px] text-muted-foreground shrink-0 ml-2">
                      {item.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Security Overview & Upcoming Expiries */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              Upcoming Expiries & Safeguards
            </CardTitle>
            <CardDescription className="text-xs">
              TLS certificate renewal countdowns and domain registration terms
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockApplications
              .filter((a) => a.sslCertificate.daysRemaining <= 90)
              .map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-card/60 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {app.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">
                      SSL ({app.sslCertificate.issuer})
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <StatusBadge status={app.sslCertificate.status} />
                    <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                      Expires {app.sslCertificate.validUntil}
                    </p>
                  </div>
                </div>
              ))}

            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">Domain Registration: acmepay.io</span>
                <span className="font-mono text-[11px] text-muted-foreground">412 days remaining</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Managed by Cloudflare Registrar with auto-renew enabled.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
