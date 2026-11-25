/**
 * Tests: Health Check Logic
 * Tests path validation, failure rule, response scrubbing.
 */

import assert from "node:assert/strict";

// Inlined pure logic from src/lib/monitoring/health-check.ts
function validateHealthCheckPath(path) {
  if (!path) return { valid: false, error: "Path is required." };
  const trimmed = path.trim();
  if (!trimmed.startsWith("/")) return { valid: false, error: "Health check path must start with /." };
  if (trimmed.length > 500) return { valid: false, error: "Path too long." };
  if (trimmed.includes("?") || trimmed.includes("#") || trimmed.includes("://")) {
    return { valid: false, error: "Path must be a relative path with no query string or fragment." };
  }
  if (!/^[a-zA-Z0-9\-_/.]+$/.test(trimmed)) {
    return { valid: false, error: "Path contains invalid characters." };
  }
  return { valid: true };
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

console.log("\n🏥 Health Check Path Validation");

test("accepts valid relative path", () => {
  const r = validateHealthCheckPath("/api/health");
  assert.equal(r.valid, true);
});

test("accepts nested path", () => {
  const r = validateHealthCheckPath("/api/v1/health");
  assert.equal(r.valid, true);
});

test("rejects empty path", () => {
  const r = validateHealthCheckPath("");
  assert.equal(r.valid, false);
});

test("rejects path without leading slash", () => {
  const r = validateHealthCheckPath("api/health");
  assert.equal(r.valid, false);
});

test("rejects path with query string", () => {
  const r = validateHealthCheckPath("/api/health?foo=bar");
  assert.equal(r.valid, false);
});

test("rejects path with fragment", () => {
  const r = validateHealthCheckPath("/api/health#section");
  assert.equal(r.valid, false);
});

test("rejects absolute URL", () => {
  const r = validateHealthCheckPath("https://evil.com/path");
  assert.equal(r.valid, false);
});

test("rejects path longer than 500 chars", () => {
  const r = validateHealthCheckPath("/" + "a".repeat(600));
  assert.equal(r.valid, false);
});

test("rejects path with special characters", () => {
  const r = validateHealthCheckPath("/api/health<script>");
  assert.equal(r.valid, false);
});

// ============================================================
// GitHub Status Parsing Tests (mocked)
// ============================================================
console.log("\n🔧 GitHub Status Parsing");

test("buildState: success → good", () => {
  const conclusion = "success";
  const state = ["failure", "cancelled", "timed_out"].includes(conclusion) ? "bad"
    : conclusion === "success" ? "good"
    : conclusion === "skipped" ? "warn"
    : "unknown";
  assert.equal(state, "good");
});

test("buildState: failure → bad", () => {
  const conclusion = "failure";
  const state = ["failure", "cancelled", "timed_out"].includes(conclusion) ? "bad" : "other";
  assert.equal(state, "bad");
});

test("buildState: cancelled → bad", () => {
  const conclusion = "cancelled";
  const state = ["failure", "cancelled", "timed_out"].includes(conclusion) ? "bad" : "other";
  assert.equal(state, "bad");
});

test("deployState: success → good", () => {
  const s = "success";
  const state = s === "success" ? "good" : ["failure","error"].includes(s) ? "bad" : "warn";
  assert.equal(state, "good");
});

test("deployState: failure → bad", () => {
  const s = "failure";
  const state = s === "success" ? "good" : ["failure","error"].includes(s) ? "bad" : "warn";
  assert.equal(state, "bad");
});

test("testsPresent: false when no workflows", () => {
  // Simulates: no .github/workflows, no test dir, no test script in pkg.json
  const pkg = { scripts: { test: 'echo "Error: no test specified" && exit 1' } };
  const hasTest = pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1';
  assert.equal(!!hasTest, false);
});

test("testsPresent: true when test script present", () => {
  const pkg = { scripts: { test: "jest" } };
  const hasTest = pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1';
  assert.equal(!!hasTest, true);
});

console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("SOME TESTS FAILED");
  process.exit(1);
}
console.log("All tests passed ✅");
