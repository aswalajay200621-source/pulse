/**
 * Unit Tests: Deterministic Health Score (0-100)
 * Tests every deduction, every cap, the skipping rule, color bands, and top 3 ordering.
 */

import assert from "node:assert/strict";

const HEALTH_SCORE_CONFIG = {
  baseScore: 100,
  bands: { greenMin: 80, yellowMin: 50 },
  weights: {
    appDownNow: 40,
    uptimeBelow95: 20,
    uptimeBelow99: 10,
    sslExpired: 25,
    sslExpiring14d: 10,
    domainExpired: 20,
    domainExpiring30d: 5,
    criticalFindingEach: 15,
    criticalFindingCap: 30,
    highFindingEach: 8,
    highFindingCap: 20,
    mediumFindingEach: 3,
    mediumFindingCap: 10,
    errorGroupEach: 5,
    errorGroupCap: 15,
    buildFailing: 10,
    noAutomatedTests: 5,
    healthCheckFailing: 15,
  },
};

function getHealthBand(score) {
  if (score >= HEALTH_SCORE_CONFIG.bands.greenMin) return "green";
  if (score >= HEALTH_SCORE_CONFIG.bands.yellowMin) return "yellow";
  return "red";
}

function computeHealthScore(input) {
  const w = HEALTH_SCORE_CONFIG.weights;
  const appId = input.applicationId || "app-1";
  const deductions = [];

  if (input.isDownNow === true) {
    deductions.push({ id: "down", pointsRecovered: w.appDownNow });
  }
  if (typeof input.uptime7d === "number") {
    if (input.uptime7d < 95) deductions.push({ id: "uptime95", pointsRecovered: w.uptimeBelow95 });
    else if (input.uptime7d < 99) deductions.push({ id: "uptime99", pointsRecovered: w.uptimeBelow99 });
  }
  if (typeof input.sslDaysRemaining === "number") {
    if (input.sslDaysRemaining <= 0) deductions.push({ id: "ssl-exp", pointsRecovered: w.sslExpired });
    else if (input.sslDaysRemaining <= 14) deductions.push({ id: "ssl-14", pointsRecovered: w.sslExpiring14d });
  }
  if (typeof input.domainDaysRemaining === "number") {
    if (input.domainDaysRemaining <= 0) deductions.push({ id: "dom-exp", pointsRecovered: w.domainExpired });
    else if (input.domainDaysRemaining <= 30) deductions.push({ id: "dom-30", pointsRecovered: w.domainExpiring30d });
  }
  if (typeof input.openCriticalFindings === "number" && input.openCriticalFindings > 0) {
    deductions.push({ id: "crit", pointsRecovered: Math.min(input.openCriticalFindings * w.criticalFindingEach, w.criticalFindingCap) });
  }
  if (typeof input.openHighFindings === "number" && input.openHighFindings > 0) {
    deductions.push({ id: "high", pointsRecovered: Math.min(input.openHighFindings * w.highFindingEach, w.highFindingCap) });
  }
  if (typeof input.openMediumFindings === "number" && input.openMediumFindings > 0) {
    deductions.push({ id: "med", pointsRecovered: Math.min(input.openMediumFindings * w.mediumFindingEach, w.mediumFindingCap) });
  }
  if (typeof input.openNewOrGrowingErrors === "number" && input.openNewOrGrowingErrors > 0) {
    deductions.push({ id: "err", pointsRecovered: Math.min(input.openNewOrGrowingErrors * w.errorGroupEach, w.errorGroupCap) });
  }
  if (input.latestBuildFailing === true) {
    deductions.push({ id: "build", pointsRecovered: w.buildFailing });
  }
  if (input.testsPresent === false) {
    deductions.push({ id: "tests", pointsRecovered: w.noAutomatedTests });
  }
  if (input.healthCheckFailing === true) {
    deductions.push({ id: "hc", pointsRecovered: w.healthCheckFailing });
  }

  const total = deductions.reduce((s, d) => s + d.pointsRecovered, 0);
  const score = Math.max(0, Math.min(100, 100 - total));
  const topFixes = [...deductions].sort((a, b) => b.pointsRecovered - a.pointsRecovered).slice(0, 3);
  return { score, band: getHealthBand(score), topFixes };
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

console.log("\n💯 Health Score Tests");

test("skips missing data (unconfigured features never penalized)", () => {
  const r = computeHealthScore({ applicationId: "1" });
  assert.equal(r.score, 100);
  assert.equal(r.band, "green");
  assert.equal(r.topFixes.length, 0);
});

test("app down now deducts 40", () => {
  const r = computeHealthScore({ applicationId: "1", isDownNow: true });
  assert.equal(r.score, 60);
  assert.equal(r.band, "yellow");
});

test("uptime < 99% deducts 10, < 95% deducts 20", () => {
  assert.equal(computeHealthScore({ applicationId: "1", uptime7d: 98.5 }).score, 90);
  assert.equal(computeHealthScore({ applicationId: "1", uptime7d: 94.0 }).score, 80);
});

test("SSL expiring <= 14d deducts 10, expired <= 0d deducts 25", () => {
  assert.equal(computeHealthScore({ applicationId: "1", sslDaysRemaining: 10 }).score, 90);
  assert.equal(computeHealthScore({ applicationId: "1", sslDaysRemaining: 0 }).score, 75);
});

test("domain expiring <= 30d deducts 5, expired <= 0d deducts 20", () => {
  assert.equal(computeHealthScore({ applicationId: "1", domainDaysRemaining: 20 }).score, 95);
  assert.equal(computeHealthScore({ applicationId: "1", domainDaysRemaining: -1 }).score, 80);
});

test("security finding caps (critical 30, high 20, medium 10)", () => {
  assert.equal(computeHealthScore({ applicationId: "1", openCriticalFindings: 5 }).score, 70);
  assert.equal(computeHealthScore({ applicationId: "1", openHighFindings: 5 }).score, 80);
  assert.equal(computeHealthScore({ applicationId: "1", openMediumFindings: 10 }).score, 90);
});

test("open error groups cap at 15", () => {
  assert.equal(computeHealthScore({ applicationId: "1", openNewOrGrowingErrors: 10 }).score, 85);
});

test("build failing (-10), no tests (-5), health check failing (-15)", () => {
  const r = computeHealthScore({
    applicationId: "1",
    latestBuildFailing: true,
    testsPresent: false,
    healthCheckFailing: true,
  });
  assert.equal(r.score, 70);
});

test("score clamps to 0 and band is red below 50", () => {
  const r = computeHealthScore({
    applicationId: "1",
    isDownNow: true,
    uptime7d: 50,
    sslDaysRemaining: 0,
    domainDaysRemaining: 0,
    openCriticalFindings: 5,
  });
  assert.equal(r.score, 0);
  assert.equal(r.band, "red");
});

test("top 3 fixes ordered by largest pointsRecovered", () => {
  const r = computeHealthScore({
    applicationId: "1",
    isDownNow: true,         // 40
    sslDaysRemaining: 0,     // 25
    healthCheckFailing: true,// 15
    latestBuildFailing: true,// 10
    testsPresent: false,     // 5
  });
  assert.equal(r.topFixes.length, 3);
  assert.equal(r.topFixes[0].pointsRecovered, 40);
  assert.equal(r.topFixes[1].pointsRecovered, 25);
  assert.equal(r.topFixes[2].pointsRecovered, 15);
});

console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("All tests passed ✅");
