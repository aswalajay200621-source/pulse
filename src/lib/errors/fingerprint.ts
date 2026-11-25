/**
 * Error Fingerprinting
 *
 * Deterministic fingerprint = SHA-256 of:
 *   errorName + normalizedMessage + top3FrameSignatures
 *
 * Normalization strips numbers, quoted strings, UUIDs, paths, and IDs
 * so the same logical error groups together regardless of varying values.
 */

import crypto from "node:crypto";

/** Normalize an error message for fingerprinting */
function normalizeMessage(msg: string): string {
  return msg
    .toLowerCase()
    .replace(/["'][^"']{0,200}["']/g, '""')           // quoted strings → ""
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<uuid>") // UUIDs
    .replace(/\b\d{10,}\b/g, "<id>")                   // long numbers (IDs, timestamps)
    .replace(/\b\d+\b/g, "<n>")                        // remaining numbers
    .replace(/https?:\/\/[^\s)]+/g, "<url>")           // URLs
    .replace(/\/[a-z0-9\-_/.]+/gi, "<path>")           // Unix paths
    .replace(/[a-z]:\\[^\s)]+/gi, "<path>")            // Windows paths
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/** Extract signature from a stack frame (strips line/column numbers) */
function frameSignature(line: string): string {
  // Remove column and line numbers: "at foo (bar.js:10:5)" → "at foo (bar.js)"
  return line.replace(/:\d+:\d+/g, "").replace(/:\d+/g, "").trim().slice(0, 200);
}

/**
 * Compute a deterministic fingerprint for an error.
 * Returns a 16-char hex prefix of the SHA-256 digest.
 */
export function computeFingerprint(
  errorName: string,
  message: string,
  stack: string
): string {
  const normMsg = normalizeMessage(message);

  // Take the top 3 non-empty stack frames (skip the first which is often "Error: ...")
  const frames = stack
    .split("\n")
    .filter((l) => l.trim().startsWith("at "))
    .slice(0, 3)
    .map(frameSignature)
    .join("|");

  const input = `${errorName.trim().toLowerCase()}::${normMsg}::${frames}`;
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 32);
}

/**
 * Derive severity from context rules (deterministic, no AI).
 */
export function deriveSeverity(
  route: string,
  count24h: number,
  firstSeenMs: number
): "critical" | "high" | "medium" | "low" {
  const sensitiveRoutes = ["/login", "/signup", "/checkout", "/payment", "/api"];
  const isSensitive = sensitiveRoutes.some((r) => route.startsWith(r));
  const isNew = Date.now() - firstSeenMs < 60 * 60 * 1000; // first seen < 1h ago

  if (isSensitive && count24h >= 10) return "critical";
  if (isSensitive || count24h >= 100) return "high";
  if (isNew || count24h >= 10) return "medium";
  return "low";
}
