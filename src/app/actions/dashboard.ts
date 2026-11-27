"use server";

import { createClient } from "@/lib/supabase/server";
import { calculateMonitoringStats } from "@/lib/monitoring/stats";
import { computeHealthScore, type HealthBand } from "@/lib/health-score";
import { computeProtectionLevels } from "@/lib/protection-levels";
import type {
  AlertRecord,
  ApplicationRecord,
  ExpiryItemRecord,
  MonitoringCheckRecord,
} from "@/lib/supabase/types";

export interface UnifiedAppRow {
  id: string;
  name: string;
  url: string;
  status: "online" | "degraded" | "down" | "maintenance" | "pending";
  uptimePercentage: number | null;
  latestResponseTime: number | null;
  openFindingsCount: number;
  criticalFindingsCount: number;
  openErrorsCount: number;
  codeHealthState: "good" | "warn" | "bad" | "unknown";
  healthScore: number;
  healthBand: HealthBand;
  protectionLevel: number;
  lastCheckedAt: string | null;
  latestScanAt: string | null;
}

export interface UnifiedDashboardData {
  totalApps: number;
  onlineApps: number;
  downApps: number;
  warningApps: number;
  openFindings: number;
  criticalFindings: number;
  upcomingExpiriesCount: number;
  latestScanAt: string | null;
  apps: UnifiedAppRow[];
  recentAlerts: AlertRecord[];
  upcomingExpiries: ExpiryItemRecord[];
}

export async function getUnifiedDashboardData(): Promise<{
  data?: UnifiedDashboardData;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  const { data: appsData, error: appsError } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (appsError) return { error: appsError.message };

  const applications = (appsData || []) as ApplicationRecord[];
  const appIds = applications.map((a) => a.id);

  if (appIds.length === 0) {
    return {
      data: {
        totalApps: 0,
        onlineApps: 0,
        downApps: 0,
        warningApps: 0,
        openFindings: 0,
        criticalFindings: 0,
        upcomingExpiriesCount: 0,
        latestScanAt: null,
        apps: [],
        recentAlerts: [],
        upcomingExpiries: [],
      },
    };
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [checksRes, findingsRes, scansRes, expiryRes, alertsRes, errorsRes, repoRes] = await Promise.all([
    supabase
      .from("monitoring_checks")
      .select("id, application_id, status, response_time, checked_at")
      .in("application_id", appIds)
      .gte("checked_at", sevenDaysAgo)
      .order("checked_at", { ascending: false })
      .limit(300),
    supabase
      .from("security_findings")
      .select("id, application_id, severity, status")
      .in("application_id", appIds)
      .eq("status", "open"),
    supabase
      .from("security_scans")
      .select("id, application_id, scanned_at")
      .in("application_id", appIds)
      .order("scanned_at", { ascending: false })
      .limit(20),
    supabase
      .from("expiry_items")
      .select("id, application_id, category, days_remaining, status, domain_or_host")
      .eq("user_id", user.id)
      .order("days_remaining", { ascending: true, nullsFirst: false })
      .limit(20),
    supabase
      .from("alerts")
      .select("id, application_id, severity, title, description, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("error_groups")
      .select("id, application_id")
      .in("application_id", appIds)
      .eq("status", "open"),
    supabase
      .from("repo_status")
      .select("application_id, last_run_conclusion, last_deploy_state, tests_present")
      .in("application_id", appIds),
  ]);

  const checks = (checksRes.data || []) as MonitoringCheckRecord[];
  const openFindingsList = (findingsRes.data || []) as Array<{
    id: string;
    application_id: string;
    severity: string;
  }>;
  const scansList = (scansRes.data || []) as Array<{
    id: string;
    application_id: string;
    scanned_at: string;
  }>;
  const expiries = (expiryRes.data || []) as unknown as ExpiryItemRecord[];
  const recentAlerts = (alertsRes.data || []) as unknown as AlertRecord[];
  const openErrorsList = (errorsRes.data || []) as Array<{ id: string; application_id: string }>;
  const repoStatusesList = (repoRes.data || []) as Array<{
    application_id: string;
    last_run_conclusion: string | null;
    last_deploy_state: string | null;
    tests_present: boolean;
  }>;

  let onlineApps = 0;
  let downApps = 0;
  let warningApps = 0;

  const appRows: UnifiedAppRow[] = applications.map((app) => {
    const appChecks = checks.filter((c) => c.application_id === app.id);
    const stats = calculateMonitoringStats(appChecks, "24h");
    const latest = stats.latestCheck;
    const status = latest ? latest.status : "pending";

    if (status === "online") onlineApps++;
    else if (status === "down") downApps++;
    else if (status === "degraded") warningApps++;

    const appFindings = openFindingsList.filter((f) => f.application_id === app.id);
    const criticalCount = appFindings.filter((f) => f.severity === "critical").length;
    const latestScan = scansList.find((s) => s.application_id === app.id);
    const appOpenErrors = openErrorsList.filter((e) => e.application_id === app.id).length;
    const repoStatus = repoStatusesList.find((r) => r.application_id === app.id);

    let codeHealthState: "good" | "warn" | "bad" | "unknown" = "unknown";
    if (repoStatus) {
      const buildBad = ["failure", "cancelled", "timed_out"].includes(repoStatus.last_run_conclusion || "");
      const deployBad = ["failure", "error"].includes(repoStatus.last_deploy_state || "");
      if (buildBad || deployBad || appOpenErrors >= 10) codeHealthState = "bad";
      else if (!repoStatus.tests_present || appOpenErrors > 0) codeHealthState = "warn";
      else codeHealthState = "good";
    } else if (appOpenErrors >= 10) {
      codeHealthState = "bad";
    } else if (appOpenErrors > 0) {
      codeHealthState = "warn";
    }

    const hs = computeHealthScore({
      applicationId: app.id,
      isDownNow: latest ? status === "down" : null,
      uptime7d: stats.uptimePercentage,
      openCriticalFindings: criticalCount,
      openHighFindings: appFindings.filter((f) => f.severity === "high").length,
      openMediumFindings: appFindings.filter((f) => f.severity === "medium").length,
      openNewOrGrowingErrors: appOpenErrors,
      latestBuildFailing: repoStatus
        ? ["failure", "cancelled", "timed_out"].includes(repoStatus.last_run_conclusion || "")
        : null,
      testsPresent: repoStatus ? repoStatus.tests_present : null,
    });

    const protection = computeProtectionLevels({
      hasUrl: Boolean(app.url),
      domainVerifiedAt: (app as { domain_verified_at?: string | null }).domain_verified_at ?? null,
      healthCheckEnabled: Boolean((app as { health_check_enabled?: boolean }).health_check_enabled),
      healthCheckPath: (app as { health_check_path?: string | null }).health_check_path ?? null,
      hasActiveIngestKey: appOpenErrors > 0,
      lastErrorEventAt: appOpenErrors > 0 ? new Date().toISOString() : null,
      hasGithubRepo: Boolean(app.github_repository_url) || Boolean(repoStatus),
      githubLastBuildFailed: repoStatus
        ? ["failure", "cancelled", "timed_out"].includes(repoStatus.last_run_conclusion || "")
        : false,
    });

    return {
      id: app.id,
      name: app.name,
      url: app.url,
      status,
      uptimePercentage: stats.uptimePercentage,
      latestResponseTime: latest?.response_time ?? null,
      openFindingsCount: appFindings.length,
      criticalFindingsCount: criticalCount,
      openErrorsCount: appOpenErrors,
      codeHealthState,
      healthScore: hs.score,
      healthBand: hs.band,
      protectionLevel: protection.connectedCount,
      lastCheckedAt: latest?.checked_at ?? null,
      latestScanAt: latestScan?.scanned_at ?? null,
    };
  });

  const upcomingExpiries = expiries.filter(
    (e) => e.status === "expiring_soon" || e.status === "expired"
  );

  return {
    data: {
      totalApps: applications.length,
      onlineApps,
      downApps,
      warningApps,
      openFindings: openFindingsList.length,
      criticalFindings: openFindingsList.filter((f) => f.severity === "critical").length,
      upcomingExpiriesCount: upcomingExpiries.length,
      latestScanAt: scansList[0]?.scanned_at ?? null,
      apps: appRows,
      recentAlerts,
      upcomingExpiries: expiries.slice(0, 6),
    },
  };
}
