import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  isGitHubAppConfigured,
  getInstallationDetails,
  getInstallationAccessToken,
  listInstallationRepositories,
} from "@/lib/github/app";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const installationIdParam = searchParams.get("installation_id");
  const stateParam = searchParams.get("state");
  const setupAction = searchParams.get("setup_action");

  // Destination after callback
  const destination = `${origin}/dashboard/settings?tab=github`;

  // 1. Verify user session
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.redirect(`${origin}/login?error=Unauthorized. Please sign in to connect GitHub.`);
  }

  // 2. Validate installation ID
  if (!installationIdParam || isNaN(Number(installationIdParam))) {
    return NextResponse.redirect(`${destination}&error=Invalid or missing installation_id.`);
  }

  const installationId = Number(installationIdParam);

  // 3. CSRF State validation
  const cookieStore = await cookies();
  const storedState = cookieStore.get("pulse_github_oauth_state")?.value;

  // Clear state cookie regardless
  cookieStore.delete("pulse_github_oauth_state");

  if (!storedState || storedState !== stateParam) {
    return NextResponse.redirect(
      `${destination}&error=CSRF validation failed: State token mismatch or expired request.`
    );
  }

  if (!isGitHubAppConfigured()) {
    return NextResponse.redirect(
      `${destination}&error=GitHub App credentials are not configured on the server.`
    );
  }

  try {
    // 4. Fetch installation details from GitHub API to verify legitimacy
    const details = await getInstallationDetails(installationId);

    // 5. Upsert the installation record in public.github_installations
    const { error: installError } = await supabase
      .from("github_installations")
      .upsert(
        {
          user_id: user.id,
          installation_id: installationId,
          account_login: details.account.login,
          account_id: details.account.id,
          account_type: details.account.type,
          account_avatar_url: details.account.avatar_url,
          target_type: details.target_type,
          permissions: details.permissions,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "installation_id" }
      );

    if (installError) {
      return NextResponse.redirect(`${destination}&error=${encodeURIComponent(installError.message)}`);
    }

    // 6. Fetch accessible repositories for this installation
    const tokenData = await getInstallationAccessToken(installationId);
    const repos = await listInstallationRepositories(tokenData.token);

    // 7. Upsert repositories into public.github_repositories
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

    return NextResponse.redirect(`${destination}&success=connected`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to process GitHub installation.";
    return NextResponse.redirect(`${destination}&error=${encodeURIComponent(message)}`);
  }
}
