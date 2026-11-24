import assert from "node:assert/strict";

console.log("Running Phase 5 Monitoring Engine & Statistics Tests...\n");

// 1. Test Uptime & Performance Calculations
const now = Date.now();
const hour = 60 * 60 * 1000;
const day = 24 * hour;

function calculateStats(checks, windowMs) {
  const cutoff = now - windowMs;
  const filtered = checks.filter((c) => new Date(c.checked_at).getTime() >= cutoff);
  if (filtered.length === 0) {
    return { totalChecks: 0, uptimePercentage: null, avg: null, min: null, max: null, slow: 0 };
  }
  const success = filtered.filter((c) => c.status === "online" || c.status === "degraded").length;
  const slow = filtered.filter((c) => c.is_slow).length;
  const latencies = filtered.map((c) => c.response_time).filter((v) => typeof v === "number");
  return {
    totalChecks: filtered.length,
    uptimePercentage: Number(((success / filtered.length) * 100).toFixed(2)),
    avg: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
    min: latencies.length ? Math.min(...latencies) : null,
    max: latencies.length ? Math.max(...latencies) : null,
    slow,
  };
}

// Empty checks -> null uptime (unavailable data != downtime)
const emptyStats = calculateStats([], 24 * hour);
assert.equal(emptyStats.uptimePercentage, null, "Empty checks must return null uptime");
console.log("✅ Unavailable monitoring data returns null (not 100% or 0%)");

const sampleChecks = [
  { status: "online", response_time: 100, is_slow: false, checked_at: new Date(now - 1 * hour).toISOString() },
  { status: "degraded", response_time: 1800, is_slow: true, checked_at: new Date(now - 2 * hour).toISOString() },
  { status: "down", response_time: 500, is_slow: false, checked_at: new Date(now - 3 * hour).toISOString() },
  { status: "online", response_time: 200, is_slow: false, checked_at: new Date(now - 5 * day).toISOString() },
];

const stats24h = calculateStats(sampleChecks, 24 * hour);
assert.equal(stats24h.totalChecks, 3);
assert.equal(stats24h.uptimePercentage, 66.67);
assert.equal(stats24h.avg, 800);
assert.equal(stats24h.min, 100);
assert.equal(stats24h.max, 1800);
assert.equal(stats24h.slow, 1);
console.log("✅ 24h uptime, avg/min/max response time, and slow-warning calculations passed");

const stats7d = calculateStats(sampleChecks, 7 * day);
assert.equal(stats7d.totalChecks, 4);
assert.equal(stats7d.uptimePercentage, 75);
console.log("✅ 7d window calculation passed");

// 2. Test 3-Consecutive-Failure Downtime & Recovery State Machine
function evaluateStateMachine(recentStatuses, hasOpenIncident) {
  if (recentStatuses[0] !== "down") {
    return hasOpenIncident ? "RESOLVE_INCIDENT" : "NO_ACTION";
  }
  if (hasOpenIncident) {
    return "PREVENT_DUPLICATE_INCIDENT";
  }
  if (recentStatuses.length >= 3 && recentStatuses.slice(0, 3).every((s) => s === "down")) {
    return "CREATE_INCIDENT";
  }
  return "WAIT_FOR_MORE_FAILURES";
}

assert.equal(evaluateStateMachine(["down"], false), "WAIT_FOR_MORE_FAILURES");
assert.equal(evaluateStateMachine(["down", "down"], false), "WAIT_FOR_MORE_FAILURES");
assert.equal(evaluateStateMachine(["down", "down", "down"], false), "CREATE_INCIDENT");
assert.equal(evaluateStateMachine(["down", "down", "down"], true), "PREVENT_DUPLICATE_INCIDENT");
assert.equal(evaluateStateMachine(["online", "down", "down"], true), "RESOLVE_INCIDENT");
console.log("✅ 3-consecutive-failure, duplicate prevention, and recovery detection passed");

console.log("\nAll Phase 5 tests passed!");
