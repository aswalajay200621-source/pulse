import type { DeepScanResponse, DeepScanFinding } from "./types";

export function checkCookieFlags(res: DeepScanResponse): DeepScanFinding[] {
  const findings: DeepScanFinding[] = [];
  if (!res.setCookies || res.setCookies.length === 0) return findings;

  const isHttps = res.finalUrl.startsWith("https://");

  for (const rawCookie of res.setCookies) {
    const cookieName = rawCookie.split("=")[0]?.trim() || "cookie";
    const lower = rawCookie.toLowerCase();
    const missing: string[] = [];

    if (isHttps && !lower.includes("secure")) missing.push("Secure");
    if (!lower.includes("httponly")) missing.push("HttpOnly");
    if (!lower.includes("samesite=")) missing.push("SameSite");

    if (missing.length > 0) {
      findings.push({
        ruleId: "deep-cookie-flags",
        severity: missing.includes("Secure") || missing.includes("HttpOnly") ? "medium" : "low",
        title: `Cookie "${cookieName}" Missing Security Flags`,
        evidence: `Set-Cookie for "${cookieName}" is missing: ${missing.join(", ")}.`,
        affectedUrl: res.finalUrl,
        findingKey: `deep:cookie:${cookieName}`,
      });
    }
  }

  return findings;
}
