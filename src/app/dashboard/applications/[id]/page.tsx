"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  mockApplications,
  mockAlerts,
  mockSecurityFindings,
  mockLatencyHistory,
  mockUptimeBars,
} from "@/data/mock-data";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { LatencyAreaChart, UptimeBarStrip } from "@/components/shared/simple-charts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Globe,
  Lock,
  RefreshCw,
  Bell,
} from "lucide-react";

export default function ApplicationDetailsPage() {
  const params = useParams();
  const appId = (params?.id as string) || "app-1";

  const app =
    mockApplications.find((a) => a.id === appId) || mockApplications[0];

  const appAlerts = mockAlerts.filter((alt) => alt.appId === app.id);
  const appFindings = mockSecurityFindings.filter((f) => f.appId === app.id);

  const [refreshing, setRefreshing] = React.useState(false);

  const triggerManualProbe = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  };

  return (
    <div className="space-y-6">
      {/* Back button and title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <Link
            href="/dashboard/applications"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to My Applications
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {app.name}
            </h1>
            <StatusBadge status={app.status} />
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground font-mono">
            <span>{app.url}</span>
            <a
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
            <span>•</span>
            <span className="uppercase">{app.environment}</span>
            <span>•</span>
            <span>Region: {app.location}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            onClick={triggerManualProbe}
            disabled={refreshing}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Probing..." : "Probe Now"}
          </Button>
          <Link href="/dashboard/security">
            <Button size="sm" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Scan Security
            </Button>
          </Link>
        </div>
      </div>

      {/* Top Application Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Uptime (30-day)"
          value={`${app.uptimePercent}%`}
          change="SLA Compliant"
          changeType="positive"
          subtitle="Continuous 60s probe cycle"
        />
        <StatCard
          title="Current Response Time"
          value={app.avgLatencyMs > 0 ? `${app.avgLatencyMs} ms` : "Offline"}
          change="p95: 110ms"
          changeType={app.avgLatencyMs > 200 ? "negative" : "neutral"}
          subtitle="Probed via Edge network"
        />
        <StatCard
          title="Health Score"
          value={`${app.healthScore}/100`}
          change="Excellent"
          changeType="positive"
          subtitle="Composite uptime & security"
        />
        <StatCard
          title="SSL Certificate"
          value={`${app.sslCertificate.daysRemaining} days`}
          subtitle={`Issued by ${app.sslCertificate.issuer.slice(0, 16)}...`}
          change={app.sslCertificate.status === "valid" ? "Healthy" : "Renew soon"}
          changeType={app.sslCertificate.status === "valid" ? "positive" : "negative"}
        />
      </div>

      {/* Latency & Response-Time Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm font-semibold">
              Response-Time Visualization
            </CardTitle>
            <CardDescription className="text-xs">
              24-hour synthetic probe response durations in milliseconds
            </CardDescription>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            Target SLA: &lt; 250ms
          </span>
        </CardHeader>
        <CardContent>
          <LatencyAreaChart data={mockLatencyHistory} height={200} />
        </CardContent>
      </Card>

      {/* Uptime Overview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            30-Day Historical Availability
          </CardTitle>
          <CardDescription className="text-xs">
            Hourly availability segments over the past month
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UptimeBarStrip bars={mockUptimeBars} />
        </CardContent>
      </Card>

      {/* Two columns: Security summary & Recent alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              Security Summary & Header Posture
            </CardTitle>
            <CardDescription className="text-xs">
              Automated TLS validation and HTTP header configurations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {appFindings.length === 0 ? (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                <ShieldCheck className="mx-auto h-6 w-6 text-emerald-500 mb-1" />
                No active security findings detected for this application.
              </div>
            ) : (
              appFindings.map((finding) => (
                <div
                  key={finding.id}
                  className="rounded-lg border border-border/60 bg-card p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      {finding.title}
                    </span>
                    <StatusBadge status={finding.severity} />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {finding.description}
                  </p>
                  <div className="rounded bg-muted/40 p-2 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">Recommendation: </span>
                    {finding.recommendation}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              Recent Application Alerts
            </CardTitle>
            <CardDescription className="text-xs">
              Incident triggers logged during check routines
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {appAlerts.length === 0 ? (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                <Bell className="mx-auto h-6 w-6 text-muted-foreground mb-1" />
                No open alerts logged for this application.
              </div>
            ) : (
              appAlerts.map((alt) => (
                <div
                  key={alt.id}
                  className="rounded-lg border border-border/60 bg-card p-3 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      {alt.title}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {alt.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{alt.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
