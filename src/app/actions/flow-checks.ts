"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { validateApplicationUrl } from "@/lib/security/url-validator";
import { validateNoSecrets } from "@/lib/security/secret-guard";
import { encryptFlowPassword } from "@/lib/security/flow-check-crypto";

const MAX_FLOW_CHECKS_PER_APP = 2;
const MAX_FLOW_CHECKS_PER_USER = 5;

export interface FlowCheckPublic {
  id: string;
  application_id: string;
  name: string;
  login_url: string;
  content_type: "json" | "form";
  email_field: string;
  password_field: string;
  test_email: string;
  has_password: boolean;
  masked_password: string;
  expected_status: number;
  expected_text: string | null;
  enabled: boolean;
  last_run_at: string | null;
  last_status: "ok" | "failing" | null;
  consecutive_failures: number;
  created_at: string;
  recent_results: Array<{
    id: string;
    ok: boolean;
    status_code: number | null;
    duration_ms: number;
    excerpt: string | null;
    checked_at: string;
  }>;
}

export async function getFlowChecks(applicationId: string): Promise<{
  data?: FlowCheckPublic[];
  error?: string;
}> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured." };

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Unauthorized." };

  const { data: rows, error } = await supabase
    .from("flow_checks")
    .select(
      "id, application_id, name, login_url, content_type, email_field, password_field, test_email, encrypted_password, expected_status, expected_text, enabled, last_run_at, last_status, consecutive_failures, created_at"
    )
    .eq("application_id", applicationId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };

  const checks: FlowCheckPublic[] = [];
  for (const row of rows || []) {
    const { data: results } = await supabase
      .from("flow_check_results")
      .select("id, ok, status_code, duration_ms, excerpt, checked_at")
      .eq("flow_check_id", row.id)
      .eq("user_id", user.id)
      .order("checked_at", { ascending: false })
      .limit(5);

    const hasPwd = Boolean(row.encrypted_password);
    checks.push({
      id: row.id,
      application_id: row.application_id,
      name: row.name,
      login_url: row.login_url,
      content_type: row.content_type as "json" | "form",
      email_field: row.email_field,
      password_field: row.password_field,
      test_email: row.test_email,
      has_password: hasPwd,
      masked_password: hasPwd ? "••••••••" : "(deleted)",
      expected_status: row.expected_status,
      expected_text: row.expected_text,
      enabled: row.enabled,
      last_run_at: row.last_run_at,
      last_status: row.last_status as "ok" | "failing" | null,
      consecutive_failures: row.consecutive_failures,
      created_at: row.created_at,
      recent_results: results || [],
    });
  }

  return { data: checks };
}

export interface CreateFlowCheckInput {
  applicationId: string;
  name: string;
  loginUrl: string;
  contentType: "json" | "form";
  emailField: string;
  passwordField: string;
  testEmail: string;
  password: string;
  expectedStatus: number;
  expectedText?: string;
  confirmThrowaway: boolean;
  confirmAuthorize: boolean;
}

export async function createFlowCheck(input: CreateFlowCheckInput): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Supabase not configured." };
  }

  if (!input.confirmThrowaway || !input.confirmAuthorize) {
    return {
      success: false,
      error: "Both confirmation checkboxes are required.",
    };
  }

  const name = input.name?.trim();
  const loginUrlRaw = input.loginUrl?.trim();
  const emailField = input.emailField?.trim() || "email";
  const passwordField = input.passwordField?.trim() || "password";
  const testEmail = input.testEmail?.trim();
  const expectedText = input.expectedText?.trim() || null;

  if (!name || name.length > 80) {
    return { success: false, error: "Name is required (max 80 characters)." };
  }
  if (!testEmail || testEmail.length > 120) {
    return { success: false, error: "Test email is required." };
  }
  if (!input.password) {
    return { success: false, error: "Test account password is required." };
  }
  if (expectedText && expectedText.length > 100) {
    return {
      success: false,
      error: "Expected response text must be at most 100 characters.",
    };
  }

  // Secret Guard on all non-password fields
  for (const field of [name, loginUrlRaw, emailField, passwordField, testEmail, expectedText]) {
    const guard = validateNoSecrets(field);
    if (!guard.safe) {
      return { success: false, error: guard.error };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: "Unauthorized." };

  // Verify app ownership + Level 2 domain verification
  const { data: app, error: appError } = await supabase
    .from("applications")
    .select("id, url, domain_verified_at")
    .eq("id", input.applicationId)
    .eq("user_id", user.id)
    .single();

  if (appError || !app) {
    return { success: false, error: "Application not found." };
  }
  if (!app.domain_verified_at) {
    return {
      success: false,
      error: "Verify your domain (Level 2) before creating a login flow check.",
    };
  }

  // SSRF validation + same verified domain check
  const urlVal = await validateApplicationUrl(loginUrlRaw);
  if (!urlVal.valid || !urlVal.normalizedUrl) {
    return { success: false, error: urlVal.error || "Invalid login URL." };
  }

  try {
    const appHost = new URL(app.url).hostname.toLowerCase();
    const loginHost = new URL(urlVal.normalizedUrl).hostname.toLowerCase();
    if (appHost !== loginHost) {
      return {
        success: false,
        error: `Login URL must be on your verified domain (${appHost}).`,
      };
    }
  } catch {
    return { success: false, error: "Invalid URL." };
  }

  // Quota checks: 2 per app, 5 per user
  const { count: appCount } = await supabase
    .from("flow_checks")
    .select("*", { count: "exact", head: true })
    .eq("application_id", app.id);

  if ((appCount ?? 0) >= MAX_FLOW_CHECKS_PER_APP) {
    return {
      success: false,
      error: `Maximum ${MAX_FLOW_CHECKS_PER_APP} flow checks per application.`,
    };
  }

  const { count: userCount } = await supabase
    .from("flow_checks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((userCount ?? 0) >= MAX_FLOW_CHECKS_PER_USER) {
    return {
      success: false,
      error: `Maximum ${MAX_FLOW_CHECKS_PER_USER} flow checks per account.`,
    };
  }

  let encrypted;
  try {
    encrypted = encryptFlowPassword(input.password);
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Encryption key is not configured.",
    };
  }

  const { error: insertError } = await supabase.from("flow_checks").insert({
    user_id: user.id,
    application_id: app.id,
    name,
    login_url: urlVal.normalizedUrl,
    content_type: input.contentType === "form" ? "form" : "json",
    email_field: emailField,
    password_field: passwordField,
    test_email: testEmail,
    encrypted_password: encrypted.encryptedPassword,
    iv: encrypted.iv,
    auth_tag: encrypted.authTag,
    expected_status: Number(input.expectedStatus) || 200,
    expected_text: expectedText,
    enabled: true,
  });

  if (insertError) return { success: false, error: insertError.message };

  revalidatePath(`/dashboard/apps/${app.id}/protection`);
  revalidatePath(`/dashboard/applications/${app.id}`);
  return { success: true };
}

export async function replaceFlowCheckPassword(
  flowCheckId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: false, error: "Supabase not configured." };
  if (!newPassword) return { success: false, error: "Password is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized." };

  const encrypted = encryptFlowPassword(newPassword);
  const { error } = await supabase
    .from("flow_checks")
    .update({
      encrypted_password: encrypted.encryptedPassword,
      iv: encrypted.iv,
      auth_tag: encrypted.authTag,
      enabled: true,
    })
    .eq("id", flowCheckId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteFlowCheckCredentials(
  flowCheckId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: false, error: "Supabase not configured." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized." };

  const { error } = await supabase
    .from("flow_checks")
    .update({
      encrypted_password: null,
      iv: null,
      auth_tag: null,
      enabled: false,
    })
    .eq("id", flowCheckId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteFlowCheck(
  flowCheckId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: false, error: "Supabase not configured." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized." };

  const { error } = await supabase
    .from("flow_checks")
    .delete()
    .eq("id", flowCheckId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
