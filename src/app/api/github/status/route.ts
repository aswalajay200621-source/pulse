import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchRepoStatus } from "@/lib/github/build-status";
import { isGitHubAppConfigured } from "@/lib/github/app";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function verifyCronSecret(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader || !authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7).trim();
  if (token.length !== secret.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret));
}

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGitHubAppConfigured()) {
    return NextResponse.json({ skipped: true, reason: "GitHub App not configured" });
  }

  const supabaseAdmin = createAdminClient();

  // Idempotency: use an hourly bucket key
  const now = new Date();
  const hourKey = `github-status-${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}T${now.getUTCHours()}Z`;

  // Get all apps with linked repos (via github_repositories table)
  const { data: linkedRepos, error: reposError } = await supabaseAdmin
    .from("github_repositories")
    .select("id, installation_id, full_name, default_branch, application_id, user_id")
    .not("application_id", "is", null);

  if (reposError) {
    return NextResponse.json({ error: reposError.message }, { status: 500 });
  }

  const repos = linkedRepos || [];
  const BATCH_SIZE = 5; // keep well within 20s limit
  const results: Array<{ repoId: string; status: string }> = [];

  for (let i = 0; i < repos.length; i += BATCH_SIZE) {
    const batch = repos.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (repo) => {
        try {
          const statusData = await fetchRepoStatus(
            repo.installation_id,
            repo.full_name,
            repo.default_branch
          );

          // Upsert into repo_status
          const { data: existing } = await supabaseAdmin
            .from("repo_status")
            .select("id, last_run_conclusion, last_deploy_state, build_alerted_at, deploy_alerted_at, no_tests_alerted_at")
            .eq("application_id", repo.application_id)
            .maybeSingle();

          const upsertData = {
            application_id: repo.application_id,
            user_id: repo.user_id,
            repository_full_name: statusData.repositoryFullName,
            last_commit_sha: statusData.lastCommitSha,
            last_run_conclusion: statusData.lastRunConclusion,
            last_run_url: statusData.lastRunUrl,
            last_deploy_state: statusData.lastDeployState,
            last_deploy_url: statusData.lastDeployUrl,
            tests_present: statusData.testsPresent,
            checked_at: new Date().toISOString(),
          };

          if (existing) {
            await supabaseAdmin.from("repo_status").update(upsertData).eq("id", existing.id);
          } else {
            await supabaseAdmin.from("repo_status").insert(upsertData);
          }

          // Alert logic (best-effort, never throws)
          await handleRepoAlerts(supabaseAdmin, repo, statusData, existing || null, hourKey);

          results.push({ repoId: repo.id, status: "ok" });
        } catch {
          results.push({ repoId: repo.id, status: "error" });
        }
      })
    );
  }

  return NextResponse.json({ success: true, processed: repos.length, results });
}

type RepoRow = {
  installation_id: number;
  full_name: string;
  default_branch: string;
  application_id: string;
  user_id: string;
};

type ExistingStatus = {
  id: string;
  last_run_conclusion: string | null;
  last_deploy_state: string | null;
  build_alerted_at: string | null;
  deploy_alerted_at: string | null;
  no_tests_alerted_at: string | null;
} | null;

async function handleRepoAlerts(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  repo: RepoRow,
  statusData: { lastRunConclusion: string | null; lastRunUrl: string | null; lastDeployState: string | null; lastDeployUrl: string | null; testsPresent: boolean },
  existing: ExistingStatus,
  _hourKey: string
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const failConclusions = ["failure", "cancelled", "timed_out"];
    const failDeploys = ["failure", "error"];

    // Build failed alert
    const buildFailed = failConclusions.includes(statusData.lastRunConclusion || "");
    const prevBuildOk = !failConclusions.includes(existing?.last_run_conclusion || "none");
    const lastBuildAlert = existing?.build_alerted_at;
    if (buildFailed && prevBuildOk && (!lastBuildAlert || lastBuildAlert < dayAgo)) {
      await supabaseAdmin.from("alerts").insert({
        user_id: repo.user_id,
        application_id: repo.application_id,
        severity: "high",
        title: `Build failed on ${repo.full_name}`,
        description: `The latest workflow run concluded with "${statusData.lastRunConclusion}". ${statusData.lastRunUrl ? `View: ${statusData.lastRunUrl}` : ""}`,
      });
      await supabaseAdmin.from("repo_status")
        .update({ build_alerted_at: now })
        .eq("application_id", repo.application_id);
    }

    // Build recovery
    if (!buildFailed && failConclusions.includes(existing?.last_run_conclusion || "")) {
      await supabaseAdmin.from("alerts").insert({
        user_id: repo.user_id,
        application_id: repo.application_id,
        severity: "low",
        title: `Build recovered on ${repo.full_name}`,
        description: `The latest workflow run succeeded.`,
      });
    }

    // Deploy failed alert
    const deployFailed = failDeploys.includes(statusData.lastDeployState || "");
    const prevDeployOk = !failDeploys.includes(existing?.last_deploy_state || "");
    const lastDeployAlert = existing?.deploy_alerted_at;
    if (deployFailed && prevDeployOk && (!lastDeployAlert || lastDeployAlert < dayAgo)) {
      await supabaseAdmin.from("alerts").insert({
        user_id: repo.user_id,
        application_id: repo.application_id,
        severity: "high",
        title: `Deploy failed on ${repo.full_name}`,
        description: `The latest deployment state is "${statusData.lastDeployState}". ${statusData.lastDeployUrl ? `View: ${statusData.lastDeployUrl}` : ""}`,
      });
      await supabaseAdmin.from("repo_status")
        .update({ deploy_alerted_at: now })
        .eq("application_id", repo.application_id);
    }

    // No tests warning (once per week)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const lastNoTestsAlert = existing?.no_tests_alerted_at;
    if (!statusData.testsPresent && (!lastNoTestsAlert || lastNoTestsAlert < weekAgo)) {
      await supabaseAdmin.from("alerts").insert({
        user_id: repo.user_id,
        application_id: repo.application_id,
        severity: "medium",
        title: `No automated tests found in ${repo.full_name}`,
        description: `No test scripts, test directories, or workflow files were detected. Consider adding automated tests.`,
      });
      await supabaseAdmin.from("repo_status")
        .update({ no_tests_alerted_at: now })
        .eq("application_id", repo.application_id);
    }
  } catch {
    // Swallow — alerts must not break the job
  }
}
