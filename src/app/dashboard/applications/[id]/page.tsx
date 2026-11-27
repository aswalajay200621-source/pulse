"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getApplicationById, updateApplication, deleteApplication } from "@/app/actions/applications";
import { DeepScanTab } from "@/components/security/deep-scan-tab";
import { ErrorReportingTab } from "@/components/code-health/error-reporting-tab";
import { HealthCheckTab } from "@/components/code-health/health-check-tab";
import { CodeHealthCard } from "@/components/code-health/code-health-card";
import { HealthScoreCard } from "@/components/code-health/health-score-card";
import { StatusPageTab } from "@/components/code-health/status-page-tab";
import { ProtectionLevelsView } from "@/components/code-health/protection-levels-view";
import { ApplicationRecord } from "@/lib/supabase/types";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Power,
  Trash2,
} from "lucide-react";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

type TabId = "overview" | "deep-scan" | "errors" | "health-check" | "status-page" | "protection";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "protection", label: "Protection" },
  { id: "deep-scan", label: "Deep Scan" },
  { id: "errors", label: "Errors" },
  { id: "health-check", label: "Health Check" },
  { id: "status-page", label: "Status Page" },
];

export default function ApplicationDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const appId = (params?.id as string) || "";

  const [dbApp, setDbApp] = React.useState<ApplicationRecord | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [probing, setProbing] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<TabId>("overview");

  React.useEffect(() => {
    async function loadData() {
      if (!appId) return;
      setLoading(true);
      const res = await getApplicationById(appId);
      if (res.success && res.data) setDbApp(res.data);
      setLoading(false);
    }
    loadData();
  }, [appId]);

  const appName = dbApp?.name ?? (loading ? "Loading..." : "Application");
  const appUrl = dbApp?.url ?? "";
  const appDescription = dbApp?.description ?? "";
  const appGithub = dbApp?.github_repository_url ?? null;
  const appCreated = dbApp ? new Date(dbApp.created_at).toLocaleDateString() : "—";
  const isMonitoringEnabled = dbApp ? dbApp.monitoring_enabled : false;

  const triggerManualProbe = () => {
    setProbing(true);
    setTimeout(() => setProbing(false), 800);
  };

  const handleToggleMonitoring = async () => {
    if (!dbApp) return;
    const newStatus = !dbApp.monitoring_enabled;
    setDbApp({ ...dbApp, monitoring_enabled: newStatus });
    await updateApplication(dbApp.id, { monitoring_enabled: newStatus });
  };

  const handleDelete = async () => {
    if (!dbApp) return;
    if (confirm(`Permanently delete "${dbApp.name}"?`)) {
      await deleteApplication(dbApp.id);
      router.push("/dashboard/applications");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <Link
            href="/dashboard/applications"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to My Applications
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{appName}</h1>
            <span className={`rounded-full px-2 py-0.5 text-xs font-mono font-medium border ${
              isMonitoringEnabled
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-muted text-muted-foreground border-border"
            }`}>
              {isMonitoringEnabled ? "Active Monitoring" : "Paused"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground font-mono">
            <span>{appUrl}</span>
            <a href={appUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground inline-flex items-center">
              <ExternalLink className="h-3 w-3" />
            </a>
            <span>•</span>
            <span>Created {appCreated}</span>
            {appGithub && (
              <>
                <span>•</span>
                <a href={appGithub} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-foreground hover:underline">
                  <GithubIcon className="h-3 w-3" /> GitHub Repo
                </a>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {dbApp && (
            <Button size="sm" variant="outline" onClick={handleToggleMonitoring} className="gap-1.5">
              <Power className="h-3.5 w-3.5" />
              {isMonitoringEnabled ? "Pause" : "Resume"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={triggerManualProbe} disabled={probing} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${probing ? "animate-spin" : ""}`} />
            {probing ? "Checking..." : "Probe Now"}
          </Button>
          {dbApp && (
            <Button size="sm" variant="destructive" onClick={handleDelete} className="gap-1.5">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-2 print:hidden flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "deep-scan" && (
        <DeepScanTab applicationId={appId} applicationName={appName} applicationUrl={appUrl} />
      )}

      {activeTab === "errors" && (
        <ErrorReportingTab applicationId={appId} applicationUrl={appUrl} />
      )}

      {activeTab === "health-check" && (
        <HealthCheckTab
          applicationId={appId}
          applicationUrl={appUrl}
          initialPath={dbApp?.health_check_path ?? null}
          initialEnabled={dbApp?.health_check_enabled ?? false}
        />
      )}

      {activeTab === "status-page" && (
        <StatusPageTab applicationId={appId} applicationName={appName} />
      )}

      {activeTab === "overview" && (
        <div className="space-y-6">
          {appDescription && (
            <Card className="border-border/60 bg-muted/20">
              <CardContent className="p-4 text-xs sm:text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Service Purpose: </span>
                {appDescription}
              </CardContent>
            </Card>
          )}

          {/* Health Score Card */}
          {dbApp && <HealthScoreCard applicationId={appId} />}

          {/* Code Health Card */}
          {dbApp && (
            <CodeHealthCard applicationId={appId} hasGithubRepo={!!dbApp.github_repository_url} />
          )}

          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-base">
            <StatCard
              title="Site Checks"
              value={dbApp?.monitoring_enabled ? "Active" : "Paused"}
              change={dbApp?.monitoring_enabled ? "Checking automatically" : "Checks paused"}
              changeType={dbApp?.monitoring_enabled ? "positive" : "neutral"}
              subtitle="Checks if your site is online"
            />
            <StatCard
              title="Deep Health Check"
              value={dbApp?.health_check_enabled ? "Enabled" : "Not Set"}
              change={dbApp?.health_check_path || "/api/health"}
              changeType={dbApp?.health_check_enabled ? "positive" : "neutral"}
              subtitle="Checks if your database & backend work"
            />
            <StatCard
              title="Code & Secrets"
              value={dbApp?.github_repository_url ? "Connected" : "Not Linked"}
              change={dbApp?.github_repository_url ? "Scanning code" : "Link in settings"}
              changeType={dbApp?.github_repository_url ? "positive" : "neutral"}
              subtitle="Finds leaked passwords & bugs"
            />
            <StatCard
              title="Added"
              value={dbApp?.created_at ? new Date(dbApp.created_at).toLocaleDateString() : "—"}
              change="Tracked in Pulse"
              changeType="neutral"
              subtitle="Date added"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Security Summary &amp; Header Posture</CardTitle>
                <CardDescription className="text-xs">Automated TLS validation and HTTP header configurations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border border-border/60 bg-card p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">X-Content-Type-Options Header Absent</span>
                    <StatusBadge status="medium" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Browsers might MIME-sniff response types away from declared content-type, creating subtle security risks.
                  </p>
                  <div className="rounded bg-muted/40 p-2 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">Recommendation: </span>
                    Set X-Content-Type-Options: nosniff on all HTTP responses.
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Recent Application Alerts</CardTitle>
                <CardDescription className="text-xs">Incident triggers logged during check routines</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                  <ShieldCheck className="mx-auto h-6 w-6 text-emerald-500 mb-1" />
                  All clear. No active downtime incidents or unhandled alerts for this endpoint.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "protection" && (
        <ProtectionLevelsView applicationId={appId} />
      )}
    </div>
  );
}
