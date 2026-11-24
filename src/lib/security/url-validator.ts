import dns from "node:dns/promises";
import net from "node:net";

export interface UrlValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  resolvedIp?: string;
  error?: string;
}

/**
 * Checks if an IPv4 address is in a private, loopback, or reserved range.
 */
function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // invalid = treat as blocked
  }

  const [a, b, c, d] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;

  // 10.0.0.0/8 (Private)
  if (a === 10) return true;

  // 100.64.0.0/10 (Shared address / CGNAT)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 169.254.0.0/16 (Link-local / Cloud metadata e.g. 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 172.16.0.0/12 (Private)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (a === 192 && b === 0 && c === 0) return true;

  // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && c === 2) return true;

  // 192.88.99.0/24 (6to4 Relay Anycast)
  if (a === 192 && b === 88 && c === 99) return true;

  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true;

  // 198.18.0.0/15 (Network benchmark tests)
  if (a === 198 && b >= 18 && b <= 19) return true;

  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && c === 100) return true;

  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && c === 113) return true;

  // 224.0.0.0/4 (Multicast)
  if (a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 (Reserved / Future use)
  if (a >= 240) return true;

  // Broadcast
  if (a === 255 && b === 255 && c === 255 && d === 255) return true;

  return false;
}

/**
 * Checks if an IPv6 address is in a private, loopback, or reserved range.
 */
function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // Loopback ::1
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;

  // Unspecified ::
  if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") return true;

  // Unique local addresses (fc00::/7)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;

  // Link-local unicast (fe80::/10)
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true;
  }

  // IPv4-mapped IPv6 (::ffff:0:0/96)
  if (normalized.startsWith("::ffff:")) {
    const ipv4Part = normalized.replace("::ffff:", "");
    if (net.isIPv4(ipv4Part)) {
      return isPrivateOrReservedIPv4(ipv4Part);
    }
  }

  return false;
}

/**
 * Checks if an IP is private, loopback, link-local, or cloud metadata.
 */
export function isPrivateOrBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    return isPrivateOrReservedIPv4(ip);
  }
  if (net.isIPv6(ip)) {
    return isPrivateOrReservedIPv6(ip);
  }
  return true;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "metadata.google.internal",
  "instance-data",
  "metadata",
]);

/**
 * Validates that an application URL is safe to monitor and not targeting internal networks or cloud metadata.
 */
export async function validateApplicationUrl(rawUrl: string): Promise<UrlValidationResult> {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { valid: false, error: "Application URL is required." };
  }

  const trimmed = rawUrl.trim();
  let parsed: URL;

  try {
    const withProtocol = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
    parsed = new URL(withProtocol);
  } catch {
    return { valid: false, error: "Invalid URL structure." };
  }

  // 1. Protocol validation (HTTP and HTTPS only)
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "Only http:// and https:// URLs are permitted." };
  }

  // 2. Hostname string checks
  const hostname = parsed.hostname.toLowerCase();

  if (!hostname || hostname.length > 253) {
    return { valid: false, error: "Invalid hostname." };
  }

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { valid: false, error: "Internal or localhost addresses cannot be monitored." };
  }

  // Block internal domain suffixes
  const blockedSuffixes = [".local", ".internal", ".localhost", ".lan", ".home", ".corp"];
  for (const suffix of blockedSuffixes) {
    if (hostname.endsWith(suffix)) {
      return { valid: false, error: `Internal domain (${suffix}) cannot be monitored.` };
    }
  }

  // Check if hostname is directly an IP literal
  if (net.isIP(hostname)) {
    if (isPrivateOrBlockedIp(hostname)) {
      return { valid: false, error: "Private or loopback IP addresses cannot be monitored." };
    }
    return {
      valid: true,
      normalizedUrl: parsed.origin + parsed.pathname + parsed.search,
      resolvedIp: hostname,
    };
  }

  // 3. DNS Resolution check (prevent DNS rebinding & SSRF)
  try {
    const lookupResult = await dns.lookup(hostname, { all: true });

    if (!lookupResult || lookupResult.length === 0) {
      return { valid: false, error: `Could not resolve hostname ${hostname}.` };
    }

    for (const record of lookupResult) {
      if (isPrivateOrBlockedIp(record.address)) {
        return {
          valid: false,
          error: `Hostname ${hostname} resolves to private/restricted IP (${record.address}). Monitoring blocked for security.`,
        };
      }
    }

    const primaryIp = lookupResult[0].address;

    return {
      valid: true,
      normalizedUrl: parsed.origin + (parsed.pathname === "/" ? "" : parsed.pathname) + parsed.search,
      resolvedIp: primaryIp,
    };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "ENOTFOUND") {
      return { valid: false, error: `Domain "${hostname}" does not exist or has no DNS records.` };
    }
    return { valid: false, error: `DNS resolution failed: ${code || "Unreachable host"}` };
  }
}

/**
 * SSRF-Safe Fetch: revalidates every redirect hop's destination IP before following.
 */
export async function safeFetch(
  initialUrl: string,
  init?: RequestInit,
  maxRedirects = 5
): Promise<Response> {
  let currentUrl = initialUrl;
  let redirectsRemaining = maxRedirects;

  while (redirectsRemaining >= 0) {
    const validation = await validateApplicationUrl(currentUrl);
    if (!validation.valid || !validation.normalizedUrl) {
      throw new Error(`SSRF Prevention: Blocked request to unsafe destination: ${validation.error}`);
    }

    // Execute request with redirect: "manual" so we can intercept and validate redirect hops
    const response = await fetch(validation.normalizedUrl, {
      ...init,
      redirect: "manual",
    });

    // Check if response is a redirect status (301, 302, 303, 307, 308)
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const locationHeader = response.headers.get("location");
      if (!locationHeader) {
        return response; // no location header to follow
      }

      // Resolve relative redirect against current URL
      const redirectTarget = new URL(locationHeader, currentUrl).toString();
      currentUrl = redirectTarget;
      redirectsRemaining--;
      continue;
    }

    return response;
  }

  throw new Error("Too many redirects (exceeded limit of 5)");
}
