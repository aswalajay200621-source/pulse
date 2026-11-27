"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { computeHealthScore, type HealthScoreResult } from "@/lib/health-score";
import { calculateMonitoringStats } from "@/lib/monitoring/stats";
import type { MonitoringCheckRecord } from "@/lib/supabase/types";

export interface HealthSnapshotPoint {
  snapshot_date: string;
  score: number;
}

type CachedHealthScore = {
  data: HealthScoreResult & { snapshots: HealthSnapshotPoint[] };
  expiresAt: number;
};

const healthScoreCache = new Map<string, CachedHealthScore>();
const HEALTH_SCORE_TTL_MS = 45_000;

export async function getApplicationHealthScore(applicationId: string): Promise<{
  data?: HealthScoreResult & { snapshots: HealthSnapshotPoint[] };
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase not configured." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Unauthorized" };

  const cacheKey = `${user.id}:${applicationId}`;
  const cached = healthScoreCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { data: cached.data };
  }

  const { data: app } = await supabase
    .from("applications")
    .select("id, health_check_enabled")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!app) return { error: "Application not found." };

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [checksRes, findingsRes, expiryRes, errorsRes, repoRes, hcRes, snapshotsRes] =
    await Promise.all([
      supabase
        .from("monitoring_checks")
        .select("id, application_id, status, response_time, checked_at")
        .eq("application_id", applicationId)
        .gte("checked_at", sevenDaysAgo)
        .order("checked_at", { ascending: false })
        .limit(150),
      supabase
        .from("security_findings")
        .select("severity")
        .eq("application_id", applicationId)
        .eq("status", "open"),
      supabase
        .from("expiry_items")
        .select("category, days_remaining")
        .eq("application_id", applicationId),
      supabase
        .from("error_groups")
        .select("id", { count: "exact", head: true })
        .eq("application_id", applicationId)
        .eq("status", "open"),
      supabase
        .from("repo_status")
        .select("last_run_conclusion, tests_present")
        .eq("application_id", applicationId)
        .maybeSingle(),
      app.health_check_enabled
        ? supabase
            .from("health_check_results")
            .select("status")
            .eq("application_id", applicationId)
            .order("checked_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("health_score_snapshots")
        .select("snapshot_date, score")
        .eq("application_id", applicationId)
        .order("snapshot_date", { ascending: true })
        .limit(30),
    ]);

  const checks = (checksRes.data || []) as MonitoringCheckRecord[];
  const stats7d = calculateMonitoringStats(checks, "7d");
  const latest = stats7d.latestCheck;

  const findings = (findingsRes.data || []) as Array<{ severity: string }>;
  const expiries = (expiryRes.data || []) as Array<{
    category: string;
    days_remaining: number | null;
  }>;
  const sslItem = expiries.find((e) => e.category === "ssl_certificate");
  const domainItem = expiries.find((e) => e.category === "domain");

  const result = computeHealthScore({
    applicationId,
    isDownNow: latest ? latest.status === "down" : null,
    uptime7d: stats7d.uptimePercentage,
    sslDaysRemaining: sslItem?.days_remaining ?? null,
    domainDaysRemaining: domainItem?.days_remaining ?? null,
    openCriticalFindings: findings.filter((f) => f.severity === "critical").length,
    openHighFindings: findings.filter((f) => f.severity === "high").length,
    openMediumFindings: findings.filter((f) => f.severity === "medium").length,
    openNewOrGrowingErrors: errorsRes.count ?? 0,
    latestBuildFailing: repoRes.data
      ? ["failure", "cancelled", "timed_out"].includes(repoRes.data.last_run_conclusion || "")
      : null,
    testsPresent: repoRes.data ? repoRes.data.tests_present : null,
    healthCheckFailing: hcRes.data ? hcRes.data.status !== "healthy" : null,
  });

  const payload = {
    ...result,
    snapshots: (snapshotsRes.data || []) as HealthSnapshotPoint[],
  };
  healthScoreCache.set(cacheKey, {
    data: payload,
    expiresAt: Date.now() + HEALTH_SCORE_TTL_MS,
  });

  return { data: payload };
}
