"use server";

import { revalidatePath } from "next/cache";
import { computeProtectionLevels } from "@/lib/protection-levels";
import { createClient } from "@/lib/supabase/server";
import { calculateMonitoringStats } from "@/lib/monitoring/stats";
import type { MonitoringCheckRecord } from "@/lib/supabase/types";

export interface WeeklyReportRecord {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  period_key: string;
  apps_monitored: number;
  uptime_percentage: number | null;
  avg_response_time: number | null;
  downtime_incidents: number;
  recovery_events: number;
  new_findings: number;
  resolved_findings: number;
  upcoming_expiries: number;
  recommended_actions: string[];
  email_sent: boolean;
  created_at: string;
}

function getIsoWeekKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export async function getWeeklyReports(): Promise<{
  reports?: WeeklyReportRecord[];
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Unauthorized" };

  const { data, error } = await supabase
    .from("weekly_reports")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(24);

  if (error) return { error: error.message };
  return { reports: (data || []) as WeeklyReportRecord[] };
}

export async function generateWeeklyReport(): Promise<{
  report?: WeeklyReportRecord;
  duplicate?: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Unauthorized" };

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const periodKey = getIsoWeekKey(now);

  // Prevent duplicate reports for the same user and reporting period
  const { data: existing } = await supabase
    .from("weekly_reports")
    .select("*")
    .eq("user_id", user.id)
    .eq("period_key", periodKey)
    .maybeSingle();

  if (existing) {
    return { report: existing as WeeklyReportRecord, duplicate: true };
  }

  const { data: apps } = await supabase
    .from("applications")
    .select("id")
    .eq("user_id", user.id);

  const appIds = (apps || []).map((a: { id: string }) => a.id);

  let uptimePercentage: number | null = null;
  let avgResponseTime: number | null = null;
  let downtimeIncidents = 0;
  let recoveryEvents = 0;
  let newFindings = 0;
  let resolvedFindings = 0;

  let openErrorGroupsCount = 0;
  let failingBuildsCount = 0;
  let noTestsCount = 0;

  if (appIds.length > 0) {
    const [checksRes, incidentsRes, findingsRes, openErrorsRes, repoStatusRes] = await Promise.all([
      supabase
        .from("monitoring_checks")
        .select("*")
        .in("application_id", appIds)
        .gte("checked_at", sevenDaysAgo.toISOString())
        .limit(1000),
      supabase
        .from("monitoring_incidents")
        .select("id, status, started_at, resolved_at")
        .eq("user_id", user.id)
        .gte("started_at", sevenDaysAgo.toISOString()),
      supabase
        .from("security_findings")
        .select("id, status, created_at, resolved_at")
        .in("application_id", appIds)
        .gte("created_at", sevenDaysAgo.toISOString()),
      supabase
        .from("error_groups")
        .select("id", { count: "exact", head: true })
        .in("application_id", appIds)
        .eq("status", "open"),
      supabase
        .from("repo_status")
        .select("repository_full_name, last_run_conclusion, last_deploy_state, tests_present")
        .in("application_id", appIds),
    ]);

    const checks = (checksRes.data || []) as MonitoringCheckRecord[];
    const stats = calculateMonitoringStats(checks, "7d", now.getTime());
    uptimePercentage = stats.uptimePercentage;
    avgResponseTime = stats.avgResponseTime;

    const incidents = incidentsRes.data || [];
    downtimeIncidents = incidents.length;
    recoveryEvents = incidents.filter((i: { status: string }) => i.status === "resolved").length;

    const findings = findingsRes.data || [];
    newFindings = findings.length;
    resolvedFindings = findings.filter((f: { status: string }) => f.status === "resolved").length;

    openErrorGroupsCount = openErrorsRes.count ?? 0;
    const repoStatuses = (repoStatusRes.data || []) as Array<{
      last_run_conclusion: string | null;
      last_deploy_state: string | null;
      tests_present: boolean;
    }>;
    failingBuildsCount = repoStatuses.filter(
      (r) => r.last_run_conclusion === "failure" || r.last_deploy_state === "failure" || r.last_deploy_state === "error"
    ).length;
    noTestsCount = repoStatuses.filter((r) => !r.tests_present).length;
  }

  const { count: upcomingExpiriesCount } = await supabase
    .from("expiry_items")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", ["expiring_soon", "expired"]);

  const recommendedActions: string[] = [];
  if (downtimeIncidents > 0) {
    recommendedActions.push("Review recent downtime incidents and check server error logs.");
  }
  if (newFindings > resolvedFindings) {
    recommendedActions.push("Address open security findings in the Security Scans dashboard.");
  }
  if ((upcomingExpiriesCount ?? 0) > 0) {
    recommendedActions.push("Renew expiring SSL certificates, domains, or tracked credentials.");
  }
  if (openErrorGroupsCount > 0) {
    recommendedActions.push(`Investigate ${openErrorGroupsCount} open error group(s) reported by your applications.`);
  }
  if (failingBuildsCount > 0) {
    recommendedActions.push(`Fix ${failingBuildsCount} failing GitHub build or deployment pipeline(s).`);
  }
  if (noTestsCount > 0) {
    recommendedActions.push(`Add automated tests to ${noTestsCount} repository/repositories where no tests were detected.`);
  }

  for (const app of (apps || []) as Array<{
    id: string;
    name: string;
    url: string;
    domain_verified_at?: string | null;
    health_check_enabled?: boolean;
    health_check_path?: string | null;
    github_repository_url?: string | null;
  }>) {
    const prot = computeProtectionLevels({
      hasUrl: Boolean(app.url),
      domainVerifiedAt: app.domain_verified_at ?? null,
      healthCheckEnabled: Boolean(app.health_check_enabled),
      healthCheckPath: app.health_check_path ?? null,
      hasGithubRepo: Boolean(app.github_repository_url),
    });
    const nextStep = prot.levels.find(
      (l) => l.status === "not_connected" && l.level !== 6
    );
    if (nextStep) {
      recommendedActions.push(
        `${app.name}: Protection level ${prot.connectedCount} of 6 — Next best step: Level ${nextStep.level} (${nextStep.title}).`
      );
    } else {
      recommendedActions.push(
        `${app.name}: Protection level ${prot.connectedCount} of 6.`
      );
    }
  }

  if (recommendedActions.length === 0) {
    recommendedActions.push("All monitored systems look healthy. Continue regular weekly reviews.");
  }

  const { data: inserted, error: insertError } = await supabase
    .from("weekly_reports")
    .insert({
      user_id: user.id,
      period_start: sevenDaysAgo.toISOString(),
      period_end: now.toISOString(),
      period_key: periodKey,
      apps_monitored: appIds.length,
      uptime_percentage: uptimePercentage,
      avg_response_time: avgResponseTime,
      downtime_incidents: downtimeIncidents,
      recovery_events: recoveryEvents,
      new_findings: newFindings,
      resolved_findings: resolvedFindings,
      upcoming_expiries: upcomingExpiriesCount ?? 0,
      recommended_actions: recommendedActions,
      email_sent: false,
    })
    .select()
    .single();

  if (insertError) return { error: insertError.message };

  revalidatePath("/dashboard/reports");
  return { report: inserted as WeeklyReportRecord };
}
