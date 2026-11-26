import { scanFileContent } from "@/lib/security/secret-scanner";

export const SECRET_GUARD_MESSAGE =
  "This looks like a private key or secret. Pulse never needs it. Please remove it.";

const EXTRA_SECRET_PATTERNS: RegExp[] = [
  /(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis|rediss):\/\/[^\s'"]+/i,
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/i,
  /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, // JWT
];

export interface SecretGuardResult {
  safe: boolean;
  error?: string;
}

/**
 * Checks user-supplied text fields (paths, notes, flow check fields, etc.)
 * against the existing 11 secret-scanner rules plus DB connection strings,
 * private keys, and JWTs. Never logs the input value.
 */
export function validateNoSecrets(value: string | null | undefined): SecretGuardResult {
  if (!value || typeof value !== "string") {
    return { safe: true };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { safe: true };
  }

  const findings = scanFileContent(trimmed, "user-input");
  if (findings.length > 0) {
    return { safe: false, error: SECRET_GUARD_MESSAGE };
  }

  for (const pattern of EXTRA_SECRET_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { safe: false, error: SECRET_GUARD_MESSAGE };
    }
  }

  return { safe: true };
}
