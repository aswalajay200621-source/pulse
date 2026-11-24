"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  isGitHubAppConfigured,
  getInstallationAccessToken,
  listInstallationRepositories,
} from "@/lib/github/app";
import {
  GithubInstallationRecord,
  GithubRepositoryRecord,
} from "@/lib/supabase/types";
import { revalidatePath } from "next/cache";

export interface GitHubStatusResult {
  connected: boolean;
  configured: boolean;
  installation: GithubInstallationRecord | null;
  repositoriesCount: number;
  error?: string;
}

/**
 * Returns the current authenticated user's GitHub App installation status.
 */
export async function getGitHubInstallationStatus(): Promise<GitHubStatusResult> {
  const configured = isGitHubAppConfigured();

  if (!isSupabaseConfigured()) {
    return {
      connected: false,
      configured,
      installation: null,
      repositoriesCount: 0,
      error: "Supabase is not configured.",
    };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        connected: false,
        configured,
        installation: null,
        repositoriesCount: 0,
        error: "Unauthorized.",
      };
    }

    const { data: installation, error } = await supabase
      .from("github_installations")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !installation) {
      return {
        connected: false,
        configured,
        installation: null,
        repositoriesCount: 0,
      };
    }

    const { count } = await supabase
      .from("github_repositories")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    return {
      connected: true,
      configured,
      installation,
      repositoriesCount: count || 0,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch GitHub status.";
    return {
      connected: false,
      configured,
      installation: null,
      repositoriesCount: 0,
      error: message,
    };
  }
}

/**
 * Lists all repositories authorized for the authenticated user's GitHub installation.
 */
export async function getConnectedRepositories(): Promise<{
  success: boolean;
  data: GithubRepositoryRecord[];
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { success: false, data: [], error: "Supabase is not configured." };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, data: [], error: "Unauthorized." };
    }

    const { data, error } = await supabase
      .from("github_repositories")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (error) {
      return { success: false, data: [], error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load repositories.";
    return { success: false, data: [], error: message };
  }
}

/**
 * On-demand refresh/synchronization of accessible repositories from the GitHub API.
 */
export async function syncGitHubRepositories(installationId: number): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  if (!isGitHubAppConfigured()) {
    return { success: false, count: 0, error: "GitHub App is not configured." };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, count: 0, error: "Unauthorized." };
    }

    // Verify ownership of the installation
    const { data: inst } = await supabase
      .from("github_installations")
      .select("id")
      .eq("installation_id", installationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!inst) {
      return { success: false, count: 0, error: "Unauthorized installation." };
    }

    // Fetch fresh repositories with short-lived token
    const tokenData = await getInstallationAccessToken(installationId);
    const repos = await listInstallationRepositories(tokenData.token);

    if (repos && repos.length > 0) {
      const repoRows = repos.map((repo) => ({
        installation_id: installationId,
        user_id: user.id,
        repo_id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        owner_login: repo.owner.login,
        default_branch: repo.default_branch || "main",
        is_private: repo.private,
        html_url: repo.html_url,
        last_synchronized_at: new Date().toISOString(),
      }));

      await supabase
        .from("github_repositories")
        .upsert(repoRows, { onConflict: "installation_id,repo_id" });
    }

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/applications");

    return { success: true, count: repos.length };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Sync failed.";
    return { success: false, count: 0, error: message };
  }
}

/**
 * Associates or dissociates a GitHub repository with a Pulse application.
 */
export async function associateRepositoryWithApplication(
  repositoryId: string,
  applicationId: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized." };
    }

    // 1. Verify user owns this repository record
    const { data: repo, error: repoFetchError } = await supabase
      .from("github_repositories")
      .select("*")
      .eq("id", repositoryId)
      .eq("user_id", user.id)
      .single();

    if (repoFetchError || !repo) {
      return { success: false, error: "Repository not found or access denied." };
    }

    // 2. If linking to an application, verify user owns the application
    if (applicationId) {
      const { data: app, error: appFetchError } = await supabase
        .from("applications")
        .select("id")
        .eq("id", applicationId)
        .eq("user_id", user.id)
        .single();

      if (appFetchError || !app) {
        return { success: false, error: "Target application not found or access denied." };
      }

      // Clear any prior repo linked to this application
      await supabase
        .from("github_repositories")
        .update({ application_id: null })
        .eq("application_id", applicationId)
        .eq("user_id", user.id);

      // Link new repo
      await supabase
        .from("github_repositories")
        .update({ application_id: applicationId })
        .eq("id", repositoryId)
        .eq("user_id", user.id);

      // Also mirror repository URL in applications table
      await supabase
        .from("applications")
        .update({ github_repository_url: repo.html_url })
        .eq("id", applicationId)
        .eq("user_id", user.id);
    } else {
      // Dissociate
      const currentAppId = repo.application_id;

      await supabase
        .from("github_repositories")
        .update({ application_id: null })
        .eq("id", repositoryId)
        .eq("user_id", user.id);

      if (currentAppId) {
        await supabase
          .from("applications")
          .update({ github_repository_url: null })
          .eq("id", currentAppId)
          .eq("user_id", user.id);
      }
    }

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/applications");
    if (applicationId) {
      revalidatePath(`/dashboard/applications/${applicationId}`);
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to associate repository.";
    return { success: false, error: message };
  }
}

/**
 * Disconnects a user's GitHub installation and revokes database associations.
 */
export async function disconnectGitHubInstallation(installationId: number): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized." };
    }

    // Delete installation record (cascade removes repositories and unlinks apps)
    const { error } = await supabase
      .from("github_installations")
      .delete()
      .eq("installation_id", installationId)
      .eq("user_id", user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/applications");

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to disconnect installation.";
    return { success: false, error: message };
  }
}
