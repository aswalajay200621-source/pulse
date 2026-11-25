import type { DeepScanClient } from "./scanner-client";
import type { DeepScanFinding } from "./types";

const FOLDERS = ["/assets/", "/uploads/", "/backup/", "/files/", "/static/"];

export async function checkDirectoryListing(client: DeepScanClient): Promise<DeepScanFinding[]> {
  const findings: DeepScanFinding[] = [];

  for (const folder of FOLDERS) {
    if (client.isBudgetExhausted()) break;
    const res = await client.request(folder, { method: "GET", followRedirects: false });
    if (!res || res.status !== 200) continue;

    if (/<title>\s*Index of\s+\//i.test(res.body) || /<h1>\s*Index of\s+\//i.test(res.body)) {
      findings.push({
        ruleId: "deep-directory-listing",
        severity: "medium",
        title: `Directory Listing Enabled on ${folder}`,
        evidence: `Server returned an "Index of /" directory listing at ${folder}.`,
        affectedUrl: res.finalUrl,
        findingKey: `deep:dir-listing:${folder}`,
      });
    }
  }

  return findings;
}
