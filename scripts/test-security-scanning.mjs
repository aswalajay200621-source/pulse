import assert from "node:assert/strict";

console.log("Running Phase 8 Security Scanning Engine Tests...\n");

// ============================================================================
// 1. Secret Scanner – pattern detection and masking
// ============================================================================

function maskSecret(value) {
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}${"*".repeat(Math.max(4, value.length - 8))}${value.slice(-4)}`;
}

// 1a. AWS Access Key pattern
const AWS_PATTERN = /(?<![A-Z0-9])(AKIA|ASIA|AROA|AIDA)[A-Z0-9]{16}(?![A-Z0-9])/g;
const awsContent = `const key = "AKIAIOSFODNN7EXAMPLE";`;
const awsMatch = [...awsContent.matchAll(AWS_PATTERN)];
assert.ok(awsMatch.length > 0, "AWS access key should be detected");
assert.equal(maskSecret("AKIAIOSFODNN7EXAMPLE").includes("****"), true, "Secret should be masked");
console.log("✅ AWS Access Key pattern detection and masking passed");

// 1b. GitHub PAT
const GH_PATTERN = /\b(ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82})\b/g;
const ghContent = `token = "ghp_abcdefghijklmnopqrstuvwxyz1234567890"`;
const ghMatch = [...ghContent.matchAll(GH_PATTERN)];
assert.ok(ghMatch.length > 0, "GitHub token should be detected");
console.log("✅ GitHub PAT pattern detection passed");

// 1c. Synthetic non-secret should NOT match
const safeContent = `const myValue = "hello world";`;
const awsSafe = [...safeContent.matchAll(AWS_PATTERN)];
assert.equal(awsSafe.length, 0, "Safe content should not match secret patterns");
console.log("✅ False positive suppression passed (safe content not flagged)");

// 1d. PEM private key header
const PEM_PATTERN = /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g;
const pemContent = `-----BEGIN RSA PRIVATE KEY-----\nMIIEo...`;
assert.ok(pemContent.match(PEM_PATTERN), "PEM private key header should be detected");
console.log("✅ PEM private key detection passed");

// ============================================================================
// 2. Manifest Parsing – simulated
// ============================================================================

function parsePackageJson(content) {
  try {
    const pkg = JSON.parse(content);
    const deps = [];
    for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
      const v = String(version).replace(/^[\^~>=<]/, "").split(" ")[0];
      if (v && v !== "*") deps.push({ name, version: v, ecosystem: "npm" });
    }
    return deps;
  } catch { return []; }
}

const pkgJson = JSON.stringify({
  dependencies: { lodash: "^4.17.11", axios: "0.21.1" },
  devDependencies: { typescript: "~5.0.0" },
});
const parsed = parsePackageJson(pkgJson);
assert.equal(parsed.length, 3);
assert.ok(parsed.find((p) => p.name === "lodash" && p.version === "4.17.11"));
assert.ok(parsed.find((p) => p.name === "axios" && p.version === "0.21.1"));
console.log("✅ package.json dependency parsing passed (3 packages, semver prefixes stripped)");

// Invalid JSON: should return empty array
const badPkg = parsePackageJson("not json");
assert.equal(badPkg.length, 0);
console.log("✅ Malformed manifest returns empty array (no crash)");

// ============================================================================
// 3. Deduplication – finding key uniqueness
// ============================================================================

const seenKeys = new Set();
function upsertFinding(findingKey) {
  if (seenKeys.has(findingKey)) return "duplicate";
  seenKeys.add(findingKey);
  return "new";
}

assert.equal(upsertFinding("secret:aws-access-key:src/index.ts:12"), "new");
assert.equal(upsertFinding("secret:aws-access-key:src/index.ts:12"), "duplicate");
assert.equal(upsertFinding("secret:aws-access-key:src/config.ts:5"), "new");
assert.equal(upsertFinding("header:missing-hsts"), "new");
assert.equal(upsertFinding("header:missing-hsts"), "duplicate");
console.log("✅ Finding key deduplication passed (same finding blocked, different locations allowed)");

// ============================================================================
// 4. Severity mapping
// ============================================================================

function cvssToSeverity(score) {
  if (score === null) return null;
  if (score >= 9.0) return "critical";
  if (score >= 7.0) return "high";
  if (score >= 4.0) return "medium";
  return "low";
}

assert.equal(cvssToSeverity(9.8), "critical");
assert.equal(cvssToSeverity(7.5), "high");
assert.equal(cvssToSeverity(5.0), "medium");
assert.equal(cvssToSeverity(2.0), "low");
assert.equal(cvssToSeverity(null), null);
console.log("✅ CVSS to severity mapping passed (never invents severity for null)");

// ============================================================================
// 5. Scan idempotency key
// ============================================================================

function getScanIdempotencyKey(appId, hourBucket) {
  return `scan-${appId}-${hourBucket}`;
}

const key1 = getScanIdempotencyKey("app-123", 500000);
const key2 = getScanIdempotencyKey("app-123", 500000);
const key3 = getScanIdempotencyKey("app-456", 500000);
assert.equal(key1, key2, "Same app same hour should produce identical idempotency key");
assert.notEqual(key1, key3, "Different apps should have different keys");
console.log("✅ Scan idempotency key logic passed");

console.log("\nAll Phase 8 tests passed!");
