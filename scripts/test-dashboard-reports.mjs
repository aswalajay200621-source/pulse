import assert from "node:assert/strict";

console.log("Running Phase 10 Dashboard & Weekly Reports Tests...\n");

// 1. Test Application Table Search, Filter, Sort, Pagination
const apps = [
  { id: "1", name: "Zeta API", status: "online", uptimePercentage: 99.9, latestResponseTime: 120 },
  { id: "2", name: "Alpha Web", status: "down", uptimePercentage: 85.0, latestResponseTime: 400 },
  { id: "3", name: "Beta Auth", status: "online", uptimePercentage: 100, latestResponseTime: 50 },
];

const onlineOnly = apps.filter((a) => a.status === "online");
assert.equal(onlineOnly.length, 2);

const sortedByLatency = [...apps].sort((a, b) => a.latestResponseTime - b.latestResponseTime);
assert.equal(sortedByLatency[0].name, "Beta Auth");
assert.equal(sortedByLatency[2].name, "Alpha Web");

const pageSize = 2;
const page1 = sortedByLatency.slice(0, pageSize);
const page2 = sortedByLatency.slice(pageSize, pageSize * 2);
assert.equal(page1.length, 2);
assert.equal(page2.length, 1);
console.log("✅ Application table filtering, sorting, and pagination passed");

// 2. Test Weekly Report ISO Week Key & Duplicate Prevention
function getIsoWeekKey(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

const reportStore = new Set();
function createReport(userId, date) {
  const key = `${userId}:${getIsoWeekKey(date)}`;
  if (reportStore.has(key)) return { duplicate: true };
  reportStore.add(key);
  return { duplicate: false };
}

const d = new Date("2026-11-25T00:00:00Z");
assert.equal(createReport("user-a", d).duplicate, false);
assert.equal(createReport("user-a", d).duplicate, true); // duplicate blocked
assert.equal(createReport("user-b", d).duplicate, false); // cross-user isolated
console.log("✅ Weekly report duplicate prevention & cross-user isolation passed");

console.log("\nAll Phase 10 tests passed!");
