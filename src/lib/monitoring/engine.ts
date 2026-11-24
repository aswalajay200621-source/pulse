import { validateApplicationUrl } from "@/lib/security/url-validator";
import type { ApplicationRecord } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const SLOW_RESPONSE_THRESHOLD_MS = 1500;
export const DEFAULT_TIMEOUT_MS = 10000;
export const MAX_REDIRECTS = 3;
export const CONSECUTIVE_FAILURES_FOR_DOWNTIME = 3;

export interface SafeCheckResult {
  ok: boolean;
  status: "online" | "degraded" | "down";
  statusCode: number | null;
  responseTimeMs: number | null;
  isSlow: boolean;
  errorMessage: string | null;
}

/**
 * Performs an HTTP/HTTPS GET request with strict SSRF protection:
 * - Validates initial URL (protocol, hostname, DNS resolution, private/loopback/metadata IP blocking)
 * - Uses manual redirect handling and re-validates every redirect target
 * - Limits redirects to MAX_REDIRECTS
 * - Enforces request timeout via AbortController
 */
export async function safeFetchWithSsrfProtection(
  targetUrl: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  maxRedirects: number = MAX_REDIRECTS
): Promise<SafeCheckResult> {
  let currentUrl = targetUrl;
  const startTime = Date.now();

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const validation = await validateApplicationUrl(currentUrl);
    if (!validation.valid || !validation.normalizedUrl) {
      return {
        ok: false,
        status: "down",
        statusCode: null,
        responseTimeMs: null,
        isSlow: false,
        errorMessage: validation.error || "URL failed SSRF security validation.",
      };
    }

    currentUrl = validation.normalizedUrl;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "PulseMonitor/1.0 (+https://pulse.monitor)",
          Accept: "text/html,application/json,*/*;q=0.8",
        },
      });

      clearTimeout(timer);

      // Handle redirects manually so every hop is SSRF-validated
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          const elapsed = Date.now() - startTime;
          return {
            ok: false,
            status: "down",
            statusCode: response.status,
            responseTimeMs: elapsed,
            isSlow: elapsed > SLOW_RESPONSE_THRESHOLD_MS,
            errorMessage: `Redirect (${response.status}) missing Location header.`,
          };
        }

        if (hop === maxRedirects) {
          const elapsed = Date.now() - startTime;
          return {
            ok: false,
            status: "down",
            statusCode: response.status,
            responseTimeMs: elapsed,
            isSlow: elapsed > SLOW_RESPONSE_THRESHOLD_MS,
            errorMessage: `Exceeded maximum redirect limit (${maxRedirects}).`,
          };
        }

        // Resolve relative redirect URLs against currentUrl
        try {
          currentUrl = new URL(location, currentUrl).toString();
        } catch {
          return {
            ok: false,
            status: "down",
            statusCode: response.status,
            responseTimeMs: Date.now() - startTime,
            isSlow: false,
            errorMessage: "Invalid redirect Location URL.",
          };
        }
        continue;
      }

      const elapsed = Date.now() - startTime;
      const isSlow = elapsed > SLOW_RESPONSE_THRESHOLD_MS;

      if (response.status >= 200 && response.status < 400) {
        return {
          ok: true,
          status: isSlow ? "degraded" : "online",
          statusCode: response.status,
          responseTimeMs: elapsed,
          isSlow,
          errorMessage: null,
        };
      }

      return {
        ok: false,
        status: "down",
        statusCode: response.status,
        responseTimeMs: elapsed,
        isSlow,
        errorMessage: `HTTP ${response.status} ${response.statusText}`.trim(),
      };
    } catch (err: unknown) {
      clearTimeout(timer);
      const elapsed = Date.now() - startTime;
      const isTimeout =
        err instanceof Error && (err.name === "AbortError" || err.message.includes("aborted"));

      return {
        ok: false,
        status: "down",
        statusCode: null,
        responseTimeMs: isTimeout ? timeoutMs : elapsed,
        isSlow: isTimeout,
        errorMessage: isTimeout
          ? `Request timed out after ${timeoutMs}ms`
          : err instanceof Error
          ? err.message
          : "Network request failed",
      };
    }
  }

  return {
    ok: false,
    status: "down",
    statusCode: null,
    responseTimeMs: Date.now() - startTime,
    isSlow: false,
    errorMessage: "Unexpected redirect loop.",
  };
}

/**
 * Records a monitoring check and evaluates downtime/recovery state:
 * - Requires 3 consecutive failures before creating an open incident.
 * - Prevents duplicate open incidents.
 * - Resolves open incidents when the application recovers.
 */
export async function recordCheckAndEvaluateHealth(
  supabaseAdmin: SupabaseClient,
  app: ApplicationRecord,
  result: SafeCheckResult,
  jobId?: string
): Promise<void> {
  // 1. Insert the monitoring check record
  const { error: insertError } = await supabaseAdmin.from("monitoring_checks").insert({
    application_id: app.id,
    status: result.status,
    status_code: result.statusCode,
    response_time: result.responseTimeMs,
    is_slow: result.isSlow,
    error_message: result.errorMessage,
    job_id: jobId ?? null,
  });

  if (insertError) {
    console.error(`[Monitor] Failed to insert check for app ${app.id}:`, insertError.message);
    return;
  }

  // 2. Check for an existing open incident
  const { data: openIncident } = await supabaseAdmin
    .from("monitoring_incidents")
    .select("id")
    .eq("application_id", app.id)
    .eq("status", "open")
    .maybeSingle();

  if (result.ok) {
    // Recovery detection: resolve open incident if one exists
    if (openIncident) {
      await supabaseAdmin
        .from("monitoring_incidents")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", openIncident.id);

      await supabaseAdmin.from("alerts").insert({
        user_id: app.user_id,
        application_id: app.id,
        severity: "low",
        title: `${app.name} has recovered`,
        description: `Endpoint ${app.url} is responding normally (HTTP ${result.statusCode}, ${result.responseTimeMs}ms).`,
      });
    }
    return;
  }

  // 3. Failure path: check last 3 checks for consecutive failures
  if (openIncident) {
    // Duplicate incident prevention: already have an open incident
    return;
  }

  const { data: recentChecks } = await supabaseAdmin
    .from("monitoring_checks")
    .select("status")
    .eq("application_id", app.id)
    .order("checked_at", { ascending: false })
    .limit(CONSECUTIVE_FAILURES_FOR_DOWNTIME);

  if (
    recentChecks &&
    recentChecks.length >= CONSECUTIVE_FAILURES_FOR_DOWNTIME &&
    recentChecks.every((c) => c.status === "down")
  ) {
    const { error: incidentErr } = await supabaseAdmin.from("monitoring_incidents").insert({
      application_id: app.id,
      user_id: app.user_id,
      status: "open",
      consecutive_failures: CONSECUTIVE_FAILURES_FOR_DOWNTIME,
      last_error: result.errorMessage || "3 consecutive failed health checks",
    });

    if (!incidentErr) {
      await supabaseAdmin.from("alerts").insert({
        user_id: app.user_id,
        application_id: app.id,
        severity: "critical",
        title: `${app.name} is down`,
        description: `Confirmed downtime after ${CONSECUTIVE_FAILURES_FOR_DOWNTIME} consecutive failed checks. Last error: ${
          result.errorMessage || "Unknown error"
        }`,
      });
    }
  }
}
