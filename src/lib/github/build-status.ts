/**
 * GitHub Build and Deploy Status Fetcher
 *
 * Uses the existing read-only GitHub App. Requires these extra permissions:
 *   - Actions: read
 *   - Checks: read
 *   - Commit statuses: read
 *   - Deployments: read
 *   - Metadata: read (already required)
 *
 * All calls are read-only. No write operations.
 */

import { getInstallationAccessToken } from "@/lib/github/app";

export interface WorkflowRunResult {
  conclusion: string | null; // success/failure/cancelled/skipped/timed_out/none
  url: string | null;
  headSha: string | null;
}

export interface DeploymentResult {
  state: string | null; // success/failure/error/inactive/pending/in_progress/queued
  url: string | null;
}

export interface RepoStatusResult {
  lastCommitSha: string | null;        // 7-char short SHA
  lastRunConclusion: string | null;
  lastRunUrl: string | null;
  lastDeployState: string | null;
  lastDeployUrl: string | null;
  testsPresent: boolean;
  repositoryFullName: string | null;
}

const GH_API = "https://api.github.com";
const GH_HEADERS = (token: string) => ({
  Authorization: `token ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "Pulse-App-Monitor",
});

/** Fetch the latest workflow run on the default branch */
async function getLatestWorkflowRun(
  token: string,
  fullName: string,
  defaultBranch: string
): Promise<WorkflowRunResult> {
  try {
    const url = `${GH_API}/repos/${fullName}/actions/runs?branch=${encodeURIComponent(defaultBranch)}&per_page=1`;
    const res = await fetch(url, { headers: GH_HEADERS(token), signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { conclusion: "none", url: null, headSha: null };
    const data = await res.json();
    const run = data?.workflow_runs?.[0];
    if (!run) return { conclusion: "none", url: null, headSha: null };
    return {
      conclusion: run.conclusion ?? run.status ?? "none",
      url: run.html_url ?? null,
      headSha: run.head_sha ? (run.head_sha as string).slice(0, 7) : null,
    };
  } catch {
    return { conclusion: "none", url: null, headSha: null };
  }
}

/** Fetch the latest deployment for the default environment */
async function getLatestDeployment(
  token: string,
  fullName: string,
  defaultBranch: string
): Promise<DeploymentResult> {
  try {
    const url = `${GH_API}/repos/${fullName}/deployments?ref=${encodeURIComponent(defaultBranch)}&per_page=1`;
    const res = await fetch(url, { headers: GH_HEADERS(token), signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { state: null, url: null };
    const data = await res.json();
    const deployment = Array.isArray(data) ? data[0] : null;
    if (!deployment) return { state: null, url: null };

    // Get the latest status for this deployment
    const statusRes = await fetch(
      `${GH_API}/repos/${fullName}/deployments/${deployment.id}/statuses?per_page=1`,
      { headers: GH_HEADERS(token), signal: AbortSignal.timeout(8000) }
    );
    if (!statusRes.ok) return { state: null, url: null };
    const statuses = await statusRes.json();
    const latest = Array.isArray(statuses) ? statuses[0] : null;
    return {
      state: latest?.state ?? null,
      url: latest?.target_url ?? null,
    };
  } catch {
    return { state: null, url: null };
  }
}

/** Detect if the repo has test infrastructure (file listing only, no code execution) */
async function detectTestsPresent(
  token: string,
  fullName: string,
  defaultBranch: string
): Promise<boolean> {
  try {
    // Check package.json for test script
    const pkgRes = await fetch(
      `${GH_API}/repos/${fullName}/contents/package.json?ref=${encodeURIComponent(defaultBranch)}`,
      { headers: GH_HEADERS(token), signal: AbortSignal.timeout(8000) }
    );
    if (pkgRes.ok) {
      const pkgData = await pkgRes.json();
      if (pkgData?.content) {
        const decoded = Buffer.from(pkgData.content, "base64").toString("utf-8");
        try {
          const pkg = JSON.parse(decoded);
          if (pkg?.scripts?.test && pkg.scripts.test !== "echo \"Error: no test specified\" && exit 1") {
            return true;
          }
        } catch { /* not parseable */ }
      }
    }

    // Check for workflow files
    const wfRes = await fetch(
      `${GH_API}/repos/${fullName}/contents/.github/workflows`,
      { headers: GH_HEADERS(token), signal: AbortSignal.timeout(8000) }
    );
    if (wfRes.ok) {
      const workflows = await wfRes.json();
      if (Array.isArray(workflows) && workflows.length > 0) return true;
    }

    // Check for common test directories
    const testDirs = ["__tests__", "test", "tests", "spec"];
    for (const dir of testDirs) {
      const r = await fetch(
        `${GH_API}/repos/${fullName}/contents/${dir}?ref=${encodeURIComponent(defaultBranch)}`,
        { headers: GH_HEADERS(token), signal: AbortSignal.timeout(5000) }
      );
      if (r.ok) return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Fetch the full build/deploy status for a repository.
 * Times out gracefully — all network errors return partial data.
 */
export async function fetchRepoStatus(
  installationId: number,
  fullName: string,
  defaultBranch: string
): Promise<RepoStatusResult> {
  let token: string;
  try {
    const tokenData = await getInstallationAccessToken(installationId);
    token = tokenData.token;
  } catch {
    return {
      lastCommitSha: null,
      lastRunConclusion: null,
      lastRunUrl: null,
      lastDeployState: null,
      lastDeployUrl: null,
      testsPresent: false,
      repositoryFullName: fullName,
    };
  }

  const [runResult, deployResult, testsPresent] = await Promise.all([
    getLatestWorkflowRun(token, fullName, defaultBranch),
    getLatestDeployment(token, fullName, defaultBranch),
    detectTestsPresent(token, fullName, defaultBranch),
  ]);

  return {
    lastCommitSha: runResult.headSha,
    lastRunConclusion: runResult.conclusion,
    lastRunUrl: runResult.url,
    lastDeployState: deployResult.state,
    lastDeployUrl: deployResult.url,
    testsPresent,
    repositoryFullName: fullName,
  };
}
