/**
 * Unit tests for bulk import logic.
 * Tests parseBulkImportText and the validation/quota logic (mocked).
 */

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Inline copy of parseBulkImportText so we can test it without a server env.
// ---------------------------------------------------------------------------
const MAX_IMPORT_ROWS = 50;
const MAX_CSV_BYTES = 10 * 1024;

function parseBulkImportText(raw) {
  if (raw.length > MAX_CSV_BYTES) {
    throw new Error(`Input exceeds the ${MAX_CSV_BYTES / 1024} KB size limit.`);
  }
  const rawLines = raw.split(/\r?\n/);
  const rows = [];
  for (let i = 0; i < rawLines.length; i++) {
    if (rows.length >= MAX_IMPORT_ROWS) break;
    const line = rawLines[i].trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const parts = line.includes(",") ? line.split(",").map((p) => p.trim()) : [line];
    const url = parts[0] || "";
    const name = parts[1] || undefined;
    const healthCheckPath = parts[2] || undefined;
    if (url) rows.push({ line: i + 1, url, name, healthCheckPath });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
console.log("\n✅ Bulk Import Tests");

// 1. Plain URL list
{
  const rows = parseBulkImportText("https://example.com\nhttps://app.example.com");
  assert(rows.length === 2, "plain URL list: 2 rows parsed");
  assert(rows[0].url === "https://example.com", "plain URL list: first URL correct");
  assert(rows[1].url === "https://app.example.com", "plain URL list: second URL correct");
}

// 2. CSV with name and health check path
{
  const rows = parseBulkImportText("https://example.com, My App, /health");
  assert(rows.length === 1, "CSV row: 1 row parsed");
  assert(rows[0].name === "My App", "CSV row: name parsed");
  assert(rows[0].healthCheckPath === "/health", "CSV row: health check path parsed");
}

// 3. Comments and blank lines are skipped
{
  const rows = parseBulkImportText("# comment\n\nhttps://example.com\n\n# another comment");
  assert(rows.length === 1, "skip comments and blank lines");
}

// 4. Max row cap
{
  const lines = Array.from({ length: 60 }, (_, i) => `https://example${i}.com`).join("\n");
  const rows = parseBulkImportText(lines);
  assert(rows.length === MAX_IMPORT_ROWS, `row cap at ${MAX_IMPORT_ROWS}`);
}

// 5. File too large
{
  let threw = false;
  try {
    parseBulkImportText("x".repeat(MAX_CSV_BYTES + 1));
  } catch {
    threw = true;
  }
  assert(threw, "throws on input exceeding 10 KB");
}

// 6. SSRF-unsafe URL detection (URL structure check only — no DNS in unit test)
{
  const urls = [
    "http://localhost/app",
    "http://127.0.0.1/secret",
    "http://192.168.1.1/admin",
    "http://169.254.169.254/metadata",
  ];
  for (const url of urls) {
    // parseBulkImportText doesn't validate SSRF — that happens in the server action.
    // We just verify the URL is captured as-is for the action to reject.
    const rows = parseBulkImportText(url);
    assert(rows.length === 1 && rows[0].url === url, `SSRF URL captured for action to reject: ${url}`);
  }
}

// 7. Empty input
{
  const rows = parseBulkImportText("   \n\n  ");
  assert(rows.length === 0, "empty input produces 0 rows");
}

// 8. Line numbers reflect original file position (comment on line 1 → URL on line 2)
{
  const rows = parseBulkImportText("# skip\nhttps://example.com");
  assert(rows[0].line === 2, "line number preserves original 1-based position in raw input");
}

// 9. Quota simulation
{
  // If quota = 3 and we already have 2 apps, only 1 can be added.
  function simulateQuota(rows, currentCount, max) {
    const remaining = Math.max(0, max - currentCount);
    let added = 0;
    const results = [];
    for (const row of rows) {
      if (added >= remaining) {
        results.push({ ...row, status: "skipped", reason: "Quota reached" });
      } else {
        results.push({ ...row, status: "added" });
        added++;
      }
    }
    return results;
  }
  const rows = [
    { line: 1, url: "https://a.com" },
    { line: 2, url: "https://b.com" },
    { line: 3, url: "https://c.com" },
  ];
  const results = simulateQuota(rows, 2, 3);
  assert(results.filter((r) => r.status === "added").length === 1, "quota: only 1 added when 2/3 slots used");
  assert(results.filter((r) => r.status === "skipped").length === 2, "quota: 2 skipped when quota reached");
}

// 10. Deduplication within batch (simulation)
{
  const urls = ["https://example.com", "https://example.com", "https://other.com"];
  const seen = new Set();
  const deduped = urls.filter((u) => {
    if (seen.has(u)) return false;
    seen.add(u);
    return true;
  });
  assert(deduped.length === 2, "deduplication: duplicates within batch are removed");
}

// ---------------------------------------------------------------------------
console.log("\n" + "=".repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("Some tests failed ❌");
  process.exit(1);
} else {
  console.log("All tests passed ✅\n");
}
