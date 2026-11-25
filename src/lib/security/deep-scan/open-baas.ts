import type { DeepScanFinding } from "./types";

export async function checkOpenBaas(
  contents: Array<{ url: string; content: string }>
): Promise<DeepScanFinding[]> {
  const findings: DeepScanFinding[] = [];
  const seen = new Set<string>();

  for (const { url, content } of contents) {
    // 1. Detect Supabase URL + anon/publishable key
    const sbUrlMatch = content.match(/https:\/\/[a-z0-9-]+\.supabase\.co/i);
    const sbKeyMatch = content.match(/(eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|sb_publishable_[A-Za-z0-9_-]+)/);

    if (sbUrlMatch && sbKeyMatch && !seen.has(sbUrlMatch[0])) {
      seen.add(sbUrlMatch[0]);
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${sbUrlMatch[0]}/rest/v1/`, {
          method: "GET",
          signal: controller.signal,
          headers: {
            apikey: sbKeyMatch[0],
            Authorization: `Bearer ${sbKeyMatch[0]}`,
            "User-Agent": "PulseScanner/1.0",
          },
        });
        clearTimeout(timer);

        if (res.ok) {
          findings.push({
            ruleId: "deep-open-supabase",
            severity: "medium",
            title: "Supabase REST API Readable by Anonymous Visitors",
            evidence: `Supabase endpoint ${sbUrlMatch[0]}/rest/v1/ responded HTTP ${res.status} with the public anon key. Verify Row Level Security (RLS) is enabled on all tables.`,
            affectedUrl: url,
            findingKey: `deep:open-baas:supabase:${sbUrlMatch[0]}`,
          });
        }
      } catch {
        // ignore network errors
      }
    }

    // 2. Detect Firebase Realtime Database URL
    const fbMatch = content.match(/https:\/\/[a-z0-9-]+\.firebaseio\.com/i);
    if (fbMatch && !seen.has(fbMatch[0])) {
      seen.add(fbMatch[0]);
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${fbMatch[0]}/.json?shallow=true`, {
          method: "GET",
          signal: controller.signal,
          headers: { "User-Agent": "PulseScanner/1.0" },
        });
        clearTimeout(timer);

        if (res.ok) {
          findings.push({
            ruleId: "deep-open-firebase",
            severity: "high",
            title: "Firebase Database Readable by Anonymous Visitors",
            evidence: `Firebase endpoint ${fbMatch[0]}/.json?shallow=true responded HTTP ${res.status} without authentication.`,
            affectedUrl: url,
            findingKey: `deep:open-baas:firebase:${fbMatch[0]}`,
          });
        }
      } catch {
        // ignore network errors
      }
    }
  }

  return findings;
}
