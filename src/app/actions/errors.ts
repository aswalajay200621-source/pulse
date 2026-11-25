"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import crypto from "node:crypto";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface IngestKeyRecord {
  id: string;
  application_id: string;
  key_prefix: string;
  allowed_origins: string[];
  created_at: string;
  revoked_at: string | null;
}

function generateRawKey(): string {
  return "pk_" + crypto.randomBytes(24).toString("hex");
}

function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Create a new ingest key for an application. Returns the full raw key once — never again. */
export async function createIngestKey(input: {
  applicationId: string;
  allowedOrigins?: string[];
}): Promise<ActionResult<{ record: IngestKeyRecord; rawKey: string }>> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Supabase not configured." };
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: "Unauthorized." };

  // Verify ownership
  const { data: app, error: appError } = await supabase
    .from("applications")
    .select("id")
    .eq("id", input.applicationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (appError || !app) return { success: false, error: "Application not found." };

  const rawKey = generateRawKey();
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 6);
  const allowedOrigins = (input.allowedOrigins || []).filter(Boolean).map((o) => o.trim().toLowerCase());

  const supabaseAdmin = createAdminClient();
  const { data: record, error: insertError } = await supabaseAdmin
    .from("ingest_keys")
    .insert({
      application_id: input.applicationId,
      user_id: user.id,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      allowed_origins: allowedOrigins,
    })
    .select("id, application_id, key_prefix, allowed_origins, created_at, revoked_at")
    .single();

  if (insertError || !record) {
    return { success: false, error: insertError?.message || "Failed to create key." };
  }

  return { success: true, data: { record, rawKey } };
}

/** List non-revoked ingest keys for an application */
export async function listIngestKeys(applicationId: string): Promise<ActionResult<IngestKeyRecord[]>> {
  if (!isSupabaseConfigured()) return { success: false, error: "Not configured.", data: [] };

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: "Unauthorized.", data: [] };

  const { data, error } = await supabase
    .from("ingest_keys")
    .select("id, application_id, key_prefix, allowed_origins, created_at, revoked_at")
    .eq("application_id", applicationId)
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message, data: [] };
  return { success: true, data: data || [] };
}

/** Revoke an ingest key */
export async function revokeIngestKey(keyId: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { success: false, error: "Not configured." };

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: "Unauthorized." };

  const { error } = await supabase
    .from("ingest_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** List error groups for an application */
export async function getErrorGroups(applicationId: string): Promise<ActionResult<ErrorGroupRecord[]>> {
  if (!isSupabaseConfigured()) return { success: false, error: "Not configured.", data: [] };

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: "Unauthorized.", data: [] };

  const { data, error } = await supabase
    .from("error_groups")
    .select("id, application_id, fingerprint, title, first_seen, last_seen, count_total, count_24h, status, last_route, severity")
    .eq("application_id", applicationId)
    .eq("user_id", user.id)
    .order("last_seen", { ascending: false })
    .limit(100);

  if (error) return { success: false, error: error.message, data: [] };
  return { success: true, data: data || [] };
}

export interface ErrorGroupRecord {
  id: string;
  application_id: string;
  fingerprint: string;
  title: string;
  first_seen: string;
  last_seen: string;
  count_total: number;
  count_24h: number;
  status: "open" | "resolved" | "ignored";
  last_route: string | null;
  severity: "critical" | "high" | "medium" | "low";
}

export interface ErrorEventRecord {
  id: string;
  group_id: string;
  occurred_at: string;
  route: string | null;
  user_agent_family: string | null;
  release: string | null;
  stack_excerpt: string | null;
}

/** List recent events for an error group */
export async function getErrorEvents(groupId: string): Promise<ActionResult<ErrorEventRecord[]>> {
  if (!isSupabaseConfigured()) return { success: false, error: "Not configured.", data: [] };

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: "Unauthorized.", data: [] };

  // Verify ownership via the group's user_id
  const { data: group } = await supabase
    .from("error_groups")
    .select("id")
    .eq("id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!group) return { success: false, error: "Not found.", data: [] };

  const { data, error } = await supabase
    .from("error_events")
    .select("id, group_id, occurred_at, route, user_agent_family, release, stack_excerpt")
    .eq("group_id", groupId)
    .order("occurred_at", { ascending: false })
    .limit(20);

  if (error) return { success: false, error: error.message, data: [] };
  return { success: true, data: data || [] };
}

/** Update error group status */
export async function updateErrorGroupStatus(
  groupId: string,
  status: "open" | "resolved" | "ignored"
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { success: false, error: "Not configured." };

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: "Unauthorized." };

  const { error } = await supabase
    .from("error_groups")
    .update({ status })
    .eq("id", groupId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Get open error count for an application */
export async function getOpenErrorCount(applicationId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from("error_groups")
    .select("*", { count: "exact", head: true })
    .eq("application_id", applicationId)
    .eq("user_id", user.id)
    .eq("status", "open");

  return count || 0;
}
