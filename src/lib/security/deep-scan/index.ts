import { DeepScanClient } from "./scanner-client";
import { checkSensitiveFiles } from "./sensitive-files";
import { checkDirectoryListing } from "./directory-listing";
import { checkAdminDebugPaths } from "./admin-debug-paths";
import { checkCors } from "./cors-check";
import { checkCookieFlags } from "./cookie-flags";
import { checkVersionDisclosure } from "./version-disclosure";
import { checkReflection } from "./reflection-check";
import { checkOpenRedirect } from "./open-redirect";
import { checkJsSecrets } from "./js-secrets";
import { checkOpenBaas } from "./open-baas";
import { checkDanglingDns } from "./dangling-dns";
import { checkHeadersAndTls } from "./header-tls-check";
import type { DeepScanFinding } from "./types";

export interface DeepScanRunResult {
  findings: DeepScanFinding[];
  requestCount: number;
}

export async function runDeepScan(appUrl: string): Promise<DeepScanRunResult> {
  const client = new DeepScanClient(appUrl);
  const findings: DeepScanFinding[] = [];

  // 1. Fetch homepage once for cookie flags, version disclosure, JS bundles, and open BaaS
  const homeRes = await client.request("/", { method: "GET", followRedirects: true });

  if (homeRes) {
    findings.push(...checkCookieFlags(homeRes));
    findings.push(...checkVersionDisclosure(homeRes));

    const { findings: jsSecretFindings, jsBundles } = await checkJsSecrets(client, homeRes.body);
    findings.push(...jsSecretFindings);

    const baasFindings = await checkOpenBaas([
      { url: homeRes.finalUrl, content: homeRes.body },
      ...jsBundles.map((b) => ({ url: b.url, content: b.content })),
    ]);
    findings.push(...baasFindings);
  }

  // 2. Run remaining active checks within rate & request budget
  findings.push(...(await checkSensitiveFiles(client)));
  findings.push(...(await checkDirectoryListing(client)));
  findings.push(...(await checkAdminDebugPaths(client)));
  findings.push(...(await checkCors(client)));
  findings.push(...(await checkReflection(client)));
  findings.push(...(await checkOpenRedirect(client)));
  findings.push(...(await checkHeadersAndTls(appUrl)));
  findings.push(...(await checkDanglingDns(client.verifiedHostname)));

  // Deduplicate by findingKey
  const uniqueMap = new Map<string, DeepScanFinding>();
  for (const f of findings) {
    if (!uniqueMap.has(f.findingKey)) {
      uniqueMap.set(f.findingKey, f);
    }
  }

  return {
    findings: Array.from(uniqueMap.values()),
    requestCount: client.requestCount,
  };
}
