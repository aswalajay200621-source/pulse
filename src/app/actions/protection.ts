"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  computeProtectionLevels,
  type ProtectionLevelInfo,
} from "@/lib/protection-levels";

export interface ProtectionLevelsResponse {
  applicationId: string;
  applicationName: string;
  applicationUrl: string;
  domainVerified: boolean;
  levels: ProtectionLevelInfo[];
  connectedCount: number;
}

export async function getProtectionLevels(applicationId: string): Promise<{
  data?: ProtectionLevelsResponse;
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

  if (authError || !user) {
    return { error: "Unauthorized." };
  }

  const { data: app, error: appError } = await supabase
    .from("applications")
    .select(
      "id, user_id, name, url, status, domain_verified_at, health_check_enabled, health_check_path, github_repository_url"
    )
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .single();

  if (appError || !app) {
    return { error: "Application not found." };
  }

  // Latest health check result (if any)
  let lastHealthCheckOk: boolean | null = null;
  let lastHealthCheckAt: string | null = null;
  if (app.health_check_enabled && app.health_check_path) {
    const { data: hcRows } = await supabase
      .from("health_check_results")
      .select("ok, checked_at")
      .eq("application_id", app.id)
      .order("checked_at", { ascending: false })
      .limit(1);
    if (hcRows && hcRows.length > 0) {
      lastHealthCheckOk = Boolean(hcRows[0].ok);
      lastHealthCheckAt = hcRows[0].checked_at;
    }
  }

  // Active ingest keys + latest error event
  const { count: activeKeyCount } = await supabase
    .from("error_ingest_keys")
    .select("*", { count: "exact", head: true })
    .eq("application_id", app.id)
    .eq("revoked", false);

  let lastErrorEventAt: string | null = null;
  if ((activeKeyCount ?? 0) > 0) {
    const { data: errGroups } = await supabase
      .from("error_groups")
      .select("last_seen_at")
      .eq("application_id", app.id)
      .order("last_seen_at", { ascending: false })
      .limit(1);
    if (errGroups && errGroups.length > 0) {
      lastErrorEventAt = errGroups[0].last_seen_at;
    }
  }

  // GitHub repository link
  const { count: ghCount } = await supabase
    .from("github_repositories")
    .select("*", { count: "exact", head: true })
    .eq("application_id", app.id);

  const hasGithubRepo = Boolean(app.github_repository_url) || (ghCount ?? 0) > 0;

  // Level 6: Flow checks
  const { data: flowRows } = await supabase
    .from("flow_checks")
    .select("id, enabled, last_status")
    .eq("application_id", app.id)
    .eq("enabled", true);

  const hasActiveFlowCheck = (flowRows?.length ?? 0) > 0;
  const flowCheckFailing = Boolean(
    flowRows?.some((r) => r.last_status === "failing")
  );

  const { levels, connectedCount } = computeProtectionLevels({
    hasUrl: Boolean(app.url),
    appStatus: app.status,
    domainVerifiedAt: app.domain_verified_at,
    healthCheckEnabled: Boolean(app.health_check_enabled),
    healthCheckPath: app.health_check_path,
    lastHealthCheckOk,
    lastHealthCheckAt,
    hasActiveIngestKey: (activeKeyCount ?? 0) > 0,
    lastErrorEventAt,
    hasGithubRepo,
    hasActiveFlowCheck,
    flowCheckFailing,
  });

  return {
    data: {
      applicationId: app.id,
      applicationName: app.name,
      applicationUrl: app.url,
      domainVerified: Boolean(app.domain_verified_at),
      levels,
      connectedCount,
    },
  };
}
