import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { scanRepository } from "@/lib/security/repo-scanner";
import { checkSecurityHeaders } from "@/lib/security/header-checker";
import type { ApplicationRecord, GithubRepositoryRecord } from "@/lib/supabase/types";

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

  let applicationId: string | undefined;
  let scanType: "manual" | "scheduled" | "triggered" = "manual";
  let customIdempotencyKey: string | undefined;

  try {
    const body = await request.json();
    applicationId = body.applicationId;
    scanType = body.scanType || "manual";
    customIdempotencyKey = body.idempotencyKey;
  } catch {
    // empty body is allowed for scheduled scans
  }

  const supabase = createAdminClient();

  // Fetch applications to scan
  let appsQuery = supabase
    .from("applications")
    .select("*")
    .eq("monitoring_enabled", true);

  if (applicationId) {
    appsQuery = appsQuery.eq("id", applicationId);
  }

  const { data: apps, error: appsError } = await appsQuery;
  if (appsError) {
    return NextResponse.json({ error: appsError.message }, { status: 500 });
  }
  if (!apps?.length) {
    return NextResponse.json({ ok: true, scanned: 0, message: "No applications to scan" });
  }

  const results: Array<{ appId: string; scanId: string; status: string }> = [];

  for (const app of apps as ApplicationRecord[]) {
    // Idempotency: prevent duplicate scans for same app within 1 hour
    const idempotencyKey = customIdempotencyKey || `scan-${app.id}-${Math.floor(Date.now() / 3_600_000)}`;

    const { data: existing } = await supabase
      .from("security_scans")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing) {
      results.push({ appId: app.id, scanId: existing.id, status: "skipped_duplicate" });
      continue;
    }

    // Create scan record
    const { data: scan, error: scanCreateError } = await supabase
      .from("security_scans")
      .insert({
        application_id: app.id,
        user_id: app.user_id,
        scan_status: "in_progress",
        scan_type: scanType,
        idempotency_key: idempotencyKey,
      })
      .select()
      .single();

    if (scanCreateError || !scan) {
      results.push({ appId: app.id, scanId: "", status: "failed_to_create" });
      continue;
    }

    const scanStart = Date.now();
    let criticalCount = 0, highCount = 0, mediumCount = 0, lowCount = 0;
    let findingsCount = 0;

    try {
      // 1. Security header check (always, SSRF-safe)
      const { findings: headerFindings, errorMessage: headerError } = await checkSecurityHeaders(app.url);

      for (const hf of headerFindings) {
        const findingKey = `${app.id}:${hf.findingKey}`;

        const { data: existingFinding } = await supabase
          .from("security_findings")
          .select("id, status, is_new")
          .eq("application_id", app.id)
          .eq("finding_key", findingKey)
          .maybeSingle();

        const isRecurring = !!existingFinding && existingFinding.status !== "resolved";
        const isNew = !existingFinding;

        if (existingFinding) {
          await supabase
            .from("security_findings")
            .update({
              scan_id: scan.id,
              scan_id_new: scan.id,
              status: existingFinding.status === "ignored" ? "ignored" : "open",
              is_new: false,
              is_recurring: isRecurring,
            })
            .eq("id", existingFinding.id);
        } else {
          await supabase.from("security_findings").insert({
            scan_id: scan.id,
            scan_id_new: scan.id,
            application_id: app.id,
            category: "security_header",
            source: "header_check",
            severity: hf.severity,
            title: hf.title,
            description: hf.description,
            affected_resource: hf.actual,
            finding_key: findingKey,
            remediation: hf.remediation,
            status: "open",
            is_new: isNew,
            is_recurring: isRecurring,
          });
        }

        if (isNew || isRecurring) {
          if (hf.severity === "critical") criticalCount++;
          else if (hf.severity === "high") highCount++;
          else if (hf.severity === "medium") mediumCount++;
          else lowCount++;
          findingsCount++;
        }
      }

      if (headerError) {
        console.error(`[Scan] Header check error for ${app.url}: ${headerError}`);
      }

      // 2. Repository scan: secrets + dependencies (only if repo is linked)
      const { data: repo } = await supabase
        .from("github_repositories")
        .select("*")
        .eq("application_id", app.id)
        .maybeSingle();

      if (repo) {
        const repoRecord = repo as GithubRepositoryRecord;

        const scanResult = await scanRepository(
          repoRecord.installation_id,
          repoRecord.owner_login,
          repoRecord.name,
          repoRecord.default_branch
        );

        // Persist secret findings
        for (const sf of scanResult.secretFindings) {
          const findingKey = `${app.id}:${sf.findingKey}`;
          const { data: existing } = await supabase
            .from("security_findings")
            .select("id, status")
            .eq("application_id", app.id)
            .eq("finding_key", findingKey)
            .maybeSingle();

          if (!existing) {
            await supabase.from("security_findings").insert({
              scan_id: scan.id,
              scan_id_new: scan.id,
              application_id: app.id,
              repository_id: repoRecord.id,
              category: "secret_exposure",
              source: "secret_scan",
              severity: sf.confidence === "high" ? "critical" : sf.confidence === "medium" ? "high" : "medium",
              title: `Potential Secret: ${sf.ruleName}`,
              description: sf.description,
              file_path: sf.filePath,
              line_number: sf.lineNumber,
              masked_secret: sf.maskedSecret,
              rule_id: sf.ruleId,
              affected_resource: `${sf.filePath}:${sf.lineNumber}`,
              finding_key: findingKey,
              remediation: sf.remediation,
              status: "open",
              is_new: true,
            });
            criticalCount++;
            findingsCount++;
          }
        }

        // Persist dependency findings
        for (const df of scanResult.dependencyFindings) {
          const findingKey = `${app.id}:${df.findingKey}`;
          const { data: existing } = await supabase
            .from("security_findings")
            .select("id, status")
            .eq("application_id", app.id)
            .eq("finding_key", findingKey)
            .maybeSingle();

          if (!existing) {
            const sev = df.vulnerability.severity ?? "medium";
            await supabase.from("security_findings").insert({
              scan_id: scan.id,
              scan_id_new: scan.id,
              application_id: app.id,
              repository_id: repoRecord.id,
              category: "vulnerable_dependency",
              source: "dependency_scan",
              severity: sev,
              title: `${df.packageName}@${df.installedVersion} — ${df.vulnerability.id}`,
              description: df.vulnerability.summary || `Vulnerability ${df.vulnerability.id} found in ${df.packageName}@${df.installedVersion}.`,
              package_name: df.packageName,
              installed_version: df.installedVersion,
              fixed_version: df.vulnerability.fixedVersion,
              vuln_id: df.vulnerability.id,
              file_path: df.manifestFile,
              affected_resource: df.manifestFile,
              finding_key: findingKey,
              remediation: df.vulnerability.fixedVersion
                ? `Update ${df.packageName} to version ${df.vulnerability.fixedVersion} or later.`
                : `Check ${df.vulnerability.reference || "https://osv.dev"} for remediation guidance.`,
              status: "open",
              is_new: true,
            });
            if (sev === "critical") criticalCount++;
            else if (sev === "high") highCount++;
            else if (sev === "medium") mediumCount++;
            else lowCount++;
            findingsCount++;
          }
        }
      }

      const duration = Date.now() - scanStart;

      await supabase
        .from("security_scans")
        .update({
          scan_status: "completed",
          scanned_at: new Date().toISOString(),
          duration_ms: duration,
          findings_count: findingsCount,
          critical_count: criticalCount,
          high_count: highCount,
          medium_count: mediumCount,
          low_count: lowCount,
        })
        .eq("id", scan.id);

      // Create alert if critical/high findings
      if (criticalCount + highCount > 0) {
        await supabase.from("alerts").insert({
          user_id: app.user_id,
          application_id: app.id,
          severity: criticalCount > 0 ? "critical" : "high",
          title: `Security scan found ${findingsCount} issues in ${app.name}`,
          description: `${criticalCount} critical, ${highCount} high, ${mediumCount} medium, ${lowCount} low severity findings.`,
        });
      }

      results.push({ appId: app.id, scanId: scan.id, status: "completed" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown scan error";
      await supabase
        .from("security_scans")
        .update({ scan_status: "failed", error_message: msg })
        .eq("id", scan.id);
      results.push({ appId: app.id, scanId: scan.id, status: "failed" });
    }
  }

  return NextResponse.json({ success: true, results });
}
