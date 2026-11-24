import { getInstallationAccessToken } from "@/lib/github/app";
import { scanFileContent } from "@/lib/security/secret-scanner";
import { parseManifest, queryOsvBatch, SUPPORTED_MANIFEST_FILES } from "@/lib/security/dependency-scanner";
import type { SecretFinding } from "@/lib/security/secret-scanner";
import type { DependencyFinding } from "@/lib/security/dependency-scanner";

export const MAX_REPO_SIZE_MB = 50;
export const MAX_FILES_TO_SCAN = 500;
export const SCAN_TIMEOUT_MS = 120_000; // 2 minutes total

export interface RepoScanResult {
  secretFindings: SecretFinding[];
  dependencyFindings: DependencyFinding[];
  scannedFileCount: number;
  skippedFileCount: number;
  error: string | null;
  limitReached: boolean;
}

interface GitHubTreeItem {
  path: string;
  type: string;
  size?: number;
  sha: string;
  url: string;
}

/**
 * Fetches the full repository file tree via GitHub REST API.
 * Uses the installation token (short-lived, scoped to read-only Contents access).
 * Never executes repository code.
 */
async function fetchRepoTree(
  token: string,
  ownerLogin: string,
  repoName: string,
  defaultBranch: string
): Promise<{ tree: GitHubTreeItem[]; truncated: boolean; error?: string }> {
  const url = `https://api.github.com/repos/${ownerLogin}/${repoName}/git/trees/${defaultBranch}?recursive=1`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (res.status === 409) {
    return { tree: [], truncated: false, error: "Repository is empty." };
  }

  if (!res.ok) {
    return { tree: [], truncated: false, error: `GitHub tree API returned HTTP ${res.status}.` };
  }

  const data = await res.json() as { tree: GitHubTreeItem[]; truncated: boolean };
  return { tree: data.tree || [], truncated: data.truncated || false };
}

/**
 * Fetches a single file's content from GitHub (decoded from base64).
 * Hard-limits file size to 1MB to prevent memory exhaustion.
 */
async function fetchFileContent(
  token: string,
  ownerLogin: string,
  repoName: string,
  filePath: string
): Promise<string | null> {
  const url = `https://api.github.com/repos/${ownerLogin}/${repoName}/contents/${encodeURIComponent(filePath)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) return null;

  const data = await res.json() as { content?: string; encoding?: string; size?: number };
  if (!data.content || data.encoding !== "base64") return null;
  if (data.size && data.size > 1_048_576) return null; // 1MB

  try {
    return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
  } catch {
    return null;
  }
}

/**
 * Scans a repository for secrets and dependency vulnerabilities.
 * - Read-only: only fetches file metadata and content via GitHub REST API.
 * - Never executes repository code or installs packages.
 * - Enforces total file count and timeout limits.
 */
export async function scanRepository(
  installationId: number,
  ownerLogin: string,
  repoName: string,
  defaultBranch: string
): Promise<RepoScanResult> {
  const tokenData = await getInstallationAccessToken(installationId);
  const token = tokenData.token;
  const startTime = Date.now();

  const { tree, error: treeError } = await fetchRepoTree(token, ownerLogin, repoName, defaultBranch);

  if (treeError) {
    return {
      secretFindings: [],
      dependencyFindings: [],
      scannedFileCount: 0,
      skippedFileCount: 0,
      error: treeError,
      limitReached: false,
    };
  }

  const blobs = tree.filter((item) => item.type === "blob");

  // Check repository size limit
  const totalSizeBytes = blobs.reduce((acc, f) => acc + (f.size || 0), 0);
  if (totalSizeBytes > MAX_REPO_SIZE_MB * 1024 * 1024) {
    return {
      secretFindings: [],
      dependencyFindings: [],
      scannedFileCount: 0,
      skippedFileCount: blobs.length,
      error: `Repository exceeds ${MAX_REPO_SIZE_MB}MB scanning limit.`,
      limitReached: true,
    };
  }

  const secretFindings: SecretFinding[] = [];
  const manifestContents: Array<{ path: string; content: string }> = [];
  let scannedFileCount = 0;
  let skippedFileCount = 0;
  let limitReached = false;

  for (const file of blobs) {
    if (!file.path) continue;
    if (Date.now() - startTime > SCAN_TIMEOUT_MS) {
      limitReached = true;
      break;
    }
    if (scannedFileCount >= MAX_FILES_TO_SCAN) {
      limitReached = true;
      skippedFileCount += blobs.length - scannedFileCount;
      break;
    }

    const fileName = file.path.split("/").pop() || "";
    const isManifest = SUPPORTED_MANIFEST_FILES.includes(fileName);
    const isScannable = !fileName.endsWith(".lock") && !fileName.endsWith(".sum");

    const content = await fetchFileContent(token, ownerLogin, repoName, file.path);
    if (!content) {
      skippedFileCount++;
      continue;
    }

    // Secret scan every text file
    if (isScannable) {
      const fileSecrets = scanFileContent(content, file.path);
      secretFindings.push(...fileSecrets);
    }

    // Collect manifests for dependency scanning
    if (isManifest) {
      manifestContents.push({ path: file.path, content });
    }

    scannedFileCount++;
  }

  // Dependency scan: parse manifests and batch-query OSV
  const allPackages = manifestContents.flatMap(({ path, content }) =>
    parseManifest(path, content)
  );

  // Batch in chunks of 100 (OSV API limit guidance)
  const dependencyFindings: DependencyFinding[] = [];
  const BATCH_SIZE = 100;
  for (let i = 0; i < allPackages.length; i += BATCH_SIZE) {
    if (Date.now() - startTime > SCAN_TIMEOUT_MS) {
      limitReached = true;
      break;
    }
    const batch = allPackages.slice(i, i + BATCH_SIZE);
    const results = await queryOsvBatch(batch);
    dependencyFindings.push(...results);
  }

  return {
    secretFindings,
    dependencyFindings,
    scannedFileCount,
    skippedFileCount,
    error: null,
    limitReached,
  };
}
