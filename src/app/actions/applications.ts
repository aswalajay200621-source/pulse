"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { validateApplicationUrl } from "@/lib/security/url-validator";
import { ApplicationRecord } from "@/lib/supabase/types";
import { revalidatePath } from "next/cache";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  limitReached?: boolean;
}

const MAX_APPLICATIONS_PER_USER = 3;

/**
 * Retrieves all applications for the authenticated user.
 */
export async function getApplications(): Promise<ActionResult<ApplicationRecord[]>> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: "Supabase credentials are not configured.",
      data: [],
    };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized access.", data: [] };
    }

    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message, data: [] };
    }

    return { success: true, data: data || [] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch applications.";
    return { success: false, error: message, data: [] };
  }
}

/**
 * Retrieves a single application by ID for the authenticated user.
 */
export async function getApplicationById(id: string): Promise<ActionResult<ApplicationRecord>> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Supabase credentials are not configured." };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized access." };
    }

    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      return { success: false, error: "Application not found or unauthorized." };
    }

    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load application.";
    return { success: false, error: message };
  }
}

/**
 * Creates a new application with SSRF validation and a strict 3-application limit.
 */
export async function createApplication(input: {
  name: string;
  url: string;
  description?: string;
  github_repository_url?: string;
}): Promise<ActionResult<ApplicationRecord>> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: "Supabase credentials are not configured. Please add them to .env.local.",
    };
  }

  const name = input.name?.trim();
  const rawUrl = input.url?.trim();
  const description = input.description?.trim() || null;
  const githubRepo = input.github_repository_url?.trim() || null;

  if (!name || name.length < 2) {
    return { success: false, error: "Application name must be at least 2 characters." };
  }

  // 1. SSRF & URL Security Validation
  const urlValidation = await validateApplicationUrl(rawUrl);
  if (!urlValidation.valid || !urlValidation.normalizedUrl) {
    return {
      success: false,
      error: urlValidation.error || "Invalid or restricted URL.",
    };
  }

  // Optional GitHub repository URL validation
  if (githubRepo) {
    try {
      const parsedGithub = new URL(
        githubRepo.startsWith("http") ? githubRepo : `https://${githubRepo}`
      );
      if (!parsedGithub.hostname.includes("github.com")) {
        return { success: false, error: "GitHub repository URL must point to github.com." };
      }
    } catch {
      return { success: false, error: "Invalid GitHub repository URL format." };
    }
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized. Please sign in." };
    }

    // 2. Server-side check for 3-application limit
    const { count, error: countError } = await supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (countError) {
      return { success: false, error: "Failed to verify application quota." };
    }

    if (count !== null && count >= MAX_APPLICATIONS_PER_USER) {
      return {
        success: false,
        limitReached: true,
        error: `Account limit reached: A maximum of ${MAX_APPLICATIONS_PER_USER} applications are allowed.`,
      };
    }

    // 3. Database insert (protected additionally by database trigger)
    const { data, error } = await supabase
      .from("applications")
      .insert({
        user_id: user.id,
        name,
        url: urlValidation.normalizedUrl,
        description,
        github_repository_url: githubRepo,
        monitoring_enabled: true,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/applications");

    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create application.";
    return { success: false, error: message };
  }
}

/**
 * Updates an existing application owned by the user.
 */
export async function updateApplication(
  id: string,
  input: {
    name?: string;
    url?: string;
    description?: string | null;
    github_repository_url?: string | null;
    monitoring_enabled?: boolean;
  }
): Promise<ActionResult<ApplicationRecord>> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Supabase credentials are not configured." };
  }

  const updatePayload: Partial<ApplicationRecord> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) {
    const trimmedName = input.name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      return { success: false, error: "Application name must be at least 2 characters." };
    }
    updatePayload.name = trimmedName;
  }

  if (input.url !== undefined) {
    const urlValidation = await validateApplicationUrl(input.url);
    if (!urlValidation.valid || !urlValidation.normalizedUrl) {
      return { success: false, error: urlValidation.error || "Invalid or restricted URL." };
    }
    updatePayload.url = urlValidation.normalizedUrl;
  }

  if (input.description !== undefined) {
    updatePayload.description = input.description ? input.description.trim() : null;
  }

  if (input.github_repository_url !== undefined) {
    if (input.github_repository_url) {
      const trimmed = input.github_repository_url.trim();
      try {
        const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
        if (!parsed.hostname.includes("github.com")) {
          return { success: false, error: "GitHub repository URL must point to github.com." };
        }
        updatePayload.github_repository_url = parsed.toString();
      } catch {
        return { success: false, error: "Invalid GitHub repository URL format." };
      }
    } else {
      updatePayload.github_repository_url = null;
    }
  }

  if (input.monitoring_enabled !== undefined) {
    updatePayload.monitoring_enabled = Boolean(input.monitoring_enabled);
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized." };
    }

    const { data, error } = await supabase
      .from("applications")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/applications");
    revalidatePath(`/dashboard/applications/${id}`);

    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update application.";
    return { success: false, error: message };
  }
}

/**
 * Deletes an application owned by the user.
 */
export async function deleteApplication(id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Supabase credentials are not configured." };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized." };
    }

    const { error } = await supabase
      .from("applications")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/applications");

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete application.";
    return { success: false, error: message };
  }
}
