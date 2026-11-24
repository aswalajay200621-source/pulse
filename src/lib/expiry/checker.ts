import tls from "node:tls";
import { validateApplicationUrl } from "@/lib/security/url-validator";
import type { ExpiryStatus } from "@/lib/supabase/types";

export interface ExpiryInspectionResult {
  status: ExpiryStatus;
  expiryDate: string | null;
  daysRemaining: number | null;
  issuer: string | null;
  errorMessage: string | null;
}

export function computeExpiryStatus(
  expiryDateIso: string | null,
  nowMs: number = Date.now()
): { status: ExpiryStatus; daysRemaining: number | null } {
  if (!expiryDateIso) {
    return { status: "unknown", daysRemaining: null };
  }
  const expiryMs = new Date(expiryDateIso).getTime();
  if (Number.isNaN(expiryMs)) {
    return { status: "unknown", daysRemaining: null };
  }
  const daysRemaining = Math.ceil((expiryMs - nowMs) / (1000 * 60 * 60 * 24));
  if (daysRemaining <= 0) {
    return { status: "expired", daysRemaining };
  }
  if (daysRemaining <= 30) {
    return { status: "expiring_soon", daysRemaining };
  }
  return { status: "healthy", daysRemaining };
}

/**
 * Inspects the TLS certificate of an HTTPS host with SSRF protection.
 * Never invents dates; records inspection errors if DNS/TLS fails.
 */
export async function inspectTlsCertificate(rawUrl: string): Promise<ExpiryInspectionResult> {
  const validation = await validateApplicationUrl(rawUrl);
  if (!validation.valid || !validation.normalizedUrl) {
    return {
      status: "error",
      expiryDate: null,
      daysRemaining: null,
      issuer: null,
      errorMessage: validation.error || "URL failed SSRF validation.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(validation.normalizedUrl);
  } catch {
    return {
      status: "error",
      expiryDate: null,
      daysRemaining: null,
      issuer: null,
      errorMessage: "Invalid URL.",
    };
  }

  if (parsed.protocol !== "https:") {
    return {
      status: "unknown",
      expiryDate: null,
      daysRemaining: null,
      issuer: null,
      errorMessage: "Application URL does not use HTTPS.",
    };
  }

  const host = parsed.hostname;
  const port = parsed.port ? Number(parsed.port) : 443;

  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host,
        port,
        servername: host,
        rejectUnauthorized: false,
      },
      () => {
        try {
          const cert = socket.getPeerCertificate();
          socket.end();

          if (!cert || !cert.valid_to) {
            resolve({
              status: "error",
              expiryDate: null,
              daysRemaining: null,
              issuer: null,
              errorMessage: "No TLS certificate returned by server.",
            });
            return;
          }

          const expiryDate = new Date(cert.valid_to).toISOString();
          const { status, daysRemaining } = computeExpiryStatus(expiryDate);
          const rawIssuer =
            cert.issuer?.O || cert.issuer?.CN || (typeof cert.issuer === "string" ? cert.issuer : null);
          const issuer = Array.isArray(rawIssuer) ? (rawIssuer[0] ?? null) : rawIssuer;

          if (!socket.authorized && status === "healthy") {
            resolve({
              status: "error",
              expiryDate,
              daysRemaining,
              issuer,
              errorMessage: `Certificate untrusted: ${socket.authorizationError || "Invalid chain"}`,
            });
            return;
          }

          resolve({
            status,
            expiryDate,
            daysRemaining,
            issuer,
            errorMessage: null,
          });
        } catch (err: unknown) {
          socket.destroy();
          resolve({
            status: "error",
            expiryDate: null,
            daysRemaining: null,
            issuer: null,
            errorMessage: err instanceof Error ? err.message : "Failed to parse TLS certificate.",
          });
        }
      }
    );

    socket.setTimeout(8000, () => {
      socket.destroy();
      resolve({
        status: "error",
        expiryDate: null,
        daysRemaining: null,
        issuer: null,
        errorMessage: "TLS handshake timed out after 8000ms.",
      });
    });

    socket.on("error", (err) => {
      socket.destroy();
      resolve({
        status: "error",
        expiryDate: null,
        daysRemaining: null,
        issuer: null,
        errorMessage: err.message || "TLS connection failed.",
      });
    });
  });
}

/**
 * Extracts a registrable domain from a hostname (best-effort) and queries RDAP.
 * Returns "unknown" if TLD is unsupported, redacted, or rate-limited.
 */
export async function inspectDomainRdap(rawUrl: string): Promise<ExpiryInspectionResult> {
  const validation = await validateApplicationUrl(rawUrl);
  if (!validation.valid || !validation.normalizedUrl) {
    return {
      status: "error",
      expiryDate: null,
      daysRemaining: null,
      issuer: null,
      errorMessage: validation.error || "URL failed SSRF validation.",
    };
  }

  const hostname = new URL(validation.normalizedUrl).hostname.toLowerCase();
  const parts = hostname.split(".");
  if (parts.length < 2) {
    return {
      status: "unknown",
      expiryDate: null,
      daysRemaining: null,
      issuer: null,
      errorMessage: "Cannot determine registrable domain.",
    };
  }

  const domain = parts.slice(-2).join(".");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      signal: controller.signal,
      headers: { Accept: "application/rdap+json, application/json" },
    });
    clearTimeout(timer);

    if (res.status === 404) {
      return {
        status: "unknown",
        expiryDate: null,
        daysRemaining: null,
        issuer: null,
        errorMessage: "RDAP not supported for this TLD or domain not found.",
      };
    }

    if (res.status === 429) {
      return {
        status: "unknown",
        expiryDate: null,
        daysRemaining: null,
        issuer: null,
        errorMessage: "RDAP rate limit reached; try again later.",
      };
    }

    if (!res.ok) {
      return {
        status: "unknown",
        expiryDate: null,
        daysRemaining: null,
        issuer: null,
        errorMessage: `RDAP returned HTTP ${res.status}.`,
      };
    }

    const data = (await res.json()) as {
      events?: Array<{ eventAction?: string; eventDate?: string }>;
    };

    const expirationEvent = data.events?.find(
      (e) => e.eventAction === "expiration" && typeof e.eventDate === "string"
    );

    if (!expirationEvent?.eventDate) {
      return {
        status: "unknown",
        expiryDate: null,
        daysRemaining: null,
        issuer: null,
        errorMessage: "Domain expiry date is redacted or unavailable in RDAP.",
      };
    }

    const expiryDate = new Date(expirationEvent.eventDate).toISOString();
    const { status, daysRemaining } = computeExpiryStatus(expiryDate);

    return {
      status,
      expiryDate,
      daysRemaining,
      issuer: "RDAP Registry",
      errorMessage: null,
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    return {
      status: "unknown",
      expiryDate: null,
      daysRemaining: null,
      issuer: null,
      errorMessage:
        err instanceof Error && err.name === "AbortError"
          ? "RDAP lookup timed out."
          : "RDAP lookup unavailable.",
    };
  }
}

export function determineReminderThreshold(
  daysRemaining: number | null
): "30d" | "7d" | "1d" | "expired" | null {
  if (daysRemaining === null) return null;
  if (daysRemaining <= 0) return "expired";
  if (daysRemaining <= 1) return "1d";
  if (daysRemaining <= 7) return "7d";
  if (daysRemaining <= 30) return "30d";
  return null;
}
