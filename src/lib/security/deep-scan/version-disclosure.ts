import vulnDb from "./vulnerable-versions.json";
import type { DeepScanResponse, DeepScanFinding } from "./types";

function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1;
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1;
  }
  return 0;
}

export function checkVersionDisclosure(res: DeepScanResponse): DeepScanFinding[] {
  const findings: DeepScanFinding[] = [];
  const headerValues = [res.headers["server"], res.headers["x-powered-by"]].filter(Boolean);

  for (const val of headerValues) {
    for (const entry of vulnDb.versions) {
      const regex = new RegExp(`${entry.product}[/\\s]+(\\d+\\.\\d+(?:\\.\\d+)?)`, "i");
      const match = val.match(regex);
      if (match && match[1]) {
        if (compareSemver(match[1], entry.below) < 0) {
          findings.push({
            ruleId: "deep-vulnerable-version-header",
            severity: "medium",
            title: `Outdated ${entry.product} Version Disclosed (${match[1]})`,
            evidence: `Response header disclosed "${val}", which is below ${entry.below}. ${entry.advisory}`,
            affectedUrl: res.finalUrl,
            findingKey: `deep:version:${entry.product}:${match[1]}`,
          });
        }
      }
    }
  }

  return findings;
}
