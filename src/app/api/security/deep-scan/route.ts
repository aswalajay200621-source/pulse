import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDeepScan } from "@/lib/security/deep-scan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  const supabase = createAdminClient();
  const { data: apps } = await supabase
    .from("applications")
    .select("id, user_id, url")
    .eq("weekly_deep_scan_enabled", true);

  const results: Array<{ appId: string; status: string }> = [];

  for (const app of apps || []) {
    const { data: ver } = await supabase
      .from("domain_verifications")
      .select("expires_at")
      .eq("application_id", app.id)
      .maybeSingle();

    if (!ver?.expires_at || new Date(ver.expires_at) < new Date()) {
      results.push({ appId: app.id, status: "skipped_unverified" });
      continue;
    }

    const { data: consent } = await supabase
      .from("scan_consents")
      .select("id")
      .eq("application_id", app.id)
      .maybeSingle();

    if (!consent) {
      results.push({ appId: app.id, status: "skipped_no_consent" });
      continue;
    }

    const { data: scanRow } = await supabase
      .from("deep_scans")
      .insert({ application_id: app.id, user_id: app.user_id, status: "running" })
      .select()
      .single();

    if (!scanRow) continue;

    try {
      const scanRes = await runDeepScan(app.url);
      let criticalCount = 0;
      let highCount = 0;
      let mediumCount = 0;
      let lowCount = 0;

      for (const f of scanRes.findings) {
        if (f.severity === "critical") criticalCount++;
        else if (f.severity === "high") highCount++;
        else if (f.severity === "medium") mediumCount++;
        else lowCount++;

        await supabase.from("security_findings").upsert(
          {
            application_id: app.id,
            category: "deep_scan",
            source: "deep_scan",
            severity: f.severity,
            title: f.title,
            description: f.evidence,
            affected_resource: f.affectedUrl,
            rule_id: f.ruleId,
            finding_key: `${app.id}:${f.findingKey}`,
            status: "open",
          },
          { onConflict: "application_id,finding_key" }
        );
      }

      await supabase
        .from("deep_scans")
        .update({
          status: "completed",
          request_count: scanRes.requestCount,
          findings_count: scanRes.findings.length,
          critical_count: criticalCount,
          high_count: highCount,
          medium_count: mediumCount,
          low_count: lowCount,
          completed_at: new Date().toISOString(),
        })
        .eq("id", scanRow.id);

      results.push({ appId: app.id, status: "completed" });
    } catch (err: unknown) {
      await supabase
        .from("deep_scans")
        .update({
          status: "failed",
          error_message: err instanceof Error ? err.message : "Failed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", scanRow.id);
      results.push({ appId: app.id, status: "failed" });
    }
  }

  return NextResponse.json({ success: true, results });
}
