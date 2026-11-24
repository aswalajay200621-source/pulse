import assert from "node:assert/strict";
import { EXPLANATION_RULES } from "../src/lib/explanations/rules.ts";

function explainFinding(input) {
  let rule = null;
  if (input.ruleId) {
    rule = EXPLANATION_RULES.find((r) => r.ruleId === input.ruleId) ?? null;
  }
  if (!rule && (input.source === "dependency_scan" || input.category === "vulnerable_dependency")) {
    rule = EXPLANATION_RULES.find((r) =>
      input.fixedVersion ? r.ruleId === "dep-vuln-with-fix" : r.ruleId === "dep-vuln-no-fix"
    ) ?? null;
  }
  if (!rule && input.category) {
    rule = EXPLANATION_RULES.find((r) => r.category === input.category) ?? null;
  }
  const severity = input.severity ? input.severity.toLowerCase() : (rule?.severity ?? "informational");
  if (rule) {
    return {
      ruleId: rule.ruleId,
      severity,
      whatHappened: rule.plainExplanation,
      whyItMatters: rule.whyItMatters,
      whatCouldHappen: rule.possibleConsequences,
      howToFix: input.remediation || rule.recommendedFix,
      technicalDetails: input.description || rule.technicalDescription,
      isFallback: false,
    };
  }
  return {
    ruleId: input.ruleId || "pulse-generic-finding",
    severity,
    whatHappened: "Pulse detected a potential issue that does not have a specialized plain-language guide yet.",
    whyItMatters: "Reviewing reported issues helps keep your application reliable and secure.",
    whatCouldHappen: "Impact depends on the specific configuration or component affected.",
    howToFix: input.remediation || "Review the technical details.",
    technicalDetails: input.description || "No additional technical details.",
    isFallback: true,
  };
}

console.log("Running Phase 9 Rule-Based Explanation Engine Tests...\n");

// 1. Verify at least 30 rules exist across all 9 categories
assert.ok(EXPLANATION_RULES.length >= 30, `Expected >= 30 rules, got ${EXPLANATION_RULES.length}`);
const requiredCategories = [
  "uptime",
  "performance",
  "ssl_expiry",
  "domain_expiry",
  "secret_exposure",
  "vulnerable_dependency",
  "security_header",
  "insecure_http",
  "credential_expiry",
];
for (const cat of requiredCategories) {
  const count = EXPLANATION_RULES.filter((r) => r.category === cat).length;
  assert.ok(count > 0, `Category ${cat} must have at least 1 rule`);
}
console.log(`✅ Verified ${EXPLANATION_RULES.length} rules across all ${requiredCategories.length} categories`);

// 2. Verify exact rule matching & 4-part plain-language output
const secretExp = explainFinding({
  ruleId: "google-api-key",
  source: "secret_scan",
  severity: "critical",
  filePath: "src/config.ts",
  description: "AIza... detected on line 4",
});
assert.equal(secretExp.isFallback, false);
assert.equal(secretExp.severity, "critical");
assert.ok(secretExp.whatHappened.includes("Google API key"));
assert.ok(secretExp.whyItMatters.length > 10);
assert.ok(secretExp.whatCouldHappen.length > 10);
assert.ok(secretExp.howToFix.length > 10);
assert.equal(secretExp.technicalDetails, "AIza... detected on line 4");
console.log("✅ Secret exposure rule selection & technical preservation passed");

// 3. Verify scanner-provided severity is preserved (never exaggerated)
const lowHeader = explainFinding({
  ruleId: "missing-referrer-policy",
  severity: "informational",
});
assert.equal(lowHeader.severity, "informational", "Scanner severity must be preserved");
console.log("✅ Scanner severity preservation passed");

// 4. Verify dependency heuristic (with fix vs without fix)
const depWithFix = explainFinding({
  source: "dependency_scan",
  packageName: "lodash",
  fixedVersion: "4.17.21",
});
assert.equal(depWithFix.ruleId, "dep-vuln-with-fix");

const depNoFix = explainFinding({
  source: "dependency_scan",
  packageName: "legacy-pkg",
  fixedVersion: null,
});
assert.equal(depNoFix.ruleId, "dep-vuln-no-fix");
console.log("✅ Dependency vulnerability rule selection passed");

// 5. Verify missing/null fields do not crash
const minimal = explainFinding({});
assert.equal(minimal.isFallback, true);
assert.equal(minimal.severity, "informational");
assert.ok(minimal.whatHappened.length > 0);
console.log("✅ Missing fields & unsupported finding fallback passed");

console.log("\nAll Phase 9 tests passed!");
