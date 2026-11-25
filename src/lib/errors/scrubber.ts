/**
 * Error Report Scrubber
 *
 * Removes PII, secrets, and credentials from error event fields
 * before storing in the database. Never logs what was removed.
 */

// Reuse the 11 secret patterns from secret-scanner, plus extras
const SCRUB_PATTERNS: RegExp[] = [
  // Email addresses
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
  // JWTs (three base64url segments separated by dots)
  /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
  // Bearer tokens in strings
  /(?:bearer|token|authorization)\s*[:=\s]+[A-Za-z0-9\-_./+]{20,}/gi,
  // Long hex strings (32+ chars) — potential secrets/hashes
  /\b[0-9a-fA-F]{32,}\b/g,
  // Long base64-like strings (40+ chars)
  /[A-Za-z0-9+/]{40,}={0,2}/g,
  // API-key-looking assignments
  /(?:api[_\-]?key|api[_\-]?secret|access[_\-]?token|private[_\-]?key|secret[_\-]?key|auth[_\-]?token|password|passwd|pwd)['"]?\s*[:=]\s*['"]?([A-Za-z0-9\-_./+]{10,})['"]?/gi,
  // Credit card numbers (13-19 digits with optional separators)
  /\b(?:\d[\s\-]?){13,19}\b/g,
  // AWS keys
  /(?:AKIA|ASIA|AROA|AIDA)[A-Z0-9]{16}/g,
  // GitHub tokens
  /\b(?:ghp_|gho_|github_pat_)[A-Za-z0-9_]{20,}\b/g,
  // Google API keys
  /\bAIza[A-Za-z0-9\-_]{35}\b/g,
  // Stripe keys
  /\b(?:sk_live_|pk_live_|rk_live_)[A-Za-z0-9]{24,}\b/g,
  // Database connection strings
  /(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis):\/\/[^:]+:[^@\s'"]+@[^\s'"]+/gi,
  // Query strings from URLs
  /(\?)[^)\s"'`\]]+/g,
  // URL fragments
  /(#)[^)\s"'`\]]+/g,
];

/** Replace all PII/secrets in a string with [REDACTED] */
export function scrubString(input: string): string {
  let result = input;
  for (const pattern of SCRUB_PATTERNS) {
    // Reset stateful regex
    pattern.lastIndex = 0;
    result = result.replace(pattern, "[REDACTED]");
    pattern.lastIndex = 0;
  }
  return result;
}

/** Scrub a route: remove query string and fragment, then scrub remaining text */
export function scrubRoute(route: string): string {
  try {
    // Strip query and fragment — parse relative paths with a dummy base
    const url = new URL(route, "https://x.invalid");
    return scrubString(url.pathname).slice(0, 500);
  } catch {
    // Not a valid URL — scrub as plain text
    return scrubString(route.replace(/[?#].*/, "")).slice(0, 500);
  }
}

/** Scrub a stack trace: remove query strings and secrets from each frame */
export function scrubStack(stack: string, maxLines = 15): string {
  const lines = stack.split("\n").slice(0, maxLines);
  return lines
    .map((line) => {
      // Remove query strings from file paths in stack frames
      const noQuery = line.replace(/\?[^):\s]*/g, "");
      return scrubString(noQuery);
    })
    .join("\n")
    .slice(0, 4000);
}

/** Extract browser family name from user-agent string (no library needed) */
export function extractBrowserFamily(ua: string): string {
  if (!ua) return "Unknown";
  const ua2 = ua.toLowerCase();
  if (ua2.includes("edg/") || ua2.includes("edge/")) return "Edge";
  if (ua2.includes("chrome") && !ua2.includes("chromium")) return "Chrome";
  if (ua2.includes("chromium")) return "Chromium";
  if (ua2.includes("firefox")) return "Firefox";
  if (ua2.includes("safari") && !ua2.includes("chrome")) return "Safari";
  if (ua2.includes("opera") || ua2.includes("opr/")) return "Opera";
  if (ua2.includes("node")) return "Node.js";
  if (ua2.includes("python")) return "Python";
  if (ua2.includes("curl")) return "curl";
  return "Other";
}
