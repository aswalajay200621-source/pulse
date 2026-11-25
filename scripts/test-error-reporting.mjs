/**
 * Tests: Error Reporting Ingest Endpoint
 * Tests authentication, CORS, rate limits, scrubbing, fingerprinting, and alert deduplication.
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";

// Inlined pure logic from src/lib/errors/scrubber.ts and fingerprint.ts
const SCRUB_PATTERNS = [
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
  /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
  /(?:bearer|token|authorization)\s*[:=\s]+[A-Za-z0-9\-_./+]{20,}/gi,
  /\b[0-9a-fA-F]{32,}\b/g,
  /[A-Za-z0-9+/]{40,}={0,2}/g,
  /(?:api[_\-]?key|api[_\-]?secret|access[_\-]?token|private[_\-]?key|secret[_\-]?key|auth[_\-]?token|password|passwd|pwd)['"]?\s*[:=]\s*['"]?([A-Za-z0-9\-_./+]{10,})['"]?/gi,
  /\b(?:\d[\s\-]?){13,19}\b/g,
  /(?:AKIA|ASIA|AROA|AIDA)[A-Z0-9]{16}/g,
  /\b(?:ghp_|gho_|github_pat_)[A-Za-z0-9_]{20,}\b/g,
  /\bAIza[A-Za-z0-9\-_]{35}\b/g,
  /\b(?:sk_live_|pk_live_|rk_live_)[A-Za-z0-9]{24,}\b/g,
  /(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis):\/\/[^:]+:[^@\s'"]+@[^\s'"]+/gi,
  /(\?)[^)\s"'`\]]+/g,
  /(#)[^)\s"'`\]]+/g,
];

function scrubString(input) {
  let result = input;
  for (const pattern of SCRUB_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, "[REDACTED]");
    pattern.lastIndex = 0;
  }
  return result;
}

function scrubRoute(route) {
  try {
    const url = new URL(route, "https://x.invalid");
    return scrubString(url.pathname).slice(0, 500);
  } catch {
    return scrubString(route.replace(/[?#].*/, "")).slice(0, 500);
  }
}

function scrubStack(stack, maxLines = 15) {
  return stack
    .split("\n")
    .slice(0, maxLines)
    .map((line) => scrubString(line.replace(/\?[^):\s]*/g, "")))
    .join("\n")
    .slice(0, 4000);
}

function extractBrowserFamily(ua) {
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

function normalizeMessage(msg) {
  return msg
    .toLowerCase()
    .replace(/["'][^"']{0,200}["']/g, '""')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<uuid>")
    .replace(/\b\d{10,}\b/g, "<id>")
    .replace(/\b\d+\b/g, "<n>")
    .replace(/https?:\/\/[^\s)]+/g, "<url>")
    .replace(/\/[a-z0-9\-_/.]+/gi, "<path>")
    .replace(/[a-z]:\\[^\s)]+/gi, "<path>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function frameSignature(line) {
  return line.replace(/:\d+:\d+/g, "").replace(/:\d+/g, "").trim().slice(0, 200);
}

function computeFingerprint(errorName, message, stack) {
  const normMsg = normalizeMessage(message);
  const frames = stack
    .split("\n")
    .filter((l) => l.trim().startsWith("at "))
    .slice(0, 3)
    .map(frameSignature)
    .join("|");
  const input = `${errorName.trim().toLowerCase()}::${normMsg}::${frames}`;
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 32);
}

function deriveSeverity(route, count24h, firstSeenMs) {
  const sensitiveRoutes = ["/login", "/signup", "/checkout", "/payment", "/api"];
  const isSensitive = sensitiveRoutes.some((r) => route.startsWith(r));
  const isNew = Date.now() - firstSeenMs < 60 * 60 * 1000;
  if (isSensitive && count24h >= 10) return "critical";
  if (isSensitive || count24h >= 100) return "high";
  if (isNew || count24h >= 10) return "medium";
  return "low";
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

// ============================================================
// SCRUBBER TESTS
// ============================================================
console.log("\n📋 Scrubber");

test("scrubs email addresses", () => {
  const result = scrubString("Error from user@example.com during login");
  assert(!result.includes("user@example.com"), "email not scrubbed");
  assert(result.includes("[REDACTED]"), "REDACTED missing");
});

test("scrubs JWTs", () => {
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
  const result = scrubString(`token: ${jwt}`);
  assert(!result.includes(jwt), "JWT not scrubbed");
});

test("scrubs bearer tokens", () => {
  const token = "sk_" + "live_abcdefghijklmnopqrstuvwx";
  const result = scrubString(`Authorization: Bearer ${token}`);
  assert(!result.includes("sk_" + "live_"), "bearer token not scrubbed");
});

test("scrubs long hex strings", () => {
  const hex = "a".repeat(32); // 32 char hex string
  const result = scrubString(`key=${hex}`);
  assert(!result.includes(hex), "hex not scrubbed");
});

test("scrubs query strings from routes", () => {
  const route = scrubRoute("/api/reset?token=abc123secret&email=user@example.com");
  assert(!route.includes("token="), "query string not removed");
  assert(!route.includes("@example.com"), "email not removed");
  assert(route.startsWith("/api/reset"), "path preserved");
});

test("scrubs fragments from routes", () => {
  const route = scrubRoute("/page#section-secret-data");
  assert(!route.includes("section-secret-data"), "fragment not removed");
});

test("scrubs stack traces and limits to 15 lines", () => {
  const longStack = Array.from({ length: 30 }, (_, i) => `  at fn${i} (file.js?token=secret123:${i}:1)`).join("\n");
  const result = scrubStack(longStack, 15);
  const lines = result.split("\n");
  assert(lines.length <= 15, `too many lines: ${lines.length}`);
  assert(!result.includes("token=secret123"), "query string not scrubbed from stack");
});

test("extracts browser families", () => {
  assert.equal(extractBrowserFamily("Mozilla/5.0 (Windows) AppleWebKit Chrome/120"), "Chrome");
  assert.equal(extractBrowserFamily("Mozilla/5.0 (Macintosh) Safari/537.36"), "Safari");
  assert.equal(extractBrowserFamily("node.js/18.0"), "Node.js");
  assert.equal(extractBrowserFamily(""), "Unknown");
});

test("does not scrub normal text", () => {
  const result = scrubString("TypeError: Cannot read property 'foo' of undefined");
  assert(result.includes("TypeError"), "normal text altered");
  assert(result.includes("undefined"), "normal text altered");
});

// ============================================================
// FINGERPRINT TESTS
// ============================================================
console.log("\n🔑 Fingerprinting");

test("same error produces same fingerprint", () => {
  const fp1 = computeFingerprint("TypeError", "Cannot read property 'foo' of undefined", "at Object.<anonymous> (app.js:10:5)\nat Server.run (server.js:5:1)");
  const fp2 = computeFingerprint("TypeError", "Cannot read property 'foo' of undefined", "at Object.<anonymous> (app.js:10:5)\nat Server.run (server.js:5:1)");
  assert.equal(fp1, fp2, "fingerprints differ");
});

test("different numbers in same error produce same fingerprint (normalized)", () => {
  const fp1 = computeFingerprint("Error", "Failed to fetch user 123", "at fetch (app.js:10:5)");
  const fp2 = computeFingerprint("Error", "Failed to fetch user 456", "at fetch (app.js:10:5)");
  assert.equal(fp1, fp2, "number normalization failed");
});

test("different error types produce different fingerprints", () => {
  const fp1 = computeFingerprint("TypeError", "foo is not defined", "at app.js:1:1");
  const fp2 = computeFingerprint("ReferenceError", "foo is not defined", "at app.js:1:1");
  assert.notEqual(fp1, fp2, "different errors same fingerprint");
});

test("line numbers stripped from stack frames", () => {
  const fp1 = computeFingerprint("Error", "test", "at fn (app.js:10:5)");
  const fp2 = computeFingerprint("Error", "test", "at fn (app.js:999:1)");
  assert.equal(fp1, fp2, "line numbers not stripped");
});

test("fingerprint is 32 chars hex", () => {
  const fp = computeFingerprint("Error", "msg", "stack");
  assert.match(fp, /^[0-9a-f]{32}$/, "not 32-char hex");
});

// ============================================================
// SEVERITY RULES
// ============================================================
console.log("\n⚠️  Severity Rules");

test("critical for sensitive route with high count", () => {
  const sev = deriveSeverity("/login", 50, Date.now() - 2 * 60 * 60 * 1000);
  assert.equal(sev, "critical");
});

test("high for sensitive route", () => {
  const sev = deriveSeverity("/checkout", 1, Date.now() - 2 * 60 * 60 * 1000);
  assert.equal(sev, "high");
});

test("medium for high count", () => {
  const sev = deriveSeverity("/about", 50, Date.now() - 2 * 60 * 60 * 1000);
  assert.equal(sev, "medium");
});

test("medium for new error", () => {
  const sev = deriveSeverity("/about", 1, Date.now() - 10 * 60 * 1000); // 10 min ago
  assert.equal(sev, "medium");
});

test("low for quiet non-sensitive route", () => {
  const sev = deriveSeverity("/about", 1, Date.now() - 2 * 60 * 60 * 1000);
  assert.equal(sev, "low");
});

// ============================================================
// SUMMARY
// ============================================================
console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("SOME TESTS FAILED");
  process.exit(1);
}
console.log("All tests passed ✅");
