/**
 * Unit tests for Protection Levels & Secret Guard.
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
// 1. Secret Guard tests (inline mirror of secret-guard.ts patterns)
// ---------------------------------------------------------------------------
const SECRET_GUARD_MESSAGE =
  "This looks like a private key or secret. Pulse never needs it. Please remove it.";

const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/, // AWS Access Key
  /ghp_[A-Za-z0-9]{20,}/, // GitHub PAT
  /sk_live_[A-Za-z0-9]{16,}/, // Stripe live key
  /AIza[0-9A-Za-z_-]{35}/, // Google API key
  /(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis|rediss):\/\/[^\s'"]+/i,
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/i,
  /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, // JWT
];

function validateNoSecrets(value) {
  if (!value || typeof value !== "string") return { safe: true };
  const trimmed = value.trim();
  if (!trimmed) return { safe: true };
  for (const p of SECRET_PATTERNS) {
    if (p.test(trimmed)) return { safe: false, error: SECRET_GUARD_MESSAGE };
  }
  return { safe: true };
}

console.log("\n🛡️ Protection Levels & Secret Guard Tests");

// Secret guard rejections
assert(
  validateNoSecrets("postgres://user:pass@db.example.com:5432/prod").safe === false,
  "secret guard rejects PostgreSQL connection string"
);
assert(
  validateNoSecrets("-----BEGIN RSA PRIVATE KEY-----\nMIIE...").safe === false,
  "secret guard rejects PEM private key"
);
assert(
  validateNoSecrets("ghp_1234567890abcdefghij1234567890").safe === false,
  "secret guard rejects GitHub PAT"
);
assert(
  validateNoSecrets("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123def456").safe === false,
  "secret guard rejects JWT"
);

// Secret guard accepts normal text
assert(
  validateNoSecrets("/api/health").safe === true,
  "secret guard accepts normal health check path"
);
assert(
  validateNoSecrets("Welcome back").safe === true,
  "secret guard accepts normal expected text"
);

// ---------------------------------------------------------------------------
// 2. Protection level status detection tests
// ---------------------------------------------------------------------------
function computeStatuses(input) {
  const now = input.now ?? new Date();
  const thirtyDaysAgoMs = now.getTime() - 30 * 24 * 60 * 60 * 1000;

  const l1 = input.hasUrl ? "connected" : "not_connected";
  const l2 = input.domainVerifiedAt ? "connected" : "not_connected";

  let l3 = "not_connected";
  if (input.healthCheckEnabled && input.healthCheckPath) {
    l3 = input.lastHealthCheckOk === false ? "needs_attention" : "connected";
  }

  let l4 = "not_connected";
  if (input.hasActiveIngestKey) {
    if (!input.lastErrorEventAt || new Date(input.lastErrorEventAt).getTime() < thirtyDaysAgoMs) {
      l4 = "needs_attention";
    } else {
      l4 = "connected";
    }
  }

  let l5 = "not_connected";
  if (input.hasGithubRepo) {
    l5 = input.githubLastBuildFailed ? "needs_attention" : "connected";
  }

  let l6 = "not_connected";
  if (input.hasActiveFlowCheck) {
    l6 = input.flowCheckFailing ? "needs_attention" : "connected";
  }

  const statuses = [l1, l2, l3, l4, l5, l6];
  const connectedCount = statuses.filter((s) => s !== "not_connected").length;
  return { statuses, connectedCount };
}

// New app with only URL
{
  const res = computeStatuses({ hasUrl: true });
  assert(res.connectedCount === 1, "new app with URL only has 1 of 6 connected");
  assert(res.statuses[0] === "connected", "level 1 is connected");
  assert(res.statuses[1] === "not_connected", "level 2 is not_connected");
}

// Needs attention cases
{
  const now = new Date("2026-11-26T12:00:00Z");
  const res = computeStatuses({
    hasUrl: true,
    domainVerifiedAt: "2026-11-01T00:00:00Z",
    healthCheckEnabled: true,
    healthCheckPath: "/api/health",
    lastHealthCheckOk: false,
    hasActiveIngestKey: true,
    lastErrorEventAt: null,
    hasGithubRepo: true,
    githubLastBuildFailed: true,
    now,
  });
  assert(res.statuses[1] === "connected", "level 2 connected when domain verified");
  assert(res.statuses[2] === "needs_attention", "level 3 needs_attention when health check fails");
  assert(res.statuses[3] === "needs_attention", "level 4 needs_attention when key exists but no report arrived");
  assert(res.statuses[4] === "needs_attention", "level 5 needs_attention when latest build fails");
  assert(res.connectedCount === 5, "needs_attention counts toward connected levels");
}

// All 6 connected and healthy
{
  const now = new Date("2026-11-26T12:00:00Z");
  const res = computeStatuses({
    hasUrl: true,
    domainVerifiedAt: "2026-11-01T00:00:00Z",
    healthCheckEnabled: true,
    healthCheckPath: "/api/health",
    lastHealthCheckOk: true,
    hasActiveIngestKey: true,
    lastErrorEventAt: "2026-11-25T12:00:00Z",
    hasGithubRepo: true,
    githubLastBuildFailed: false,
    hasActiveFlowCheck: true,
    flowCheckFailing: false,
    now,
  });
  assert(res.connectedCount === 6, "all 6 levels connected");
  assert(res.statuses.every((s) => s === "connected"), "all 6 statuses are connected");
}

console.log("\n" + "=".repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("All tests passed ✅\n");
}
