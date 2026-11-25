"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  generateVerificationToken,
  verifyDomainOwnership,
} from "@/lib/security/deep-scan/domain-verify";
import { runDeepScan } from "@/lib/security/deep-scan";
import type { SecurityFindingRecord } from "@/app/actions/security";

export interface DomainVerificationRecord {
  id: string;
  application_id: string;
  user_id: string;
  token: string;
  method: "well_known" | "dns_txt" | null;
  verified_at: string | null;
  expires_at: string | null;
}

export interface DeepScanAuditRecord {
  id: string;
  application_id: string;
  status: "running" | "completed" | "failed";
  request_count: number;
  findings_count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export async function getDeepScanState(applicationId: string): Promise<{
  verification?: DomainVerificationRecord | null;
  hasConsent?: boolean;
  weeklyEnabled?: boolean;
  scans?: DeepScanAuditRecord[];
  findings?: SecurityFindingRecord[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Unauthorized" };

  const { data: app } = await supabase
    .from("applications")
    .select("id, weekly_deep_scan_enabled")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!app) return { error: "Application not found." };

  const [verRes, consentRes, scansRes, findingsRes] = await Promise.all([
    supabase
      .from("domain_verifications")
      .select("*")
      .eq("application_id", applicationId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("scan_consents")
      .select("id")
      .eq("application_id", applicationId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("deep_scans")
      .select("*")
      .eq("application_id", applicationId)
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(20),
    supabase
      .from("security_findings")
      .select("*")
      .eq("application_id", applicationId)
      .eq("source", "deep_scan")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return {
    verification: (verRes.data as DomainVerificationRecord | null) ?? null,
    hasConsent: !!consentRes.data,
    weeklyEnabled: !!app.weekly_deep_scan_enabled,
    scans: (scansRes.data || []) as DeepScanAuditRecord[],
    findings: (findingsRes.data || []) as SecurityFindingRecord[],
  };
}

export async function initDomainVerification(applicationId: string): Promise<{
  verification?: DomainVerificationRecord;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Unauthorized" };

  const { data: existing } = await supabase
    .from("domain_verifications")
    .select("*")
    .eq("application_id", applicationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return { verification: existing as DomainVerificationRecord };
  }

  const token = generateVerificationToken();
  const { data: created, error } = await supabase
    .from("domain_verifications")
    .insert({
      application_id: applicationId,
      user_id: user.id,
      token,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/applications/${applicationId}`);
  return { verification: created as DomainVerificationRecord };
}

export async function checkDomainVerification(
  applicationId: string,
  method: "well_known" | "dns_txt"
): Promise<{ verified?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Unauthorized" };

  const [{ data: app }, { data: ver }] = await Promise.all([
    supabase
      .from("applications")
      .select("id, url")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("domain_verifications")
      .select("*")
      .eq("application_id", applicationId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!app || !ver) return { error: "Verification record not found." };

  const result = await verifyDomainOwnership(app.url, ver.token, method);
  if (!result.verified) {
    return { verified: false, error: result.error };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await supabase
    .from("domain_verifications")
    .update({
      method,
      verified_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .eq("id", ver.id);

  revalidatePath(`/dashboard/applications/${applicationId}`);
  return { verified: true };
}

export async function recordScanConsent(applicationId: string): Promise<{
  success?: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Unauthorized" };

  const { error } = await supabase.from("scan_consents").upsert(
    {
      user_id: user.id,
      application_id: applicationId,
      consented_at: new Date().toISOString(),
    },
    { onConflict: "user_id,application_id" }
  );

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/applications/${applicationId}`);
  return { success: true };
}

export async function toggleWeeklyDeepScan(
  applicationId: string,
  enabled: boolean
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("applications")
    .update({ weekly_deep_scan_enabled: enabled })
    .eq("id", applicationId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/applications/${applicationId}`);
  return { success: true };
}

export async function triggerDeepScan(applicationId: string): Promise<{
  success?: boolean;
  scanId?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Unauthorized" };

  const { data: app } = await supabase
    .from("applications")
    .select("id, url, name")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!app) return { error: "Application not found." };

  // 1. Enforce domain verification (valid & not expired)
  const { data: ver } = await supabase
    .from("domain_verifications")
    .select("*")
    .eq("application_id", applicationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!ver || !ver.verified_at || !ver.expires_at || new Date(ver.expires_at) < new Date()) {
    return {
      error: "Domain ownership must be verified (and re-verified every 30 days) before running a deep scan.",
    };
  }

  // 2. Enforce owner consent
  const { data: consent } = await supabase
    .from("scan_consents")
    .select("id")
    .eq("application_id", applicationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!consent) {
    return { error: "Owner consent is required before running a deep scan." };
  }

  // 3. Enforce max 1 running scan per application
  const { data: runningScan } = await supabase
    .from("deep_scans")
    .select("id")
    .eq("application_id", applicationId)
    .eq("status", "running")
    .maybeSingle();

  if (runningScan) {
    return { error: "A deep scan is already running for this application." };
  }

  // 4. Enforce max 2 scans per application per day
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: dailyCount } = await supabase
    .from("deep_scans")
    .select("*", { count: "exact", head: true })
    .eq("application_id", applicationId)
    .gte("started_at", oneDayAgo);

  if ((dailyCount ?? 0) >= 2) {
    return { error: "Daily limit reached: maximum 2 deep scans per application per 24 hours." };
  }

  // 5. Create audit log record
  const { data: scanRow, error: scanCreateErr } = await supabase
    .from("deep_scans")
    .insert({
      application_id: applicationId,
      user_id: user.id,
      status: "running",
    })
    .select()
    .single();

  if (scanCreateErr || !scanRow) {
    return { error: scanCreateErr?.message || "Failed to start deep scan." };
  }

  try {
    const result = await runDeepScan(app.url);

    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    for (const f of result.findings) {
      if (f.severity === "critical") criticalCount++;
      else if (f.severity === "high") highCount++;
      else if (f.severity === "medium") mediumCount++;
      else lowCount++;

      const findingKey = `${applicationId}:${f.findingKey}`;
      await supabase.from("security_findings").upsert(
        {
          application_id: applicationId,
          category: "deep_scan",
          source: "deep_scan",
          severity: f.severity,
          title: f.title,
          description: f.evidence,
          affected_resource: f.affectedUrl,
          rule_id: f.ruleId,
          finding_key: findingKey,
          status: "open",
        },
        { onConflict: "application_id,finding_key" }
      );
    }

    await supabase
      .from("deep_scans")
      .update({
        status: "completed",
        request_count: result.requestCount,
        findings_count: result.findings.length,
        critical_count: criticalCount,
        high_count: highCount,
        medium_count: mediumCount,
        low_count: lowCount,
        completed_at: new Date().toISOString(),
      })
      .eq("id", scanRow.id);

    revalidatePath(`/dashboard/applications/${applicationId}`);
    return { success: true, scanId: scanRow.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Deep scan failed.";
    await supabase
      .from("deep_scans")
      .update({
        status: "failed",
        error_message: msg,
        completed_at: new Date().toISOString(),
      })
      .eq("id", scanRow.id);

    return { error: msg };
  }
}
