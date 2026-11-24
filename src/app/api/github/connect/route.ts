import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { isGitHubAppConfigured } from "@/lib/github/app";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const redirectTarget = searchParams.get("redirect") || "/dashboard/settings?tab=github";

  if (!isGitHubAppConfigured()) {
    return NextResponse.redirect(
      `${origin}/dashboard/settings?tab=github&error=GitHub App is not configured. Please add GITHUB_APP_ID, GITHUB_APP_SLUG, and GITHUB_APP_PRIVATE_KEY to .env.local`
    );
  }

  // Ensure user is authenticated before allowing connection initiation
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?redirect=${encodeURIComponent(redirectTarget)}`);
  }

  // Generate cryptographic state to prevent CSRF attacks
  const stateToken = crypto.randomBytes(32).toString("hex");
  const cookieStore = await cookies();

  // Store state in a strict HTTP-only cookie with 15-minute expiration
  cookieStore.set("pulse_github_oauth_state", stateToken, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60, // 15 minutes
  });

  const slug = process.env.GITHUB_APP_SLUG;
  const githubInstallUrl = `https://github.com/apps/${slug}/installations/new?state=${encodeURIComponent(
    stateToken
  )}`;

  return NextResponse.redirect(githubInstallUrl);
}
