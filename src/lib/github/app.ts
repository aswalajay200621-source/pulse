import crypto from "node:crypto";

export interface GitHubRepoItem {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
  };
}

export interface GitHubInstallationDetails {
  id: number;
  account: {
    login: string;
    id: number;
    avatar_url: string;
    type: string;
  };
  target_type: string;
  permissions: Record<string, string>;
  created_at: string;
  updated_at: string;
}

/**
 * Checks whether the necessary GitHub App environment variables are configured.
 */
export function isGitHubAppConfigured(): boolean {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const slug = process.env.GITHUB_APP_SLUG;

  if (!appId || !privateKey || !slug) return false;
  if (appId === "placeholder-app-id" || privateKey === "placeholder-private-key") return false;

  return true;
}

/**
 * Normalizes the private key whether it was provided as raw PEM or base64-encoded PEM.
 */
export function getFormattedPrivateKey(): string | null {
  const rawKey = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!rawKey) return null;

  // Check if it's base64 encoded
  if (!rawKey.includes("-----BEGIN") && rawKey.length > 100) {
    try {
      const decoded = Buffer.from(rawKey, "base64").toString("utf-8");
      if (decoded.includes("-----BEGIN")) {
        return decoded;
      }
    } catch {
      // Fallback
    }
  }

  // Replace literal '\n' characters with actual newlines if pasted as single-line env var
  return rawKey.replace(/\\n/g, "\n");
}

/**
 * Helper to encode Base64URL without padding according to RFC 7515.
 */
function base64UrlEncode(str: string | Buffer): string {
  const buf = typeof str === "string" ? Buffer.from(str) : str;
  return buf.toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Generates an RS256-signed JWT for GitHub App authentication (valid for 9 minutes).
 */
export function generateGitHubAppJwt(): string {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = getFormattedPrivateKey();

  if (!appId || !privateKey) {
    throw new Error("GitHub App ID or Private Key is not configured.");
  }

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60, // 60 seconds in the past to allow for clock drift
    exp: now + 9 * 60, // 9 minutes maximum validity
    iss: appId,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signInput = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signInput);
  signer.end();

  const signature = signer.sign(privateKey);
  const encodedSignature = base64UrlEncode(signature);

  return `${signInput}.${encodedSignature}`;
}

/**
 * Obtains a short-lived installation access token (valid for 1 hour) for a specific installation ID.
 */
export async function getInstallationAccessToken(installationId: number): Promise<{
  token: string;
  expires_at: string;
}> {
  const jwt = generateGitHubAppJwt();

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Pulse-App-Monitor",
      },
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to obtain GitHub installation token: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  return {
    token: data.token,
    expires_at: data.expires_at,
  };
}

/**
 * Retrieves details about an installation.
 */
export async function getInstallationDetails(installationId: number): Promise<GitHubInstallationDetails> {
  const jwt = generateGitHubAppJwt();

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Pulse-App-Monitor",
      },
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to fetch installation details: ${response.status} ${errorBody}`);
  }

  return await response.json();
}

/**
 * Lists repositories authorized for a given installation.
 */
export async function listInstallationRepositories(
  installationAccessToken: string
): Promise<GitHubRepoItem[]> {
  const response = await fetch(
    "https://api.github.com/installation/repositories?per_page=100",
    {
      method: "GET",
      headers: {
        Authorization: `token ${installationAccessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Pulse-App-Monitor",
      },
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to list installation repositories: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  return data.repositories || [];
}

/**
 * Verifies that an incoming webhook payload matches the X-Hub-Signature-256 header.
 */
export function verifyGitHubWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const webhookSecret = process.env.GITHUB_APP_WEBHOOK_SECRET;
  if (!webhookSecret || !signatureHeader) return false;

  const hmac = crypto.createHmac("sha256", webhookSecret);
  hmac.update(rawBody);
  const calculatedSignature = `sha256=${hmac.digest("hex")}`;

  try {
    const trustedBuf = Buffer.from(calculatedSignature, "utf-8");
    const receivedBuf = Buffer.from(signatureHeader, "utf-8");

    if (trustedBuf.length !== receivedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(trustedBuf, receivedBuf);
  } catch {
    return false;
  }
}
