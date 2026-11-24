import assert from "node:assert/strict";

console.log("Running Phase 7 Expiry Monitoring Tests...\n");

const now = Date.now();
const dayMs = 24 * 60 * 60 * 1000;

function computeExpiryStatus(expiryDateIso, nowMs = now) {
  if (!expiryDateIso) return { status: "unknown", daysRemaining: null };
  const expiryMs = new Date(expiryDateIso).getTime();
  if (Number.isNaN(expiryMs)) return { status: "unknown", daysRemaining: null };
  const daysRemaining = Math.ceil((expiryMs - nowMs) / dayMs);
  if (daysRemaining <= 0) return { status: "expired", daysRemaining };
  if (daysRemaining <= 30) return { status: "expiring_soon", daysRemaining };
  return { status: "healthy", daysRemaining };
}

function determineThreshold(daysRemaining) {
  if (daysRemaining === null) return null;
  if (daysRemaining <= 0) return "expired";
  if (daysRemaining <= 1) return "1d";
  if (daysRemaining <= 7) return "7d";
  if (daysRemaining <= 30) return "30d";
  return null;
}

// 1. Valid certificate (> 30 days)
const healthy = computeExpiryStatus(new Date(now + 60 * dayMs).toISOString());
assert.equal(healthy.status, "healthy");
assert.equal(determineThreshold(healthy.daysRemaining), null);
console.log("✅ Healthy certificate (>30d) passed");

// 2. Expiring soon (7d, 1d, 30d)
const exp30 = computeExpiryStatus(new Date(now + 25 * dayMs).toISOString());
assert.equal(exp30.status, "expiring_soon");
assert.equal(determineThreshold(exp30.daysRemaining), "30d");

const exp7 = computeExpiryStatus(new Date(now + 5 * dayMs).toISOString());
assert.equal(exp7.status, "expiring_soon");
assert.equal(determineThreshold(exp7.daysRemaining), "7d");

const exp1 = computeExpiryStatus(new Date(now + 1 * dayMs).toISOString());
assert.equal(exp1.status, "expiring_soon");
assert.equal(determineThreshold(exp1.daysRemaining), "1d");
console.log("✅ Reminder thresholds (30d, 7d, 1d) passed");

// 3. Expired certificate
const expired = computeExpiryStatus(new Date(now - 2 * dayMs).toISOString());
assert.equal(expired.status, "expired");
assert.equal(determineThreshold(expired.daysRemaining), "expired");
console.log("✅ Expired certificate detection passed");

// 4. Unknown / missing RDAP data
const unknown = computeExpiryStatus(null);
assert.equal(unknown.status, "unknown");
assert.equal(unknown.daysRemaining, null);
console.log("✅ Missing RDAP data returns unknown (never guessed)");

// 5. Duplicate reminder prevention & recalculation on date change
const sentSnapshots = new Set();
function trySendReminder(itemId, threshold, expiryIso) {
  const key = `${itemId}:${threshold}:${expiryIso}`;
  if (sentSnapshots.has(key)) return false;
  sentSnapshots.add(key);
  return true;
}

const date1 = new Date(now + 5 * dayMs).toISOString();
const date2 = new Date(now + 6 * dayMs).toISOString();
assert.equal(trySendReminder("item-1", "7d", date1), true);
assert.equal(trySendReminder("item-1", "7d", date1), false); // duplicate blocked
assert.equal(trySendReminder("item-1", "7d", date2), true); // recalculated on date change
console.log("✅ Duplicate reminder prevention & date-change recalculation passed");

console.log("\nAll Phase 7 tests passed!");
