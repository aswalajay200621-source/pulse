"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { generateStatusSlug } from "@/lib/status-page";

export interface StatusPageSettings {
  id: string;
  application_id: string;
  slug: string;
  enabled: boolean;
  display_title: string;
  allow_indexing: boolean;
}

export async function getStatusPageSettings(applicationId: string): Promise<{
  data?: StatusPageSettings | null;
  error?: string;
}> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured." };

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Unauthorized" };

  const { data, error } = await supabase
    .from("status_pages")
    .select("id, application_id, slug, enabled, display_title, allow_indexing")
    .eq("application_id", applicationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return { error: error.message };
  return { data: (data as StatusPageSettings) || null };
}

export async function updateStatusPageSettings(
  applicationId: string,
  input: { enabled: boolean; displayTitle: string; allowIndexing: boolean }
): Promise<{ data?: StatusPageSettings; error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured." };

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Unauthorized" };

  const { data: app } = await supabase
    .from("applications")
    .select("id, name")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!app) return { error: "Application not found." };

  const displayTitle = (input.displayTitle || app.name).trim().slice(0, 80);
  if (displayTitle.length < 2) {
    return { error: "Display title must be at least 2 characters." };
  }

  const { data: existing } = await supabase
    .from("status_pages")
    .select("id, slug")
    .eq("application_id", applicationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("status_pages")
      .update({
        enabled: Boolean(input.enabled),
        display_title: displayTitle,
        allow_indexing: Boolean(input.allowIndexing),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("user_id", user.id)
      .select("id, application_id, slug, enabled, display_title, allow_indexing")
      .single();

    if (error) return { error: error.message };
    revalidatePath(`/status/${existing.slug}`);
    return { data: data as StatusPageSettings };
  }

  const slug = generateStatusSlug();
  const { data, error } = await supabase
    .from("status_pages")
    .insert({
      application_id: applicationId,
      user_id: user.id,
      slug,
      enabled: Boolean(input.enabled),
      display_title: displayTitle,
      allow_indexing: Boolean(input.allowIndexing),
    })
    .select("id, application_id, slug, enabled, display_title, allow_indexing")
    .single();

  if (error) return { error: error.message };
  return { data: data as StatusPageSettings };
}

export async function rotateStatusPageSlug(applicationId: string): Promise<{
  data?: StatusPageSettings;
  error?: string;
}> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured." };

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Unauthorized" };

  const newSlug = generateStatusSlug();
  const { data, error } = await supabase
    .from("status_pages")
    .update({
      slug: newSlug,
      updated_at: new Date().toISOString(),
    })
    .eq("application_id", applicationId)
    .eq("user_id", user.id)
    .select("id, application_id, slug, enabled, display_title, allow_indexing")
    .single();

  if (error) return { error: error.message };
  return { data: data as StatusPageSettings };
}
