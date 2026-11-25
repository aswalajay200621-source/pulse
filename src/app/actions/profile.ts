"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type UserRole = "developer" | "tester";
export type SkillLevel = "beginner" | "intermediate" | "advanced";

export interface UserProfileData {
  id: string;
  email: string | null;
  display_name: string;
  roles: UserRole[];
  onboarding_completed: boolean;
  tester_profile: {
    id: string;
    display_name: string;
    skill_level: SkillLevel;
    focus_areas: string[];
    proof_url: string | null;
    contact: string | null;
    status: "pending" | "approved" | "rejected";
    needs_review: boolean;
  } | null;
}

const ALLOWED_ROLES: UserRole[] = ["developer", "tester"];
const ALLOWED_SKILLS: SkillLevel[] = ["beginner", "intermediate", "advanced"];

function validateRoles(roles: unknown): UserRole[] | null {
  if (!Array.isArray(roles) || roles.length === 0) return null;
  const unique = Array.from(new Set(roles)).filter((r): r is UserRole =>
    ALLOWED_ROLES.includes(r as UserRole)
  );
  return unique.length > 0 ? unique : null;
}

export async function getMyProfile(): Promise<{
  data?: UserProfileData;
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
    return { error: "Unauthorized" };
  }

  const [{ data: profile }, { data: tester }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, display_name, roles, onboarding_completed")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("tester_profiles")
      .select("id, display_name, skill_level, focus_areas, proof_url, contact, status, needs_review")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const displayName =
    profile?.display_name ||
    profile?.full_name ||
    user.email?.split("@")[0] ||
    "User";

  const roles = validateRoles(profile?.roles) || ["developer"];

  return {
    data: {
      id: user.id,
      email: user.email ?? profile?.email ?? null,
      display_name: displayName.slice(0, 60),
      roles,
      onboarding_completed: Boolean(profile?.onboarding_completed),
      tester_profile: tester
        ? {
            id: tester.id,
            display_name: tester.display_name,
            skill_level: tester.skill_level as SkillLevel,
            focus_areas: tester.focus_areas || [],
            proof_url: tester.proof_url,
            contact: tester.contact ?? null,
            status: tester.status as "pending" | "approved" | "rejected",
            needs_review: Boolean(tester.needs_review),
          }
        : null,
    },
  };
}

export async function completeOnboarding(input: {
  displayName: string;
  roles: UserRole[];
  skillLevel?: SkillLevel;
  focusAreas?: string[];
  proofUrl?: string;
  contact?: string;
  ageConfirmed?: boolean;
  rulesAccepted?: boolean;
}): Promise<{ success: boolean; redirectTo?: string; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Supabase not configured." };
  }

  const validRoles = validateRoles(input.roles);
  if (!validRoles) {
    return { success: false, error: "Please select at least one role." };
  }

  const displayName = (input.displayName || "").trim().slice(0, 60);
  if (displayName.length < 2) {
    return { success: false, error: "Display name must be at least 2 characters." };
  }

  const hasTester = validRoles.includes("tester");
  if (hasTester) {
    if (!input.ageConfirmed) {
      return { success: false, error: "You must confirm you are 18 years old or older." };
    }
    if (!input.rulesAccepted) {
      return { success: false, error: "You must accept the testing rules." };
    }
    if (!input.skillLevel || !ALLOWED_SKILLS.includes(input.skillLevel)) {
      return { success: false, error: "Please select a valid skill level." };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Unauthorized." };
  }

  const { error: profileErr } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      roles: validRoles,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (profileErr) {
    return { success: false, error: profileErr.message };
  }

  if (hasTester) {
    const focusAreas = (input.focusAreas || []).map((f) => f.trim().slice(0, 50)).filter(Boolean).slice(0, 10);
    const proofUrl = input.proofUrl?.trim().slice(0, 300) || null;
    const contact = input.contact?.trim().slice(0, 200) || null;

    const { data: existingTester } = await supabase
      .from("tester_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingTester) {
      const { error: testerErr } = await supabase.from("tester_profiles").insert({
        user_id: user.id,
        display_name: displayName,
        skill_level: input.skillLevel || "beginner",
        focus_areas: focusAreas,
        proof_url: proofUrl,
        contact,
        status: "pending",
      });
      if (testerErr) {
        return { success: false, error: testerErr.message };
      }
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/experts");

  const redirectTo =
    validRoles.includes("tester") && !validRoles.includes("developer")
      ? "/dashboard/experts"
      : "/dashboard";

  return { success: true, redirectTo };
}

export async function updateProfile(input: {
  displayName: string;
  roles: UserRole[];
  skillLevel?: SkillLevel;
  focusAreas?: string[];
  proofUrl?: string;
  contact?: string;
}): Promise<{ success: boolean; error?: string; needsReview?: boolean }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Supabase not configured." };
  }

  const validRoles = validateRoles(input.roles);
  if (!validRoles) {
    return { success: false, error: "At least one role must remain selected." };
  }

  const displayName = (input.displayName || "").trim().slice(0, 60);
  if (displayName.length < 2) {
    return { success: false, error: "Display name must be at least 2 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Unauthorized." };
  }

  const { error: profileErr } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      roles: validRoles,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (profileErr) {
    return { success: false, error: profileErr.message };
  }

  let needsReview = false;
  if (validRoles.includes("tester")) {
    const skillLevel =
      input.skillLevel && ALLOWED_SKILLS.includes(input.skillLevel)
        ? input.skillLevel
        : "beginner";
    const focusAreas = (input.focusAreas || []).map((f) => f.trim().slice(0, 50)).filter(Boolean).slice(0, 10);
    const proofUrl = input.proofUrl?.trim().slice(0, 300) || null;
    const contact = input.contact?.trim().slice(0, 200) || null;

    const { data: existingTester } = await supabase
      .from("tester_profiles")
      .select("id, status, skill_level, proof_url")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingTester) {
      const changedSensitive =
        existingTester.status === "approved" &&
        (existingTester.skill_level !== skillLevel ||
          (existingTester.proof_url || null) !== proofUrl);
      needsReview = changedSensitive;

      const { error: updateErr } = await supabase
        .from("tester_profiles")
        .update({
          display_name: displayName,
          skill_level: skillLevel,
          focus_areas: focusAreas,
          proof_url: proofUrl,
          contact,
          needs_review: changedSensitive ? true : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (updateErr) return { success: false, error: updateErr.message };
    } else {
      const { error: insertErr } = await supabase.from("tester_profiles").insert({
        user_id: user.id,
        display_name: displayName,
        skill_level: skillLevel,
        focus_areas: focusAreas,
        proof_url: proofUrl,
        contact,
        status: "pending",
      });
      if (insertErr) return { success: false, error: insertErr.message };
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/experts");

  return { success: true, needsReview };
}
