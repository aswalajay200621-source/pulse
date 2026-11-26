import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeHealthScore } from "@/lib/health-score";
import { calculateMonitoringStats } from "@/lib/monitoring/stats";
import type { MonitoringCheckRecord } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function verifyCronSecret(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader || !authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7).trim();
  if (token.length !== secret.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret));
}

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Clean up snapshots older than 90 days
  await supabaseAdmin
    .from("health_score_snapshots")
    .delete()
    .lt("snapshot_date", ninetyDaysAgo);

  const { data: apps, error: appsErr } = await supabaseAdmin
    .from("applications")
    .select("id, user_id, health_check_enabled");

  if (appsErr) {
    return NextResponse.json({ error: appsErr.message }, { status: 500 });
  }

  const appList = apps || [];
  let saved = 0;

  const BATCH_SIZE = 10;
  for (let i = 0; i < appList.length; i += BATCH_SIZE) {
    const batch = appList.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (app) => {
        const [checksRes, findingsRes, expiryRes, errorsRes, repoRes, hcRes] = await Promise.all([
          supabaseAdmin
            .from("monitoring_checks")
            .select("*")
            .eq("application_id", app.id)
            .gte("checked_at", sevenDaysAgo)
            .order("checked_at", { ascending: false })
            .limit(200),
          supabaseAdmin
            .from("security_findings")
            .select("severity")
            .eq("application_id", app.id)
            .eq("status", "open"),
          supabaseAdmin
            .from("expiry_items")
            .select("category, days_remaining")
            .eq("application_id", app.id),
          supabaseAdmin
            .from("error_groups")
            .select("id", { count: "exact", head: true })
            .eq("application_id", app.id)
            .eq("status", "open"),
          supabaseAdmin
            .from("repo_status")
            .select("last_run_conclusion, tests_present")
            .eq("application_id", app.id)
            .maybeSingle(),
          app.health_check_enabled
            ? supabaseAdmin
                .from("health_check_results")
                .select("status")
                .eq("application_id", app.id)
                .order("checked_at", { ascending: false })
                .limit(1)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        const checks = (checksRes.data || []) as MonitoringCheckRecord[];
        const stats7d = calculateMonitoringStats(checks, "7d");
        const latest = stats7d.latestCheck;

        const findings = (findingsRes.data || []) as Array<{ severity: string }>;
        const expiries = (expiryRes.data || []) as Array<{ category: string; days_remaining: number | null }>;
        const sslItem = expiries.find((e) => e.category === "ssl_certificate");
        const domainItem = expiries.find((e) => e.category === "domain");

        const result = computeHealthScore({
          applicationId: app.id,
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

        await supabaseAdmin
          .from("health_score_snapshots")
          .upsert(
            {
              application_id: app.id,
              user_id: app.user_id,
              score: result.score,
              snapshot_date: today,
            },
            { onConflict: "application_id,snapshot_date" }
          );
        saved++;
      })
    );
  }

  return NextResponse.json({ success: true, snapshotDate: today, saved });
}
