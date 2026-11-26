/**
 * Unit Tests: First-Run Checklist
 * Tests new user state, existing user incomplete steps, skipping optional steps, and dismissal.
 */

import assert from "node:assert/strict";

function evaluateChecklist(steps, skippedIds, dismissed) {
  if (dismissed) return { visible: false, allDone: false, remaining: 0 };
  const evaluated = steps.map((s) => ({
    ...s,
    skipped: s.optional && skippedIds.includes(s.id),
  }));
  const remaining = evaluated.filter((s) => !s.completed && !s.skipped).length;
  return { visible: true, allDone: remaining === 0, remaining };
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

console.log("\n✅ First-Run Checklist Tests");

const baseSteps = [
  { id: "add_app", optional: false, completed: false },
  { id: "email_alerts", optional: false, completed: false },
  { id: "verify_domain", optional: true, completed: false },
  { id: "error_snippet", optional: true, completed: false },
];

test("new user sees all incomplete steps", () => {
  const r = evaluateChecklist(baseSteps, [], false);
  assert.equal(r.visible, true);
  assert.equal(r.remaining, 4);
  assert.equal(r.allDone, false);
});

test("existing user with app + email sees only remaining optional steps", () => {
  const steps = baseSteps.map((s) =>
    s.id === "add_app" || s.id === "email_alerts" ? { ...s, completed: true } : s
  );
  const r = evaluateChecklist(steps, [], false);
  assert.equal(r.remaining, 2);
});

test("skipping optional steps marks checklist allDone", () => {
  const steps = baseSteps.map((s) =>
    s.id === "add_app" || s.id === "email_alerts" ? { ...s, completed: true } : s
  );
  const r = evaluateChecklist(steps, ["verify_domain", "error_snippet"], false);
  assert.equal(r.allDone, true);
  assert.equal(r.remaining, 0);
});

test("dismissed checklist stays hidden", () => {
  const r = evaluateChecklist(baseSteps, [], true);
  assert.equal(r.visible, false);
});

console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("All tests passed ✅");
