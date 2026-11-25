import crypto from "node:crypto";
import type { DeepScanClient } from "./scanner-client";
import type { DeepScanFinding } from "./types";

const PROBE_PARAMS = ["q", "search", "query", "name", "message"];

export async function checkReflection(client: DeepScanClient): Promise<DeepScanFinding[]> {
  const findings: DeepScanFinding[] = [];
  const marker = `pulse-probe-${crypto.randomBytes(6).toString("hex")}`;

  for (const param of PROBE_PARAMS) {
    if (client.isBudgetExhausted()) break;
    const path = `/?${param}=${encodeURIComponent(marker)}`;
    const res = await client.request(path, { method: "GET", followRedirects: true });
    if (!res || res.status !== 200) continue;

    const ct = res.headers["content-type"] || "";
    if (ct.includes("text/html") && res.body.includes(marker)) {
      findings.push({
        ruleId: "deep-unescaped-reflection",
        severity: "medium",
        title: `Reflected Query Parameter "${param}" in HTML`,
        evidence: `Harmless probe marker "${marker}" sent in ?${param}= was reflected directly in the HTML response.`,
        affectedUrl: res.finalUrl,
        findingKey: `deep:reflection:${param}`,
      });
    }
  }

  return findings;
}
