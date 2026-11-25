"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { validateHealthCheckPath } from "@/lib/monitoring/health-check";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Update health check settings for an application */
export async function updateHealthCheckSettings(
  applicationId: string,
  input: { healthCheckPath: string | null; enabled: boolean }
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { success: false, error: "Not configured." };

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: "Unauthorized." };

  if (input.healthCheckPath) {
    const pathValidation = validateHealthCheckPath(input.healthCheckPath);
    if (!pathValidation.valid) {
      return { success: false, error: pathValidation.error };
    }
  }

  const { error } = await supabase
    .from("applications")
    .update({
      health_check_path: input.healthCheckPath || null,
      health_check_enabled: input.enabled,
    })
    .eq("id", applicationId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export interface HealthCheckResultRecord {
  id: string;
  status: string;
  status_code: number | null;
  response_excerpt: string | null;
  error_message: string | null;
  checked_at: string;
}

/** Get recent health check results for an application */
export async function getHealthCheckResults(applicationId: string): Promise<ActionResult<HealthCheckResultRecord[]>> {
  if (!isSupabaseConfigured()) return { success: false, error: "Not configured.", data: [] };

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: "Unauthorized.", data: [] };

  // Verify ownership
  const { data: app } = await supabase
    .from("applications")
    .select("id")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!app) return { success: false, error: "Not found.", data: [] };

  const { data, error } = await supabase
    .from("health_check_results")
    .select("id, status, status_code, response_excerpt, error_message, checked_at")
    .eq("application_id", applicationId)
    .order("checked_at", { ascending: false })
    .limit(50);

  if (error) return { success: false, error: error.message, data: [] };
  return { success: true, data: data || [] };
}

export interface RepoStatusRecord {
  id: string;
  repository_full_name: string | null;
  last_commit_sha: string | null;
  last_run_conclusion: string | null;
  last_run_url: string | null;
  last_deploy_state: string | null;
  last_deploy_url: string | null;
  tests_present: boolean;
  checked_at: string;
}

/** Get repo build/deploy status for an application */
export async function getRepoStatus(applicationId: string): Promise<ActionResult<RepoStatusRecord | null>> {
  if (!isSupabaseConfigured()) return { success: false, error: "Not configured.", data: null };

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: "Unauthorized.", data: null };

  const { data, error } = await supabase
    .from("repo_status")
    .select("id, repository_full_name, last_commit_sha, last_run_conclusion, last_run_url, last_deploy_state, last_deploy_url, tests_present, checked_at")
    .eq("application_id", applicationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return { success: false, error: error.message, data: null };
  return { success: true, data: data || null };
}
