import { scanFileContent } from "@/lib/security/secret-scanner";
import type { DeepScanClient } from "./scanner-client";
import type { DeepScanFinding } from "./types";

export function extractScriptUrls(html: string, baseOrigin: string, verifiedHostname: string): string[] {
  const urls = new Set<string>();
  const regex = /<script[^>]+src=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    try {
      const resolved = new URL(match[1], baseOrigin);
      if (resolved.hostname.toLowerCase() === verifiedHostname) {
        urls.add(resolved.toString());
      }
    } catch {
      // ignore invalid script src
    }
  }
  return Array.from(urls).slice(0, 15); // cap at 15 JS bundles per scan
}

export async function checkJsSecrets(
  client: DeepScanClient,
  homepageHtml: string
): Promise<{ findings: DeepScanFinding[]; jsBundles: Array<{ url: string; content: string }> }> {
  const findings: DeepScanFinding[] = [];
  const jsBundles: Array<{ url: string; content: string }> = [];
  const scriptUrls = extractScriptUrls(homepageHtml, client.baseOrigin, client.verifiedHostname);

  for (const scriptUrl of scriptUrls) {
    if (client.isBudgetExhausted()) break;
    const res = await client.request(scriptUrl, { method: "GET", followRedirects: true });
    if (!res || res.status !== 200 || !res.body) continue;

    jsBundles.push({ url: scriptUrl, content: res.body });
    const secrets = scanFileContent(res.body, new URL(scriptUrl).pathname);

    for (const s of secrets) {
      findings.push({
        ruleId: s.ruleId,
        severity: s.confidence === "high" ? "critical" : s.confidence === "medium" ? "high" : "medium",
        title: `Secret in Public JS: ${s.ruleName}`,
        evidence: `Detected ${s.maskedSecret} in public script ${new URL(scriptUrl).pathname} (line ${s.lineNumber}).`,
        affectedUrl: scriptUrl,
        findingKey: `deep:js-secret:${s.ruleId}:${new URL(scriptUrl).pathname}:${s.lineNumber}`,
      });
    }
  }

  return { findings, jsBundles };
}
