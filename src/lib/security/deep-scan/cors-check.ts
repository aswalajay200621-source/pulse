import type { DeepScanClient } from "./scanner-client";
import type { DeepScanFinding } from "./types";

export async function checkCors(client: DeepScanClient): Promise<DeepScanFinding[]> {
  const findings: DeepScanFinding[] = [];
  const testOrigin = "https://pulse-test.invalid";

  const res = await client.request("/", {
    method: "OPTIONS",
    headers: { Origin: testOrigin },
    followRedirects: false,
  });

  if (!res) return findings;

  const acao = res.headers["access-control-allow-origin"];
  const acac = res.headers["access-control-allow-credentials"]?.toLowerCase() === "true";

  if ((acao === "*" || acao === testOrigin) && acac) {
    findings.push({
      ruleId: "deep-cors-credentials",
      severity: "high",
      title: "Permissive CORS With Credentials Enabled",
      evidence: `Server returned Access-Control-Allow-Origin: ${acao} with Access-Control-Allow-Credentials: true for Origin ${testOrigin}.`,
      affectedUrl: res.finalUrl,
      findingKey: "deep:cors:credentials",
    });
  } else if (acao === testOrigin) {
    findings.push({
      ruleId: "deep-cors-reflected",
      severity: "medium",
      title: "CORS Origin Reflected Arbitrarily",
      evidence: `Server reflected untrusted Origin ${testOrigin} in Access-Control-Allow-Origin.`,
      affectedUrl: res.finalUrl,
      findingKey: "deep:cors:reflected",
    });
  }

  return findings;
}
