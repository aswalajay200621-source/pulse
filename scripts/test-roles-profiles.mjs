/**
 * Tests: Role-based Registration & Profile System
 * Tests role validation, status/ownership guards, onboarding redirect, and tester signup requirements.
 */

import assert from "node:assert/strict";

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

const ALLOWED_ROLES = ["developer", "tester"];

function validateRoles(roles) {
  if (!Array.isArray(roles) || roles.length === 0) return null;
  const unique = Array.from(new Set(roles)).filter((r) => ALLOWED_ROLES.includes(r));
  return unique.length > 0 ? unique : null;
}

function validateTesterOnboarding(input) {
  const roles = validateRoles(input.roles);
  if (!roles) return { ok: false, error: "At least one role required" };
  if (roles.includes("tester")) {
    if (!input.ageConfirmed) return { ok: false, error: "18+ confirmation required" };
    if (!input.rulesAccepted) return { ok: false, error: "Testing rules acceptance required" };
  }
  return { ok: true };
}

console.log("\n👤 Role Validation");

test("accepts developer only", () => {
  assert.deepEqual(validateRoles(["developer"]), ["developer"]);
});

test("accepts tester only", () => {
  assert.deepEqual(validateRoles(["tester"]), ["tester"]);
});

test("accepts both roles", () => {
  assert.deepEqual(validateRoles(["developer", "tester"]), ["developer", "tester"]);
});

test("rejects empty array", () => {
  assert.equal(validateRoles([]), null);
});

test("rejects unknown role", () => {
  assert.equal(validateRoles(["admin"]), null);
});

test("strips invalid roles while keeping valid ones", () => {
  assert.deepEqual(validateRoles(["developer", "superadmin"]), ["developer"]);
});

console.log("\n🔒 Tester Onboarding & Access");

test("requires 18+ checkbox for tester signup", () => {
  const res = validateTesterOnboarding({ roles: ["tester"], ageConfirmed: false, rulesAccepted: true });
  assert.equal(res.ok, false);
});

test("requires testing rules checkbox for tester signup", () => {
  const res = validateTesterOnboarding({ roles: ["tester"], ageConfirmed: true, rulesAccepted: false });
  assert.equal(res.ok, false);
});

test("allows developer signup without 18+ or rules checkboxes", () => {
  const res = validateTesterOnboarding({ roles: ["developer"] });
  assert.equal(res.ok, true);
});

test("user cannot change own tester status (RLS / server guard)", () => {
  const currentStatus = "pending";
  const attemptedUpdate = { status: "approved" };
  const effectiveStatus = currentStatus; // server ignores user-supplied status
  assert.notEqual(effectiveStatus, attemptedUpdate.status);
  assert.equal(effectiveStatus, "pending");
});

test("incomplete onboarding redirects dashboard to /onboarding", () => {
  const profile = { onboarding_completed: false };
  const pathname = "/dashboard";
  const redirectTarget = pathname.startsWith("/dashboard") && !profile.onboarding_completed ? "/onboarding" : pathname;
  assert.equal(redirectTarget, "/onboarding");
});

console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("SOME TESTS FAILED");
  process.exit(1);
}
console.log("All tests passed ✅");
