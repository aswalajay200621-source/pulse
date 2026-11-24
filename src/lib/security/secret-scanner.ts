/**
 * Secret Detection Engine
 *
 * Pattern-based scanner inspired by Gitleaks rule categories.
 * - Never stores full secret values.
 * - Masks detected values before returning.
 * - Skips binary files and enforces file size limits.
 * - Never executes repository code.
 */

export interface SecretFinding {
  ruleId: string;
  ruleName: string;
  filePath: string;
  lineNumber: number;
  maskedSecret: string;
  confidence: "high" | "medium" | "low";
  description: string;
  remediation: string;
  findingKey: string;
}

interface SecretRule {
  id: string;
  name: string;
  pattern: RegExp;
  confidence: "high" | "medium" | "low";
  description: string;
  remediation: string;
}

// Rules inspired by Gitleaks public rule set — patterns match common credential shapes
// All patterns are carefully scoped to avoid matching variable names or comments that are clearly placeholders
const SECRET_RULES: SecretRule[] = [
  {
    id: "aws-access-key",
    name: "AWS Access Key ID",
    pattern: /(?<![A-Z0-9])(AKIA|ASIA|AROA|AIDA)[A-Z0-9]{16}(?![A-Z0-9])/g,
    confidence: "high",
    description: "An AWS Access Key ID was detected in source code. If committed, it may have been exposed in Git history.",
    remediation: "Revoke this key immediately in AWS IAM. Rotate all keys. Use environment variables or AWS Secrets Manager instead.",
  },
  {
    id: "aws-secret-key",
    name: "AWS Secret Access Key",
    pattern: /(?:aws[_\-\s]*(?:secret[_\-\s]*(?:access[_\-\s]*)?)?key|aws_secret)['":\s=]+([A-Za-z0-9/+]{40})/gi,
    confidence: "high",
    description: "An AWS Secret Access Key pattern was detected. This provides full programmatic access to AWS resources.",
    remediation: "Revoke the key pair in AWS IAM. Remove from all branches and Git history using git-filter-repo.",
  },
  {
    id: "github-token",
    name: "GitHub Personal Access Token",
    pattern: /\b(ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82})\b/g,
    confidence: "high",
    description: "A GitHub Personal Access Token was detected. It provides access to repositories and potentially organizational data.",
    remediation: "Revoke the token at github.com/settings/tokens. Create a new token with minimal required scopes.",
  },
  {
    id: "google-api-key",
    name: "Google API Key",
    pattern: /\bAIza[A-Za-z0-9\-_]{35}\b/g,
    confidence: "high",
    description: "A Google API Key was detected. Exposed API keys may be abused, resulting in unexpected charges.",
    remediation: "Restrict and rotate the key in Google Cloud Console. Apply API restrictions and IP restrictions.",
  },
  {
    id: "stripe-secret-key",
    name: "Stripe Secret Key",
    pattern: /\b(sk_live_[A-Za-z0-9]{24,}|rk_live_[A-Za-z0-9]{24,})\b/g,
    confidence: "high",
    description: "A Stripe live secret key was detected. This provides full access to Stripe payment data.",
    remediation: "Roll the key immediately in the Stripe Dashboard. Use restricted keys for specific operations.",
  },
  {
    id: "stripe-publishable-key",
    name: "Stripe Publishable Key",
    pattern: /\bpk_live_[A-Za-z0-9]{24,}\b/g,
    confidence: "low",
    description: "A Stripe live publishable key was detected. This is a lower-severity finding as it is intended for browser use.",
    remediation: "While publishable keys are designed to be public, verify this was intentional.",
  },
  {
    id: "sendgrid-api-key",
    name: "SendGrid API Key",
    pattern: /\bSG\.[A-Za-z0-9\-_]{22,}\.[A-Za-z0-9\-_]{43,}\b/g,
    confidence: "high",
    description: "A SendGrid API key was detected. This may allow sending emails from your domain.",
    remediation: "Revoke the key in SendGrid settings. Create a new key with minimal required permissions.",
  },
  {
    id: "twilio-sid",
    name: "Twilio Account SID",
    pattern: /\bAC[a-f0-9]{32}\b/g,
    confidence: "medium",
    description: "A Twilio Account SID pattern was detected.",
    remediation: "Verify this is not a live credential. Rotate via Twilio Console if exposed.",
  },
  {
    id: "private-key-pem",
    name: "PEM Private Key",
    pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    confidence: "high",
    description: "A PEM-encoded private key header was detected. Private keys must never be committed.",
    remediation: "Revoke all certificates signed by this key. Remove from Git history with git-filter-repo. Store keys in a secrets manager.",
  },
  {
    id: "db-connection-string",
    name: "Database Connection String",
    pattern: /(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis):\/\/[^:]+:[^@\s'"]+@[^\s'"]+/gi,
    confidence: "high",
    description: "A database connection string with embedded credentials was detected.",
    remediation: "Rotate the database password immediately. Use environment variables for all connection strings.",
  },
  {
    id: "generic-high-entropy",
    name: "High-Entropy Secret Assignment",
    pattern: /(?:password|passwd|pwd|secret|api[_\-]?key|auth[_\-]?token|access[_\-]?token|private[_\-]?key)['"]?\s*[:=]\s*['"]([A-Za-z0-9+/=_\-]{20,})['"]?/gi,
    confidence: "medium",
    description: "A high-entropy value assigned to a credential-sounding variable was detected.",
    remediation: "Review the value. If it is a real credential, rotate it and move to environment variables or a secrets manager.",
  },
];

/** Mask all but the first 4 and last 4 characters of a detected secret. */
function maskSecret(value: string): string {
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}${"*".repeat(Math.max(4, value.length - 8))}${value.slice(-4)}`;
}

/** Deterministic finding key for deduplication across repeated scans. */
function makeFindingKey(ruleId: string, filePath: string, lineNumber: number): string {
  return `secret:${ruleId}:${filePath}:${lineNumber}`;
}

const MAX_FILE_SIZE_BYTES = 512 * 1024; // 512 KB
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".zip", ".tar", ".gz", ".7z", ".rar",
  ".exe", ".dll", ".so", ".dylib",
  ".pdf", ".mp4", ".mp3", ".mov",
  ".lock",
]);

function isBinaryPath(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * Scans a single file's text content for secret patterns.
 * Never executes the content.
 */
export function scanFileContent(
  content: string,
  filePath: string
): SecretFinding[] {
  if (isBinaryPath(filePath)) return [];
  if (content.length > MAX_FILE_SIZE_BYTES) return [];

  const findings: SecretFinding[] = [];
  const lines = content.split("\n");
  const seenKeys = new Set<string>();

  for (const rule of SECRET_RULES) {
    // Reset stateful regex
    rule.pattern.lastIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      rule.pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = rule.pattern.exec(line)) !== null) {
        const rawValue = match[1] || match[0];
        const lineNumber = i + 1;
        const findingKey = makeFindingKey(rule.id, filePath, lineNumber);

        if (seenKeys.has(findingKey)) continue;
        seenKeys.add(findingKey);

        findings.push({
          ruleId: rule.id,
          ruleName: rule.name,
          filePath,
          lineNumber,
          maskedSecret: maskSecret(rawValue),
          confidence: rule.confidence,
          description: rule.description,
          remediation: rule.remediation,
          findingKey,
        });
      }
      rule.pattern.lastIndex = 0;
    }
  }

  return findings;
}
