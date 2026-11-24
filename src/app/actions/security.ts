"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ApplicationRecord } from "@/lib/supabase/types";

export interface SecurityScanRecord {
  id: string;
  application_id: string;
  user_id: string | null;
  scan_status: "completed" | "in_progress" | "failed";
  scan_type: "manual" | "scheduled" | "triggered";
  scanned_at: string;
  duration_ms: number | null;
  findings_count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  error_message: string | null;
}

export interface SecurityFindingRecord {
  id: string;
  scan_id: string | null;
  application_id: string;
  repository_id: string | null;
  category: string;
  source: "secret_scan" | "dependency_scan" | "header_check";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  file_path: string | null;
  line_number: number | null;
  package_name: string | null;
  installed_version: string | null;
  fixed_version: string | null;
  vuln_id: string | null;
  masked_secret: string | null;
  rule_id: string | null;
  affected_resource: string | null;
  remediation: string | null;
  finding_key: string | null;
  status: "open" | "resolved" | "ignored";
  ignore_reason: string | null;
  first_seen_at: string;
  resolved_at: string | null;
  is_new: boolean;
  is_recurring: boolean;
  created_at: string;
}

export async function getSecurityDashboardData(): Promise<{
  applications?: ApplicationRecord[];
  scans?: SecurityScanRecord[];
  findings?: SecurityFindingRecord[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Unauthorized" };

  const { data: apps, error: appsError } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", user.id);
  if (appsError) return { error: appsError.message };

  const appIds = (apps || []).map((a: ApplicationRecord) => a.id);
  if (appIds.length === 0) return { applications: [], scans: [], findings: [] };

  const [scansRes, findingsRes] = await Promise.all([
    supabase
      .from("security_scans")
      .select("*")
      .in("application_id", appIds)
      .order("scanned_at", { ascending: false })
      .limit(50),
    supabase
      .from("security_findings")
      .select("*")
      .in("application_id", appIds)
      .neq("status", "ignored")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  return {
    applications: (apps || []) as ApplicationRecord[],
    scans: (scansRes.data || []) as SecurityScanRecord[],
    findings: (findingsRes.data || []) as SecurityFindingRecord[],
  };
}

export async function triggerManualScan(applicationId: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Unauthorized" };

  // Verify ownership
  const { data: app } = await supabase
    .from("applications")
    .select("id")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!app) return { error: "Application not found or access denied." };

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return { error: "Scan service is not configured. CRON_SECRET is missing." };

  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/security/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cronSecret}`,
    },
    body: JSON.stringify({
      applicationId,
      scanType: "manual",
      idempotencyKey: `manual-${applicationId}-${Date.now()}`,
    }),
  });

  if (!res.ok) {
    return { error: `Scan service returned HTTP ${res.status}.` };
  }

  revalidatePath("/dashboard/security");
  return { success: true };
}

export async function updateFindingStatus(
  findingId: string,
  status: "resolved" | "ignored",
  ignoreReason?: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Unauthorized" };

  const updatePayload: Record<string, unknown> = { status };
  if (status === "resolved") updatePayload.resolved_at = new Date().toISOString();
  if (status === "ignored" && ignoreReason) updatePayload.ignore_reason = ignoreReason;

  const { error } = await supabase
    .from("security_findings")
    .update(updatePayload)
    .eq("id", findingId)
    .in("application_id",
      supabase.from("applications").select("id").eq("user_id", user.id) as unknown as string[]
    );

  if (error) return { error: error.message };
  revalidatePath("/dashboard/security");
  return { success: true };
}
