import { validateApplicationUrl } from "@/lib/security/url-validator";
import type { ApplicationRecord } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, buildAlertEmail } from "@/lib/email";

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
export interface KeywordRule {
  enabled: boolean;
  value: string;
  mode: "contains" | "not_contains";
}

function formatPlainFailureReason(status: number): string {
  if (status === 404) return "Page not found (404)";
  if (status >= 500) return `Server error (${status})`;
  return `Site returned an error (${status})`;
}

export async function safeFetchWithSsrfProtection(
  targetUrl: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  maxRedirects: number = MAX_REDIRECTS,
  keywordRule?: KeywordRule
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
        if (keywordRule?.enabled && keywordRule.value.trim()) {
          const bodyText = await response.text().catch(() => "");
          const needle = keywordRule.value.trim().toLowerCase();
          const found = bodyText.toLowerCase().includes(needle);
          if (keywordRule.mode === "contains" && !found) {
            return {
              ok: false,
              status: "down",
              statusCode: response.status,
              responseTimeMs: elapsed,
              isSlow,
              errorMessage: `Expected word "${keywordRule.value.trim()}" not found on page`,
            };
          }
          if (keywordRule.mode === "not_contains" && found) {
            return {
              ok: false,
              status: "down",
              statusCode: response.status,
              responseTimeMs: elapsed,
              isSlow,
              errorMessage: `Error word "${keywordRule.value.trim()}" found on page`,
            };
          }
        }
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
        errorMessage: formatPlainFailureReason(response.status),
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
          ? "No response after 10 seconds"
          : "Could not connect to the site",
      };
    }
  }

  return {
    ok: false,
    status: "down",
    statusCode: null,
    responseTimeMs: Date.now() - startTime,
    isSlow: false,
    errorMessage: "Too many redirects",
  };
}

/**
 * False-alarm protection: when a check fails, wait ~30s and re-check once.
 * Only returns DOWN if the retry also fails.
 */
export async function checkWithRetry(
  targetUrl: string,
  keywordRule?: KeywordRule,
  retryDelayMs: number = 30000
): Promise<{ result: SafeCheckResult; retried: boolean }> {
  const first = await safeFetchWithSsrfProtection(targetUrl, DEFAULT_TIMEOUT_MS, MAX_REDIRECTS, keywordRule);
  if (first.ok) {
    return { result: first, retried: false };
  }
  if (retryDelayMs > 0) {
    await new Promise((r) => setTimeout(r, retryDelayMs));
  }
  const second = await safeFetchWithSsrfProtection(targetUrl, DEFAULT_TIMEOUT_MS, MAX_REDIRECTS, keywordRule);
  return { result: second, retried: true };
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
  jobId?: string,
  checkType: "website" | "health" = "website"
): Promise<void> {
  // 1. Insert the monitoring check record
  const { error: insertError } = await supabaseAdmin.from("monitoring_checks").insert({
    application_id: app.id,
    check_type: checkType,
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
    .select("id, started_at")
    .eq("application_id", app.id)
    .eq("status", "open")
    .maybeSingle();

  if (result.ok) {
    // Recovery detection: resolve open incident if one exists
    if (openIncident) {
      const resolvedAt = new Date();
      await supabaseAdmin
        .from("monitoring_incidents")
        .update({
          status: "resolved",
          resolved_at: resolvedAt.toISOString(),
        })
        .eq("id", openIncident.id);

      const startedMs = openIncident.started_at ? new Date(openIncident.started_at).getTime() : resolvedAt.getTime();
      const downMinutes = Math.max(1, Math.round((resolvedAt.getTime() - startedMs) / 60000));

      await supabaseAdmin.from("alerts").insert({
        user_id: app.user_id,
        application_id: app.id,
        severity: "low",
        title: `${app.name} is back online`,
        description: `Your app is responding again after about ${downMinutes} minute(s) of downtime.`,
      });

      // Send one recovery email
      try {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(app.user_id);
        const ownerEmail = userData.user?.email;
        if (ownerEmail) {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://pulse-woad-nine.vercel.app";
          const { htmlContent, textContent } = buildAlertEmail({
            appName: app.name,
            appUrl: app.url,
            severity: "low",
            findings: [`Your app is back online after ${downMinutes} minute(s) of downtime.`],
            dashboardUrl: `${baseUrl}/dashboard/applications/${app.id}`,
          });
          await sendEmail({
            to: [{ email: ownerEmail }],
            subject: `✅ ${app.name} is back online`,
            htmlContent,
            textContent,
          });
        }
      } catch {
        // Non-fatal
      }
    }
    return;
  }

  // 3. Failure path: if incident already open, do not send duplicate alerts
  if (openIncident) {
    return;
  }

  const reason = result.errorMessage || "Site is not responding";
  const { error: incidentErr } = await supabaseAdmin.from("monitoring_incidents").insert({
    application_id: app.id,
    user_id: app.user_id,
    status: "open",
    consecutive_failures: 2,
    last_error: reason,
  });

  if (!incidentErr) {
    await supabaseAdmin.from("alerts").insert({
      user_id: app.user_id,
      application_id: app.id,
      severity: "critical",
      title: `${app.name} is down`,
      description: `Pulse checked your app twice (30 seconds apart) and it failed both times: ${reason}.`,
    });

    // Send one alert email when incident opens
    try {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(app.user_id);
      const ownerEmail = userData.user?.email;
      if (ownerEmail) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://pulse-woad-nine.vercel.app";
        const { htmlContent, textContent } = buildAlertEmail({
          appName: app.name,
          appUrl: app.url,
          severity: "critical",
          findings: [
            `Reason: ${reason}`,
            `What to do next: Check if your server is running or if your database is paused.`,
          ],
          dashboardUrl: `${baseUrl}/dashboard/applications/${app.id}`,
        });
        await sendEmail({
          to: [{ email: ownerEmail }],
          subject: `🚨 ${app.name} is down — ${reason}`,
          htmlContent,
          textContent,
        });
      }
    } catch {
      // Non-fatal
    }
  }
}
