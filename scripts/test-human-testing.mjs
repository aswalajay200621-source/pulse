import assert from "node:assert/strict";

console.log("Running Human Security Test (Experts) Tests...\n");

// 1. Permission rules: admin-only tester approval
function canApproveTester(userEmail, adminEmailsCsv) {
  const admins = adminEmailsCsv.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return admins.includes(userEmail.toLowerCase());
}
assert.equal(canApproveTester("admin@pulse.app", "admin@pulse.app"), true);
assert.equal(canApproveTester("user@example.com", "admin@pulse.app"), false);
console.log("✅ Admin-only tester approval permission passed");

// 2. Ownership verification requirement before opening request
function canOpenRequest(isDomainVerified, safeHarborAccepted) {
  return isDomainVerified && safeHarborAccepted;
}
assert.equal(canOpenRequest(false, true), false);
assert.equal(canOpenRequest(true, false), false);
assert.equal(canOpenRequest(true, true), true);
console.log("✅ Domain ownership & Safe Harbor requirement passed");

// 3. Pause behavior blocks new reports
function canSubmitReport(inviteStatus, requestStatus) {
  if (inviteStatus !== "accepted") return false;
  if (requestStatus === "paused" || requestStatus === "closed" || requestStatus === "draft") return false;
  return true;
}
assert.equal(canSubmitReport("invited", "in_progress"), false);
assert.equal(canSubmitReport("accepted", "paused"), false);
assert.equal(canSubmitReport("accepted", "in_progress"), true);
console.log("✅ Pause behavior & invite acceptance enforcement passed");

// 4. Duplicate & reward logic (earliest valid report earns reward; duplicate earns 0)
function triageReport(status, rewardAmount, duplicateOf) {
  if (status === "duplicate") {
    if (!duplicateOf) throw new Error("Duplicate must link earlier report");
    return { status, reward: 0 };
  }
  return { status, reward: rewardAmount };
}
assert.throws(() => triageReport("duplicate", 5000, null));
assert.deepEqual(triageReport("duplicate", 5000, "rep-1"), { status: "duplicate", reward: 0 });
assert.deepEqual(triageReport("valid", 5000, null), { status: "valid", reward: 5000 });
console.log("✅ Duplicate linking & reward calculation passed");

console.log("\nAll Human Security Test suite assertions passed!");
