"use server";

import { createClient } from "@/lib/supabase/server";
import type { AlertRecord } from "@/lib/supabase/types";

export async function getAlerts(): Promise<{
  alerts?: AlertRecord[];
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  const { data, error } = await supabase
    .from("alerts")
    .select("id, user_id, application_id, severity, title, description, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return { error: error.message };
  return { alerts: (data || []) as AlertRecord[] };
}

export async function markAlertRead(id: string, isRead: boolean): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { ok: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("alerts")
    .update({ is_read: isRead })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function markAllAlertsRead(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { ok: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("alerts")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
