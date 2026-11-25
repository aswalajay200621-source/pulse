import { validateApplicationUrl } from "@/lib/security/url-validator";
import type { DeepScanResponse } from "./types";

export const MAX_REQUESTS_PER_SCAN = 300;
export const MAX_SCAN_DURATION_MS = 120_000; // 2 minutes
export const MIN_REQUEST_INTERVAL_MS = 500; // max 2 requests/second

export class DeepScanClient {
  public readonly baseOrigin: string;
  public readonly verifiedHostname: string;
  public requestCount = 0;
  private lastRequestAt = 0;
  private readonly startedAt = Date.now();
  private readonly userAgent: string;

  constructor(baseUrl: string, siteUrl: string = process.env.NEXT_PUBLIC_APP_URL || "https://pulse.app") {
    const parsed = new URL(baseUrl);
    this.baseOrigin = parsed.origin;
    this.verifiedHostname = parsed.hostname.toLowerCase();
    this.userAgent = `PulseScanner/1.0 (+${siteUrl.replace(/\/$/, "")}/scanner)`;
  }

  public isBudgetExhausted(): boolean {
    return (
      this.requestCount >= MAX_REQUESTS_PER_SCAN ||
      Date.now() - this.startedAt >= MAX_SCAN_DURATION_MS
    );
  }

  private async enforceRateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
      await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL_MS - elapsed));
    }
    this.lastRequestAt = Date.now();
  }

  /**
   * Performs a safe GET, HEAD, or OPTIONS request strictly within the verified domain.
   * Re-validates every URL and redirect via SSRF validator, never follows off-domain redirects.
   */
  public async request(
    pathOrUrl: string,
    options: {
      method?: "GET" | "HEAD" | "OPTIONS";
      headers?: Record<string, string>;
      followRedirects?: boolean;
      maxRedirects?: number;
      timeoutMs?: number;
    } = {}
  ): Promise<DeepScanResponse | null> {
    const method = options.method ?? "GET";
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      throw new Error(`Unsafe HTTP method blocked: ${method}`);
    }

    if (this.isBudgetExhausted()) return null;

    let currentUrl: string;
    try {
      currentUrl = new URL(pathOrUrl, this.baseOrigin).toString();
    } catch {
      return null;
    }

    const followRedirects = options.followRedirects ?? true;
    const maxRedirects = options.maxRedirects ?? 3;

    for (let hop = 0; hop <= maxRedirects; hop++) {
      if (this.isBudgetExhausted()) return null;

      const parsed = new URL(currentUrl);
      if (parsed.hostname.toLowerCase() !== this.verifiedHostname) {
        return null; // Never scan third-party hosts
      }

      const validation = await validateApplicationUrl(currentUrl);
      if (!validation.valid || !validation.normalizedUrl) {
        return null;
      }

      await this.enforceRateLimit();
      this.requestCount++;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);

      try {
        const res = await fetch(validation.normalizedUrl, {
          method,
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "User-Agent": this.userAgent,
            Accept: "text/html,application/json,text/plain,*/*;q=0.8",
            ...options.headers,
          },
        });
        clearTimeout(timer);

        const headers: Record<string, string> = {};
        res.headers.forEach((v, k) => {
          headers[k.toLowerCase()] = v;
        });

        const setCookies =
          typeof res.headers.getSetCookie === "function"
            ? res.headers.getSetCookie()
            : headers["set-cookie"]
            ? [headers["set-cookie"]]
            : [];

        if (followRedirects && res.status >= 300 && res.status < 400) {
          const location = res.headers.get("location");
          if (!location || hop === maxRedirects) {
            return { status: res.status, headers, setCookies, body: "", finalUrl: currentUrl };
          }
          const nextUrl = new URL(location, currentUrl);
          if (nextUrl.hostname.toLowerCase() !== this.verifiedHostname) {
            return null; // Never follow redirects off the verified domain
          }
          currentUrl = nextUrl.toString();
          continue;
        }

        const body = method === "HEAD" ? "" : (await res.text()).slice(0, 262_144); // cap 256KB
        return {
          status: res.status,
          headers,
          setCookies,
          body,
          finalUrl: currentUrl,
        };
      } catch {
        clearTimeout(timer);
        return null;
      }
    }

    return null;
  }
}
