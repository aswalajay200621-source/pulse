"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface ChecklistStep {
  id: string;
  title: string;
  description: string;
  timeEstimate: string;
  optional: boolean;
  completed: boolean;
  skipped: boolean;
  href: string;
}

export interface ChecklistState {
  dismissed: boolean;
  hasApps: boolean;
  firstAppId: string | null;
  steps: ChecklistStep[];
  allDone: boolean;
}

export async function getChecklistState(): Promise<{
  data?: ChecklistState;
  error?: string;
}> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured." };

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Unauthorized" };

  const [profileRes, appsRes, prefsRes, keysRes, statusRes, reposRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("checklist_dismissed, checklist_skipped_steps")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("applications")
      .select("id, domain_verified_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("notification_preferences")
      .select("email_enabled")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("ingest_keys")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("revoked_at", null),
    supabase
      .from("status_pages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("enabled", true),
    supabase
      .from("github_repositories")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("application_id", "is", null),
  ]);

  const dismissed = Boolean(profileRes.data?.checklist_dismissed);
  const skippedSet = new Set<string>(profileRes.data?.checklist_skipped_steps || []);
  const apps = appsRes.data || [];
  const firstAppId = apps[0]?.id ?? null;
  const appLink = firstAppId ? `/dashboard/applications/${firstAppId}` : "/dashboard/applications";

  const steps: ChecklistStep[] = [
    {
      id: "add_app",
      title: "Add your app URL",
      description: "Start uptime & security monitoring in seconds.",
      timeEstimate: "~1 min",
      optional: false,
      completed: apps.length > 0,
      skipped: false,
      href: "/dashboard/applications",
    },
    {
      id: "email_alerts",
      title: "Turn on email alerts",
      description: "Get notified when downtime or critical issues happen.",
      timeEstimate: "~30 sec",
      optional: false,
      completed: Boolean(prefsRes.data?.email_enabled),
      skipped: false,
      href: "/dashboard/settings",
    },
    {
      id: "verify_domain",
      title: "Verify your domain",
      description: "Unlock automated Deep Scans and human security testing.",
      timeEstimate: "~2 min",
      optional: true,
      completed: apps.some((a) => Boolean(a.domain_verified_at)),
      skipped: skippedSet.has("verify_domain"),
      href: appLink,
    },
    {
      id: "error_snippet",
      title: "Paste the error reporting snippet",
      description: "Catch runtime errors and test with 'Send test error'.",
      timeEstimate: "~1 min",
      optional: true,
      completed: (keysRes.count ?? 0) > 0,
      skipped: skippedSet.has("error_snippet"),
      href: appLink,
    },
    {
      id: "status_page",
      title: "Turn on a public status page",
      description: "Share live uptime with your users via a private slug.",
      timeEstimate: "~30 sec",
      optional: true,
      completed: (statusRes.count ?? 0) > 0,
      skipped: skippedSet.has("status_page"),
      href: appLink,
    },
    {
      id: "connect_github",
      title: "Connect GitHub",
      description: "Track build status, deploy status, and test coverage.",
      timeEstimate: "~1 min",
      optional: true,
      completed: (reposRes.count ?? 0) > 0,
      skipped: skippedSet.has("connect_github"),
      href: "/dashboard/settings",
    },
  ];

  const allDone = steps.every((s) => s.completed || (s.optional && s.skipped));

  return {
    data: {
      dismissed,
      hasApps: apps.length > 0,
      firstAppId,
      steps,
      allDone,
    },
  };
}

export async function skipChecklistStep(stepId: string): Promise<{ success: boolean }> {
  if (!isSupabaseConfigured()) return { success: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("checklist_skipped_steps")
    .eq("id", user.id)
    .maybeSingle();

  const existing = Array.isArray(profile?.checklist_skipped_steps)
    ? profile.checklist_skipped_steps
    : [];
  const updated = Array.from(new Set([...existing, stepId.slice(0, 40)]));

  await supabase
    .from("profiles")
    .update({ checklist_skipped_steps: updated })
    .eq("id", user.id);

  revalidatePath("/dashboard");
  return { success: true };
}

export async function dismissChecklist(): Promise<{ success: boolean }> {
  if (!isSupabaseConfigured()) return { success: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false };

  await supabase
    .from("profiles")
    .update({ checklist_dismissed: true })
    .eq("id", user.id);

  revalidatePath("/dashboard");
  return { success: true };
}
