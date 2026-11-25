"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDeepScan } from "@/lib/security/deep-scan";

export type TesterStatus = "pending" | "approved" | "rejected";
export type RequestStatus = "draft" | "open" | "in_progress" | "paused" | "closed";
export type ReportStatus = "new" | "triaged" | "valid" | "duplicate" | "invalid" | "fixed" | "paid";
export type SeverityLevel = "low" | "medium" | "high" | "critical";

// Simple in-memory rate limiter for report creation and messages (per user)
const rateLimitMap = new Map<string, number[]>();
function checkRateLimit(key: string, maxPerMinute: number): boolean {
  const now = Date.now();
  const windowStart = now - 60_000;
  const timestamps = (rateLimitMap.get(key) || []).filter((t) => t > windowStart);
  if (timestamps.length >= maxPerMinute) return false;
  timestamps.push(now);
  rateLimitMap.set(key, timestamps);
  return true;
}

function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

export async function getTesterProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data } = await supabase
    .from("tester_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return { profile: data, isAdmin: isAdminEmail(user.email) };
}

export async function upsertTesterProfile(input: {
  display_name: string;
  skill_level: "beginner" | "intermediate" | "advanced";
  focus_areas: string[];
  proof_url?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const displayName = input.display_name.trim().slice(0, 80);
  if (!displayName) return { error: "Display name is required." };

  const { data: existing } = await supabase
    .from("tester_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("tester_profiles")
      .update({
        display_name: displayName,
        skill_level: input.skill_level,
        focus_areas: input.focus_areas.slice(0, 10),
        proof_url: input.proof_url?.trim().slice(0, 300) || null,
      })
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("tester_profiles").insert({
      user_id: user.id,
      display_name: displayName,
      skill_level: input.skill_level,
      focus_areas: input.focus_areas.slice(0, 10),
      proof_url: input.proof_url?.trim().slice(0, 300) || null,
      status: "pending",
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard/experts/profile");
  return { success: true };
}

export async function adminSetTesterStatus(
  profileId: string,
  status: "approved" | "rejected"
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return { error: "Forbidden: Admin access required." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("tester_profiles")
    .update({ status })
    .eq("id", profileId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/experts");
  return { success: true };
}

export async function getExpertsDashboardData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const [appsRes, reqsRes, invitesRes, reportsRes, approvedTestersRes] = await Promise.all([
    supabase.from("applications").select("id, name, url").eq("user_id", user.id),
    supabase.from("test_requests").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
    supabase.from("test_invites").select("*, test_requests(id, title, status, scope_urls, focus_areas, rules_text, test_accounts_note, reward_low, reward_medium, reward_high, reward_critical)").eq("tester_id", user.id),
    supabase.from("test_reports").select("*").order("created_at", { ascending: false }),
    supabase.from("tester_profiles").select("user_id, display_name, skill_level, focus_areas").eq("status", "approved"),
  ]);

  return {
    applications: appsRes.data || [],
    myRequests: reqsRes.data || [],
    myInvites: invitesRes.data || [],
    reports: reportsRes.data || [],
    approvedTesters: approvedTestersRes.data || [],
  };
}

export async function createTestRequest(input: {
  application_id: string;
  title: string;
  scope_urls: string[];
  out_of_scope: string;
  focus_areas: string[];
  test_accounts_note: string;
  rules_text: string;
  reward_low: number;
  reward_medium: number;
  reward_high: number;
  reward_critical: number;
  safe_harbor_accepted: boolean;
  openImmediately: boolean;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  if (!input.safe_harbor_accepted) {
    return { error: "You must accept the Safe Harbor terms before creating a test request." };
  }

  // Verify app ownership
  const { data: app } = await supabase
    .from("applications")
    .select("id")
    .eq("id", input.application_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!app) return { error: "Application not found." };

  // Check domain verification
  const { data: ver } = await supabase
    .from("domain_verifications")
    .select("verified_at, expires_at")
    .eq("application_id", input.application_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const isVerified =
    !!ver?.verified_at && !!ver?.expires_at && new Date(ver.expires_at) > new Date();

  if (input.openImmediately && !isVerified) {
    return { error: "Domain ownership must be verified before opening a test request." };
  }

  const { error } = await supabase.from("test_requests").insert({
    application_id: input.application_id,
    owner_id: user.id,
    title: input.title.trim().slice(0, 120),
    scope_urls: input.scope_urls.slice(0, 20),
    out_of_scope: input.out_of_scope.trim().slice(0, 2000),
    focus_areas: input.focus_areas.slice(0, 10),
    test_accounts_note: input.test_accounts_note.trim().slice(0, 2000),
    rules_text: input.rules_text.trim().slice(0, 3000),
    reward_low: Math.max(0, Number(input.reward_low) || 0),
    reward_medium: Math.max(0, Number(input.reward_medium) || 0),
    reward_high: Math.max(0, Number(input.reward_high) || 0),
    reward_critical: Math.max(0, Number(input.reward_critical) || 0),
    safe_harbor_accepted: true,
    status: input.openImmediately ? "open" : "draft",
    ownership_verified_at: isVerified ? ver!.verified_at : null,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/experts");
  return { success: true };
}

export async function updateTestRequestStatus(requestId: string, status: RequestStatus) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  if (status === "open" || status === "in_progress") {
    const { data: req } = await supabase
      .from("test_requests")
      .select("application_id")
      .eq("id", requestId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!req) return { error: "Request not found." };

    const { data: ver } = await supabase
      .from("domain_verifications")
      .select("expires_at")
      .eq("application_id", req.application_id)
      .maybeSingle();
    if (!ver?.expires_at || new Date(ver.expires_at) < new Date()) {
      return { error: "Domain ownership must be verified before opening." };
    }
  }

  const { error } = await supabase
    .from("test_requests")
    .update({ status })
    .eq("id", requestId)
    .eq("owner_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/experts");
  return { success: true };
}

export async function inviteTester(requestId: string, testerId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: req } = await supabase
    .from("test_requests")
    .select("id")
    .eq("id", requestId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!req) return { error: "Request not found." };

  const { error } = await supabase.from("test_invites").upsert(
    { request_id: requestId, tester_id: testerId, status: "invited" },
    { onConflict: "request_id,tester_id" }
  );

  if (error) return { error: error.message };
  revalidatePath("/dashboard/experts");
  return { success: true };
}

export async function respondToInvite(inviteId: string, status: "accepted" | "declined") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("test_invites")
    .update({ status })
    .eq("id", inviteId)
    .eq("tester_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/experts");
  return { success: true };
}

export async function submitTestReport(input: {
  request_id: string;
  title: string;
  severity_claimed: SeverityLevel;
  affected_url: string;
  steps_to_reproduce: string;
  impact: string;
  proof_text: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  if (!checkRateLimit(`report:${user.id}`, 5)) {
    return { error: "Rate limit exceeded. Please wait before submitting another report." };
  }

  // Verify tester accepted invite & request is in_progress (not paused/closed)
  const [{ data: invite }, { data: req }] = await Promise.all([
    supabase
      .from("test_invites")
      .select("status")
      .eq("request_id", input.request_id)
      .eq("tester_id", user.id)
      .maybeSingle(),
    supabase
      .from("test_requests")
      .select("status")
      .eq("id", input.request_id)
      .maybeSingle(),
  ]);

  if (!invite || invite.status !== "accepted") {
    return { error: "You must accept the invitation before submitting a report." };
  }
  if (!req || req.status === "paused") {
    return { error: "This test request is currently paused by the owner." };
  }
  if (req.status !== "in_progress" && req.status !== "open") {
    return { error: "This test request is not accepting reports." };
  }

  const { error } = await supabase.from("test_reports").insert({
    request_id: input.request_id,
    reporter_id: user.id,
    title: input.title.trim().slice(0, 150),
    severity_claimed: input.severity_claimed,
    affected_url: input.affected_url.trim().slice(0, 500),
    steps_to_reproduce: input.steps_to_reproduce.trim().slice(0, 5000),
    impact: input.impact.trim().slice(0, 2000),
    proof_text: input.proof_text.trim().slice(0, 3000),
    status: "new",
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/experts");
  return { success: true };
}

export async function getReportDetail(reportId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: report } = await supabase
    .from("test_reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();
  if (!report) return { error: "Report not found or access denied." };

  const [{ data: req }, { data: messages }] = await Promise.all([
    supabase.from("test_requests").select("*").eq("id", report.request_id).maybeSingle(),
    supabase.from("report_messages").select("*").eq("report_id", reportId).order("created_at", { ascending: true }),
  ]);

  const isOwner = req?.owner_id === user.id;
  const isReporter = report.reporter_id === user.id;
  if (!isOwner && !isReporter) return { error: "Access denied." };

  return { report, request: req, messages: messages || [], isOwner, isReporter };
}

export async function triageTestReport(
  reportId: string,
  input: {
    status: ReportStatus;
    severity_final?: SeverityLevel;
    reward_amount?: number;
    duplicate_of?: string | null;
    owner_note?: string;
    payment_reference?: string;
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: report } = await supabase
    .from("test_reports")
    .select("id, request_id")
    .eq("id", reportId)
    .maybeSingle();
  if (!report) return { error: "Report not found." };

  const { data: req } = await supabase
    .from("test_requests")
    .select("owner_id")
    .eq("id", report.request_id)
    .maybeSingle();
  if (!req || req.owner_id !== user.id) {
    return { error: "Only the request owner can triage reports." };
  }

  if (input.status === "duplicate") {
    if (!input.duplicate_of) {
      return { error: "Duplicate reports must link to an earlier valid report." };
    }
    const { data: orig } = await supabase
      .from("test_reports")
      .select("id")
      .eq("id", input.duplicate_of)
      .eq("request_id", report.request_id)
      .maybeSingle();
    if (!orig) return { error: "Linked original report not found." };
  }

  const { error } = await supabase
    .from("test_reports")
    .update({
      status: input.status,
      severity_final: input.severity_final ?? null,
      reward_amount: input.status === "duplicate" ? 0 : Math.max(0, Number(input.reward_amount) || 0),
      duplicate_of: input.status === "duplicate" ? input.duplicate_of : null,
      owner_note: input.owner_note?.trim().slice(0, 2000) ?? null,
      payment_reference: input.payment_reference?.trim().slice(0, 200) ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reportId);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/experts/reports/${reportId}`);
  return { success: true };
}

export async function confirmRewardReceived(reportId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("test_reports")
    .update({ reward_confirmed_at: new Date().toISOString() })
    .eq("id", reportId)
    .eq("reporter_id", user.id)
    .eq("status", "paid");

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/experts/reports/${reportId}`);
  return { success: true };
}

export async function retestFixedReport(reportId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: report } = await supabase
    .from("test_reports")
    .select("id, affected_url, reporter_id, status")
    .eq("id", reportId)
    .maybeSingle();
  if (!report || report.status !== "fixed") {
    return { error: "Report must be marked fixed before retesting." };
  }

  try {
    const res = await runDeepScan(report.affected_url);
    const summary = `Automated retest ran ${res.requestCount} checks and found ${res.findings.length} open automated issues.`;
    await supabase
      .from("test_reports")
      .update({ retest_status: summary, updated_at: new Date().toISOString() })
      .eq("id", reportId);
    revalidatePath(`/dashboard/experts/reports/${reportId}`);
    return { success: true, summary };
  } catch {
    return { error: "Retest failed to reach target URL." };
  }
}

export async function postReportMessage(reportId: string, body: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  if (!checkRateLimit(`msg:${user.id}`, 15)) {
    return { error: "Rate limit exceeded. Please slow down." };
  }

  const cleanBody = body.trim().slice(0, 2000);
  if (!cleanBody) return { error: "Message cannot be empty." };

  const { error } = await supabase.from("report_messages").insert({
    report_id: reportId,
    sender_id: user.id,
    body: cleanBody,
  });

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/experts/reports/${reportId}`);
  return { success: true };
}
