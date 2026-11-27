/**
 * Health-Check Endpoint Support
 *
 * Extends the existing monitoring engine to also check a user-defined
 * health path (e.g. /api/health) with SSRF-safe fetching.
 * Applies the same 3-consecutive-failure rule before alerting.
 */

import { validateApplicationUrl } from "@/lib/security/url-validator";
import { scrubString } from "@/lib/errors/scrubber";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface HealthCheckResult {
  status: "healthy" | "unhealthy" | "timeout" | "error";
  statusCode: number | null;
  responseExcerpt: string | null;
  errorMessage: string | null;
}

const HC_TIMEOUT_MS = 10000;
const MAX_EXCERPT_BYTES = 500;
const CONSECUTIVE_FAILURES_FOR_ALERT = 3;

/** Validate that a health check path or full URL is safe */
export function validateHealthCheckPath(input: string): { valid: boolean; error?: string } {
  if (!input) return { valid: false, error: "Health check URL or path is required." };
  const trimmed = input.trim();
  if (trimmed.length > 500) return { valid: false, error: "URL or path is too long." };

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { valid: false, error: "Health check URL must use http or https." };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: "Invalid health check URL." };
    }
  }

  if (!trimmed.startsWith("/")) return { valid: false, error: "Path must start with / or be a full https:// URL." };
  if (trimmed.includes("?") || trimmed.includes("#") || trimmed.includes("://")) {
    return { valid: false, error: "Relative path cannot contain query strings or fragments." };
  }
  if (!/^[a-zA-Z0-9\-_/.]+$/.test(trimmed)) {
    return { valid: false, error: "Path contains invalid characters." };
  }
  return { valid: true };
}

/**
 * Perform an SSRF-safe health check request.
 * Accepts either a full URL (e.g. https://api.example.com/api/health) or a relative path.
 * Treats 404 or HTML responses as "Health check not set up correctly".
 */
export async function runHealthCheck(
  baseUrl: string,
  healthPathOrUrl: string
): Promise<HealthCheckResult> {
  let fullUrl: string;
  try {
    const trimmed = healthPathOrUrl.trim();
    fullUrl = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : new URL(trimmed, baseUrl).toString();
  } catch {
    return { status: "error", statusCode: null, responseExcerpt: null, errorMessage: "Invalid health check URL." };
  }

  const validation = await validateApplicationUrl(fullUrl);
  if (!validation.valid || !validation.normalizedUrl) {
    return { status: "error", statusCode: null, responseExcerpt: null, errorMessage: validation.error || "URL blocked by security check." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HC_TIMEOUT_MS);

  try {
    const response = await fetch(validation.normalizedUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "PulseHealthCheck/1.0 (+https://pulse.monitor)",
        Accept: "application/json,text/plain,*/*;q=0.8",
      },
    });

    clearTimeout(timer);

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    const bodyText = await response.text().catch(() => "");
    const rawExcerpt = bodyText.slice(0, MAX_EXCERPT_BYTES);
    const responseExcerpt = scrubString(rawExcerpt);

    // 404 or HTML page means health check is not set up properly
    const trimmedBody = bodyText.trim().toLowerCase();
    const isHtml = contentType.includes("text/html") || trimmedBody.startsWith("<!doctype") || trimmedBody.startsWith("<html");
    if (response.status === 404 || isHtml) {
      return {
        status: "unhealthy",
        statusCode: response.status,
        responseExcerpt,
        errorMessage: "Health check not set up correctly",
      };
    }

    if (response.status >= 200 && response.status < 300) {
      try {
        const json = JSON.parse(bodyText);
        if (json.status === "error" || json.ok === false || json.database === "unreachable") {
          return { status: "unhealthy", statusCode: response.status, responseExcerpt, errorMessage: "Database not reachable" };
        }
      } catch {
        // Non-JSON 2xx (e.g. "ok") is fine
      }
      return { status: "healthy", statusCode: response.status, responseExcerpt, errorMessage: null };
    }

    return {
      status: "unhealthy",
      statusCode: response.status,
      responseExcerpt,
      errorMessage: response.status === 503 ? "Database not reachable" : `Server error (${response.status})`,
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    const isTimeout = err instanceof Error && (err.name === "AbortError" || err.message.includes("aborted"));
    return {
      status: isTimeout ? "timeout" : "error",
      statusCode: null,
      responseExcerpt: null,
      errorMessage: isTimeout ? "No response after 10 seconds" : "Could not connect to health endpoint",
    };
  }
}

/**
 * Record a health check result and apply the 3-consecutive-failure rule.
 * Inserts into health_check_results and manages health_check_incidents.
 * Failure of this function must NOT throw — called from monitoring job.
 */
export async function recordHealthCheckResult(
  supabaseAdmin: SupabaseClient,
  applicationId: string,
  userId: string,
  appName: string,
  result: HealthCheckResult,
  healthPath: string
): Promise<void> {
  try {
    await supabaseAdmin.from("health_check_results").insert({
      application_id: applicationId,
      status: result.status,
      status_code: result.statusCode,
      response_excerpt: result.responseExcerpt,
      error_message: result.errorMessage,
    });

    // Check for existing open incident
    const { data: openIncident } = await supabaseAdmin
      .from("health_check_incidents")
      .select("id")
      .eq("application_id", applicationId)
      .eq("status", "open")
      .maybeSingle();

    if (result.status === "healthy") {
      // Recovery: resolve open incident
      if (openIncident) {
        await supabaseAdmin
          .from("health_check_incidents")
          .update({ status: "resolved", resolved_at: new Date().toISOString() })
          .eq("id", openIncident.id);

        await supabaseAdmin.from("alerts").insert({
          user_id: userId,
          application_id: applicationId,
          severity: "low",
          title: `${appName} health check recovered`,
          description: `Health endpoint ${healthPath} is now returning healthy status.`,
        });
      }
      return;
    }

    if (openIncident) return; // already alerted

    // Check 3 consecutive failures
    const { data: recent } = await supabaseAdmin
      .from("health_check_results")
      .select("status")
      .eq("application_id", applicationId)
      .order("checked_at", { ascending: false })
      .limit(CONSECUTIVE_FAILURES_FOR_ALERT);

    if (
      recent &&
      recent.length >= CONSECUTIVE_FAILURES_FOR_ALERT &&
      recent.every((r) => r.status !== "healthy")
    ) {
      const { error: incErr } = await supabaseAdmin.from("health_check_incidents").insert({
        application_id: applicationId,
        user_id: userId,
        status: "open",
        consecutive_failures: CONSECUTIVE_FAILURES_FOR_ALERT,
        last_error: result.errorMessage || "Health check failed",
      });

      if (!incErr) {
        await supabaseAdmin.from("alerts").insert({
          user_id: userId,
          application_id: applicationId,
          severity: "high",
          title: `${appName} health check failing`,
          description: `Health endpoint ${healthPath} has failed ${CONSECUTIVE_FAILURES_FOR_ALERT} consecutive checks. Last error: ${result.errorMessage || "unknown"}`,
        });
      }
    }
  } catch {
    // Swallow — must not break monitoring run
  }
}
