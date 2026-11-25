import type { DeepScanClient } from "./scanner-client";
import type { DeepScanFinding } from "./types";

const REDIRECT_PARAMS = ["next", "url", "redirect", "return"];
const EXTERNAL_MARKER = "https://pulse-redirect-test.invalid/check";

export async function checkOpenRedirect(client: DeepScanClient): Promise<DeepScanFinding[]> {
  const findings: DeepScanFinding[] = [];

  for (const param of REDIRECT_PARAMS) {
    if (client.isBudgetExhausted()) break;
    const path = `/?${param}=${encodeURIComponent(EXTERNAL_MARKER)}`;
    const res = await client.request(path, { method: "GET", followRedirects: false });
    if (!res) continue;

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers["location"] || "";
      if (location.startsWith(EXTERNAL_MARKER)) {
        findings.push({
          ruleId: "deep-open-redirect",
          severity: "medium",
          title: `Open Redirect via "${param}" Parameter`,
          evidence: `Request to /?${param}=... returned HTTP ${res.status} with Location: ${location}.`,
          affectedUrl: res.finalUrl,
          findingKey: `deep:open-redirect:${param}`,
        });
      }
    }
  }

  return findings;
}
