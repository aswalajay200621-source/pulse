"use server";

import { createClient } from "@/lib/supabase/server";
import { calculateMonitoringStats } from "@/lib/monitoring/stats";
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

  const [checksRes, findingsRes, scansRes, expiryRes, alertsRes] = await Promise.all([
    supabase
      .from("monitoring_checks")
      .select("*")
      .in("application_id", appIds)
      .gte("checked_at", sevenDaysAgo)
      .order("checked_at", { ascending: false })
      .limit(500),
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
      .select("*")
      .eq("user_id", user.id)
      .order("days_remaining", { ascending: true, nullsFirst: false })
      .limit(20),
    supabase
      .from("alerts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
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
  const expiries = (expiryRes.data || []) as ExpiryItemRecord[];
  const recentAlerts = (alertsRes.data || []) as AlertRecord[];

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

    return {
      id: app.id,
      name: app.name,
      url: app.url,
      status,
      uptimePercentage: stats.uptimePercentage,
      latestResponseTime: latest?.response_time ?? null,
      openFindingsCount: appFindings.length,
      criticalFindingsCount: criticalCount,
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
