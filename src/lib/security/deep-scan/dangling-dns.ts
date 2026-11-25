import dns from "node:dns/promises";
import type { DeepScanFinding } from "./types";

const TAKEOVER_FINGERPRINTS: Array<{
  service: string;
  cnamePattern: RegExp;
  bodyFingerprint: RegExp;
}> = [
  { service: "GitHub Pages", cnamePattern: /\.github\.io$/i, bodyFingerprint: /There isn't a GitHub Pages site here/i },
  { service: "Heroku", cnamePattern: /\.herokuapp\.com$/i, bodyFingerprint: /No such app/i },
  { service: "AWS S3", cnamePattern: /\.s3[.-].*amazonaws\.com$/i, bodyFingerprint: /NoSuchBucket/i },
  { service: "Netlify", cnamePattern: /\.netlify\.app$/i, bodyFingerprint: /Not Found - Request ID:/i },
  { service: "Azure", cnamePattern: /\.azurewebsites\.net$/i, bodyFingerprint: /404 Web Site not found/i },
];

export async function checkDanglingDns(hostname: string): Promise<DeepScanFinding[]> {
  const findings: DeepScanFinding[] = [];
  let cnames: string[] = [];

  try {
    cnames = await dns.resolveCname(hostname);
  } catch {
    return findings; // No CNAME record
  }

  for (const cname of cnames) {
    for (const fp of TAKEOVER_FINGERPRINTS) {
      if (!fp.cnamePattern.test(cname)) continue;

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`https://${hostname}`, {
          method: "GET",
          signal: controller.signal,
          headers: { "User-Agent": "PulseScanner/1.0" },
        });
        clearTimeout(timer);
        const body = (await res.text()).slice(0, 16384);

        if (fp.bodyFingerprint.test(body)) {
          findings.push({
            ruleId: "deep-dangling-dns",
            severity: "high",
            title: `Potential Subdomain Takeover (${fp.service})`,
            evidence: `CNAME ${hostname} -> ${cname} returned "${fp.service}" unclaimed-resource fingerprint.`,
            affectedUrl: `https://${hostname}`,
            findingKey: `deep:dangling-dns:${hostname}:${cname}`,
          });
        }
      } catch {
        // ignore
      }
    }
  }

  return findings;
}
