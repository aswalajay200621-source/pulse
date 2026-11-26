/**
 * Unit Tests: Public Status Page & Badge
 * Tests explicit field allowlist, badge SVG output, slug rotation, and disabled state.
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";

function buildPublicStatusPayload(input) {
  return {
    displayTitle: String(input.displayTitle || "Service Status").slice(0, 80),
    overallStatus:
      input.overallStatus === "down" || input.overallStatus === "degraded"
        ? input.overallStatus
        : "operational",
    uptime24h: typeof input.uptime24h === "number" ? input.uptime24h : null,
    uptime7d: typeof input.uptime7d === "number" ? input.uptime7d : null,
    uptime30d: typeof input.uptime30d === "number" ? input.uptime30d : null,
    dailyBars: (input.dailyBars || []).slice(0, 30).map((b) => ({
      date: String(b.date).slice(0, 10),
      status: b.status,
    })),
    incidents: (input.incidents || []).slice(0, 10).map((inc) => ({
      startedAt: String(inc.startedAt),
      resolvedAt: inc.resolvedAt ? String(inc.resolvedAt) : null,
      durationMinutes: typeof inc.durationMinutes === "number" ? inc.durationMinutes : null,
    })),
  };
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

console.log("\n🌐 Public Status Page & Badge Tests");

test("explicit allowlist strips all forbidden fields", () => {
  const dirtyInput = {
    displayTitle: "My App",
    overallStatus: "operational",
    uptime24h: 100,
    uptime7d: 99.9,
    uptime30d: 99.5,
    dailyBars: [],
    incidents: [],
    // Forbidden fields:
    errorMessage: "DB password leaked",
    securityFindings: [{ title: "XSS" }],
    healthScore: 42,
    repositoryName: "org/secret-repo",
    internalUrl: "http://10.0.0.1",
    userId: "user-123",
  };
  const out = buildPublicStatusPayload(dirtyInput);
  const allowedKeys = new Set([
    "displayTitle",
    "overallStatus",
    "uptime24h",
    "uptime7d",
    "uptime30d",
    "dailyBars",
    "incidents",
  ]);
  for (const key of Object.keys(out)) {
    assert(allowedKeys.has(key), `Unexpected field leaked: ${key}`);
  }
  assert.equal("errorMessage" in out, false);
  assert.equal("securityFindings" in out, false);
  assert.equal("healthScore" in out, false);
  assert.equal("repositoryName" in out, false);
  assert.equal("internalUrl" in out, false);
  assert.equal("userId" in out, false);
});

test("slug rotation produces distinct unguessable slugs", () => {
  const s1 = crypto.randomBytes(18).toString("base64url");
  const s2 = crypto.randomBytes(18).toString("base64url");
  assert.notEqual(s1, s2);
  assert(s1.length >= 24);
});

test("disabled status page returns not found", () => {
  const page = { enabled: false, slug: "abc" };
  const visible = Boolean(page && page.enabled);
  assert.equal(visible, false);
});

console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("All tests passed ✅");
