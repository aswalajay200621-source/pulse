import { validateApplicationUrl, isPrivateOrBlockedIp } from "../src/lib/security/url-validator.ts";

async function runTests() {
  console.log("=== RUNNING SSRF & URL SECURITY VALIDATION TESTS ===\n");

  const testCases = [
    { url: "http://localhost", expectedValid: false, reason: "Localhost" },
    { url: "http://127.0.0.1:8080/metrics", expectedValid: false, reason: "Loopback IPv4" },
    { url: "http://[::1]/", expectedValid: false, reason: "Loopback IPv6" },
    { url: "http://169.254.169.254/latest/meta-data/", expectedValid: false, reason: "AWS/GCP Cloud Metadata IP" },
    { url: "http://10.0.0.5/api", expectedValid: false, reason: "Private Class A (10.0.0.0/8)" },
    { url: "http://172.16.0.1/admin", expectedValid: false, reason: "Private Class B (172.16.0.0/12)" },
    { url: "http://192.168.1.254/", expectedValid: false, reason: "Private Class C (192.168.0.0/16)" },
    { url: "http://metadata.google.internal/computeMetadata/v1/", expectedValid: false, reason: "GCP Internal Hostname" },
    { url: "http://server.local/", expectedValid: false, reason: ".local internal suffix" },
    { url: "file:///etc/passwd", expectedValid: false, reason: "Invalid protocol file://" },
    { url: "ftp://files.example.com", expectedValid: false, reason: "Invalid protocol ftp://" },
    { url: "https://example.com", expectedValid: true, reason: "Public domain example.com" },
  ];

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const result = await validateApplicationUrl(tc.url);
    const pass = result.valid === tc.expectedValid;
    if (pass) {
      console.log(`[PASS] ${tc.reason} -> Input: "${tc.url}" (valid: ${result.valid})`);
      passed++;
    } else {
      console.error(`[FAIL] ${tc.reason} -> Expected valid=${tc.expectedValid}, got valid=${result.valid}. Error: ${result.error}`);
      failed++;
    }
  }

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
