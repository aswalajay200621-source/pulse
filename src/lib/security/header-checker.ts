import { validateApplicationUrl } from "@/lib/security/url-validator";

export interface HeaderCheckFinding {
  ruleId: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  remediation: string;
  findingKey: string;
  actual?: string;
}

interface HeaderRule {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  check: (headers: Record<string, string>, protocol: string) => { failed: boolean; actual?: string };
  description: string;
  remediation: string;
}

const HEADER_RULES: HeaderRule[] = [
  {
    id: "insecure-http",
    title: "Application Served Over HTTP",
    severity: "high",
    check: (_, protocol) => ({ failed: protocol === "http:" }),
    description: "The application is served over insecure HTTP. All traffic can be intercepted by a network attacker.",
    remediation: "Enable HTTPS with a valid TLS certificate. Redirect all HTTP traffic to HTTPS.",
  },
  {
    id: "missing-hsts",
    title: "Missing Strict-Transport-Security Header",
    severity: "high",
    check: (h, protocol) => ({
      failed: protocol === "https:" && !h["strict-transport-security"],
      actual: h["strict-transport-security"] || "absent",
    }),
    description: "HSTS is not configured. Browsers may allow downgrade attacks to HTTP on future visits.",
    remediation: "Add: Strict-Transport-Security: max-age=63072000; includeSubDomains; preload",
  },
  {
    id: "missing-csp",
    title: "Missing Content-Security-Policy Header",
    severity: "high",
    check: (h) => ({
      failed: !h["content-security-policy"],
      actual: h["content-security-policy"] || "absent",
    }),
    description: "No Content Security Policy is configured. This increases exposure to cross-site scripting (XSS) attacks.",
    remediation: "Define a CSP header that restricts resource loading. Start with: Content-Security-Policy: default-src 'self'",
  },
  {
    id: "missing-x-frame-options",
    title: "Missing X-Frame-Options Header",
    severity: "medium",
    check: (h) => ({
      failed: !h["x-frame-options"] && !h["content-security-policy"]?.includes("frame-ancestors"),
      actual: h["x-frame-options"] || "absent",
    }),
    description: "The application is potentially vulnerable to clickjacking. No frame embedding protection is configured.",
    remediation: "Add: X-Frame-Options: DENY or X-Frame-Options: SAMEORIGIN, or use CSP frame-ancestors directive.",
  },
  {
    id: "missing-x-content-type-options",
    title: "Missing X-Content-Type-Options Header",
    severity: "medium",
    check: (h) => ({
      failed: !h["x-content-type-options"],
      actual: h["x-content-type-options"] || "absent",
    }),
    description: "MIME-type sniffing is not prevented. Browsers may interpret files as different content types.",
    remediation: "Add: X-Content-Type-Options: nosniff",
  },
  {
    id: "missing-referrer-policy",
    title: "Missing Referrer-Policy Header",
    severity: "low",
    check: (h) => ({
      failed: !h["referrer-policy"],
      actual: h["referrer-policy"] || "absent",
    }),
    description: "No Referrer-Policy is set. The full URL may be leaked in Referer headers to third parties.",
    remediation: "Add: Referrer-Policy: strict-origin-when-cross-origin",
  },
  {
    id: "server-banner-exposed",
    title: "Server Software Banner Exposed",
    severity: "low",
    check: (h) => ({
      failed: !!h["server"] && h["server"].length > 0,
      actual: h["server"] || "absent",
    }),
    description: `Server software version disclosed in the Server header. This provides attackers with version-specific exploit targets.`,
    remediation: "Configure your web server to suppress or anonymize the Server header.",
  },
  {
    id: "x-powered-by-exposed",
    title: "X-Powered-By Header Exposes Framework",
    severity: "low",
    check: (h) => ({
      failed: !!h["x-powered-by"],
      actual: h["x-powered-by"] || "absent",
    }),
    description: "The X-Powered-By header reveals the application framework and version to attackers.",
    remediation: "Suppress the X-Powered-By header. In Express: app.disable('x-powered-by')",
  },
];

/** SSRF-safe security header check for a live application URL. */
export async function checkSecurityHeaders(
  rawUrl: string,
  timeoutMs = 10000
): Promise<{ findings: HeaderCheckFinding[]; errorMessage: string | null }> {
  const validation = await validateApplicationUrl(rawUrl);
  if (!validation.valid || !validation.normalizedUrl) {
    return {
      findings: [],
      errorMessage: validation.error || "URL failed SSRF validation.",
    };
  }

  const targetUrl = validation.normalizedUrl;
  const protocol = new URL(targetUrl).protocol;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let responseHeaders: Record<string, string> = {};

  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "PulseSecurityScanner/1.0" },
    });
    clearTimeout(timer);
    res.headers.forEach((value, key) => {
      responseHeaders[key.toLowerCase()] = value;
    });
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return {
      findings: [],
      errorMessage: isTimeout
        ? `Security header check timed out after ${timeoutMs}ms.`
        : `Could not reach the application: ${err instanceof Error ? err.message : "Network error"}`,
    };
  }

  const findings: HeaderCheckFinding[] = [];

  for (const rule of HEADER_RULES) {
    const { failed, actual } = rule.check(responseHeaders, protocol);
    if (failed) {
      const findingKey = `header:${rule.id}`;
      findings.push({
        ruleId: rule.id,
        title: rule.title,
        severity: rule.severity,
        description: rule.description,
        remediation: rule.remediation,
        findingKey,
        actual: typeof actual === "string" ? actual : responseHeaders[rule.id] || undefined,
      });
    }
  }

  return { findings, errorMessage: null };
}
