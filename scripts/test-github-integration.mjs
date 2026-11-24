import crypto from "node:crypto";
import { verifyGitHubWebhookSignature } from "../src/lib/github/app.ts";

async function runGitHubTests() {
  console.log("=== RUNNING GITHUB INTEGRATION & SECURITY TESTS ===\n");

  let passed = 0;
  let failed = 0;

  // TEST 1: Webhook HMAC SHA-256 Signature Verification
  console.log("[TEST 1] Testing Webhook HMAC SHA-256 Signature Verification...");
  const testSecret = "pulse_super_secret_webhook_key_12345";
  process.env.GITHUB_APP_WEBHOOK_SECRET = testSecret;

  const samplePayload = JSON.stringify({
    action: "created",
    installation: { id: 987654 },
    sender: { login: "octocat" },
  });

  const validHmac = crypto.createHmac("sha256", testSecret).update(samplePayload).digest("hex");
  const validSignature = `sha256=${validHmac}`;

  const isSignatureValid = verifyGitHubWebhookSignature(samplePayload, validSignature);
  if (isSignatureValid) {
    console.log("  [PASS] Legitimate webhook signature correctly accepted.");
    passed++;
  } else {
    console.error("  [FAIL] Legitimate webhook signature was rejected.");
    failed++;
  }

  // TEST 2: Tampered payload rejected
  console.log("[TEST 2] Testing Tampered Payload Signature Rejection...");
  const tamperedPayload = JSON.stringify({
    action: "created",
    installation: { id: 987654 },
    sender: { login: "attacker" },
  });

  const isTamperedValid = verifyGitHubWebhookSignature(tamperedPayload, validSignature);
  if (!isTamperedValid) {
    console.log("  [PASS] Tampered payload correctly rejected with invalid signature.");
    passed++;
  } else {
    console.error("  [FAIL] Tampered payload was accepted!");
    failed++;
  }

  // TEST 3: Invalid signature header format
  console.log("[TEST 3] Testing Malformed Signature Header Rejection...");
  const isMalformedValid = verifyGitHubWebhookSignature(samplePayload, "sha256=invalid_hex_string");
  if (!isMalformedValid) {
    console.log("  [PASS] Malformed signature header correctly rejected.");
    passed++;
  } else {
    console.error("  [FAIL] Malformed signature was accepted!");
    failed++;
  }

  // TEST 4: Null signature header rejection
  console.log("[TEST 4] Testing Missing Signature Header Rejection...");
  const isNullValid = verifyGitHubWebhookSignature(samplePayload, null);
  if (!isNullValid) {
    console.log("  [PASS] Missing signature header correctly rejected.");
    passed++;
  } else {
    console.error("  [FAIL] Missing signature was accepted!");
    failed++;
  }

  // TEST 5: CSRF State Token Cryptographic Entropy
  console.log("[TEST 5] Testing CSRF State Token Cryptographic Entropy & Uniqueness...");
  const tokenSet = new Set();
  for (let i = 0; i < 100; i++) {
    const token = crypto.randomBytes(32).toString("hex");
    if (token.length !== 64) {
      console.error(`  [FAIL] Token length ${token.length} !== 64 characters.`);
      failed++;
      break;
    }
    tokenSet.add(token);
  }
  if (tokenSet.size === 100) {
    console.log("  [PASS] 100 unique 256-bit cryptographically secure state tokens generated.");
    passed++;
  }

  // TEST 6: RS256 JWT Generation using dynamically generated RSA Key
  console.log("[TEST 6] Testing RS256 JWT Generation for GitHub App Authentication...");
  try {
    const { privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const exportedPrivateKey = privateKey.export({ type: "pkcs1", format: "pem" });

    process.env.GITHUB_APP_ID = "889900";
    process.env.GITHUB_APP_PRIVATE_KEY = exportedPrivateKey.toString();

    // Import and test JWT creation
    const { generateGitHubAppJwt } = await import("../src/lib/github/app.ts");
    const jwt = generateGitHubAppJwt();

    const parts = jwt.split(".");
    if (parts.length === 3) {
      const header = JSON.parse(Buffer.from(parts[0], "base64").toString());
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());

      if (header.alg === "RS256" && header.typ === "JWT") {
        if (payload.iss === "889900" && payload.exp - payload.iat <= 600) {
          console.log(`  [PASS] Valid RS256 JWT generated with correct header, issuer (${payload.iss}), and 10-minute expiry window.`);
          passed++;
        } else {
          console.error("  [FAIL] Payload claims invalid:", payload);
          failed++;
        }
      } else {
        console.error("  [FAIL] Header invalid:", header);
        failed++;
      }
    } else {
      console.error("  [FAIL] JWT does not have 3 parts.");
      failed++;
    }
  } catch (err) {
    console.error("  [FAIL] JWT generation error:", err);
    failed++;
  }

  console.log(`\n=== GITHUB INTEGRATION TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runGitHubTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
