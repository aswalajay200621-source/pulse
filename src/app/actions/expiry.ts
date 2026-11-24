"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  computeExpiryStatus,
  determineReminderThreshold,
  inspectDomainRdap,
  inspectTlsCertificate,
} from "@/lib/expiry/checker";
import type {
  ApplicationRecord,
  ExpiryCategory,
  ExpiryItemRecord,
} from "@/lib/supabase/types";

export async function getExpiryOverviewData(): Promise<{
  items?: ExpiryItemRecord[];
  applications?: ApplicationRecord[];
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

  const [itemsRes, appsRes] = await Promise.all([
    supabase
      .from("expiry_items")
      .select("*")
      .eq("user_id", user.id)
      .order("days_remaining", { ascending: true, nullsFirst: false }),
    supabase
      .from("applications")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
  ]);

  if (itemsRes.error) return { error: itemsRes.error.message };
  if (appsRes.error) return { error: appsRes.error.message };

  return {
    items: (itemsRes.data || []) as ExpiryItemRecord[],
    applications: (appsRes.data || []) as ApplicationRecord[],
  };
}

export async function createCredentialReminder(input: {
  name: string;
  category: ExpiryCategory;
  application_id: string | null;
  expiry_date: string;
  description?: string;
}): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { error: "Unauthorized" };

  if (!input.name.trim()) return { error: "Credential name is required." };
  if (!input.expiry_date) return { error: "Expiry date is required." };

  const expiryIso = new Date(input.expiry_date).toISOString();
  const { status, daysRemaining } = computeExpiryStatus(expiryIso);

  const { data: inserted, error } = await supabase
    .from("expiry_items")
    .insert({
      user_id: user.id,
      application_id: input.application_id || null,
      category: input.category,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      expiry_date: expiryIso,
      status,
      days_remaining: daysRemaining,
      source: "manual",
      last_checked_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return { error: error.message };

  if (inserted) {
    await maybeRecordReminder(supabase, user.id, inserted as ExpiryItemRecord);
  }

  revalidatePath("/dashboard/expiry");
  return { success: true };
}

export async function updateCredentialReminder(
  id: string,
  input: {
    name: string;
    category: ExpiryCategory;
    application_id: string | null;
    expiry_date: string;
    description?: string;
  }
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { error: "Unauthorized" };

  const expiryIso = new Date(input.expiry_date).toISOString();
  const { status, daysRemaining } = computeExpiryStatus(expiryIso);

  const { data: updated, error } = await supabase
    .from("expiry_items")
    .update({
      name: input.name.trim(),
      category: input.category,
      application_id: input.application_id || null,
      description: input.description?.trim() || null,
      expiry_date: expiryIso,
      status,
      days_remaining: daysRemaining,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return { error: error.message };

  if (updated) {
    await maybeRecordReminder(supabase, user.id, updated as ExpiryItemRecord);
  }

  revalidatePath("/dashboard/expiry");
  return { success: true };
}

export async function deleteExpiryItem(id: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("expiry_items")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/expiry");
  return { success: true };
}

export async function scanApplicationExpiries(): Promise<{
  scannedCount?: number;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { error: "Unauthorized" };

  const { data: apps, error: appsError } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", user.id);

  if (appsError) return { error: appsError.message };

  const applications = (apps || []) as ApplicationRecord[];
  let scannedCount = 0;

  for (const app of applications) {
    const [tlsRes, rdapRes] = await Promise.all([
      inspectTlsCertificate(app.url),
      inspectDomainRdap(app.url),
    ]);

    const nowIso = new Date().toISOString();

    // Upsert SSL Certificate item
    await upsertAutoExpiryItem(supabase, user.id, app, {
      category: "ssl_certificate",
      name: `${app.name} TLS Certificate`,
      source: "tls_handshake",
      result: tlsRes,
      checkedAt: nowIso,
    });

    // Upsert Domain RDAP item
    await upsertAutoExpiryItem(supabase, user.id, app, {
      category: "domain",
      name: `${app.name} Domain Registration`,
      source: "rdap",
      result: rdapRes,
      checkedAt: nowIso,
    });

    scannedCount++;
  }

  revalidatePath("/dashboard/expiry");
  return { scannedCount };
}

async function upsertAutoExpiryItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  app: ApplicationRecord,
  params: {
    category: "ssl_certificate" | "domain";
    name: string;
    source: "tls_handshake" | "rdap";
    result: Awaited<ReturnType<typeof inspectTlsCertificate>>;
    checkedAt: string;
  }
) {
  const { data: existing } = await supabase
    .from("expiry_items")
    .select("id")
    .eq("user_id", userId)
    .eq("application_id", app.id)
    .eq("category", params.category)
    .maybeSingle();

  const payload = {
    user_id: userId,
    application_id: app.id,
    category: params.category,
    name: params.name,
    target_host: app.url,
    issuer: params.result.issuer,
    expiry_date: params.result.expiryDate,
    status: params.result.status,
    days_remaining: params.result.daysRemaining,
    source: params.source,
    error_message: params.result.errorMessage,
    last_checked_at: params.checkedAt,
    updated_at: params.checkedAt,
  };

  let saved: ExpiryItemRecord | null = null;
  if (existing) {
    const { data } = await supabase
      .from("expiry_items")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();
    saved = data as ExpiryItemRecord | null;
  } else {
    const { data } = await supabase
      .from("expiry_items")
      .insert(payload)
      .select()
      .single();
    saved = data as ExpiryItemRecord | null;
  }

  if (saved) {
    await maybeRecordReminder(supabase, userId, saved);
  }
}

async function maybeRecordReminder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  item: ExpiryItemRecord
) {
  if (!item.expiry_date) return;
  const threshold = determineReminderThreshold(item.days_remaining);
  if (!threshold) return;

  // Unique constraint (expiry_item_id, threshold, expiry_date_snapshot) prevents duplicates
  // while automatically allowing new reminders if expiry_date changes.
  const { error } = await supabase.from("expiry_reminders").insert({
    expiry_item_id: item.id,
    user_id: userId,
    threshold,
    expiry_date_snapshot: item.expiry_date,
  });

  if (!error && item.application_id) {
    await supabase.from("alerts").insert({
      user_id: userId,
      application_id: item.application_id,
      severity: threshold === "expired" || threshold === "1d" ? "critical" : "medium",
      title: `${item.name} ${threshold === "expired" ? "has expired" : `expires in ${threshold}`}`,
      description: `Expiry date: ${new Date(item.expiry_date).toLocaleDateString()}.`,
    });
  }
}
