import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptFlowPassword } from "@/lib/security/flow-check-crypto";
import { validateApplicationUrl } from "@/lib/security/url-validator";

const BATCH_LIMIT = 5;
const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_EXCERPT_CHARS = 200;

function scrubSecrets(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[REDACTED]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[REDACTED]")
    .slice(0, MAX_EXCERPT_CHARS);
}

async function sendSingleFlowRequest(params: {
  loginUrl: string;
  verifiedHost: string;
  contentType: "json" | "form";
  emailField: string;
  passwordField: string;
  testEmail: string;
  password: string;
}): Promise<{ ok: boolean; status: number | null; bodyText: string; error?: string }> {
  let currentUrl = params.loginUrl;
  const maxRedirects = 3;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const val = await validateApplicationUrl(currentUrl);
    if (!val.valid || !val.normalizedUrl) {
      return { ok: false, status: null, bodyText: "", error: "Blocked unsafe URL" };
    }

    const host = new URL(val.normalizedUrl).hostname.toLowerCase();
    if (host !== params.verifiedHost) {
      return {
        ok: false,
        status: null,
        bodyText: "",
        error: "Redirect off verified domain blocked",
      };
    }

    const body =
      params.contentType === "form"
        ? new URLSearchParams({
            [params.emailField]: params.testEmail,
            [params.passwordField]: params.password,
          }).toString()
        : JSON.stringify({
            [params.emailField]: params.testEmail,
            [params.passwordField]: params.password,
          });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(val.normalizedUrl, {
        method: "POST",
        headers: {
          "Content-Type":
            params.contentType === "form"
              ? "application/x-www-form-urlencoded"
              : "application/json",
          "User-Agent": "PulseFlowCheck/1.0",
        },
        body,
        redirect: "manual",
        signal: controller.signal,
      });

      clearTimeout(timer);

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = res.headers.get("location");
        if (!loc) return { ok: true, status: res.status, bodyText: "" };
        currentUrl = new URL(loc, currentUrl).toString();
        continue;
      }

      const buf = await res.arrayBuffer();
      const sliced = buf.slice(0, MAX_RESPONSE_BYTES);
      const text = new TextDecoder().decode(sliced);
      return { ok: true, status: res.status, bodyText: text };
    } catch {
      clearTimeout(timer);
      return { ok: false, status: null, bodyText: "", error: "Request failed or timed out" };
    }
  }

  return { ok: false, status: null, bodyText: "", error: "Too many redirects" };
}

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - THIRTY_MINUTES_MS).toISOString();

  const { data: checks, error } = await admin
    .from("flow_checks")
    .select(
      "id, user_id, application_id, login_url, content_type, email_field, password_field, test_email, encrypted_password, iv, auth_tag, expected_status, expected_text, last_run_at, consecutive_failures, applications!inner(url, domain_verified_at)"
    )
    .eq("enabled", true)
    .not("encrypted_password", "is", null)
    .or(`last_run_at.is.null,last_run_at.lt.${cutoff}`)
    .limit(BATCH_LIMIT);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let processed = 0;

  for (const check of checks || []) {
    const appData = check.applications as unknown as {
      url: string;
      domain_verified_at: string | null;
    };
    if (!appData?.domain_verified_at) continue;

    let password: string;
    try {
      password = decryptFlowPassword({
        encryptedPassword: check.encrypted_password!,
        iv: check.iv!,
        authTag: check.auth_tag!,
      });
    } catch {
      continue;
    }

    const start = Date.now();
    const verifiedHost = new URL(appData.url).hostname.toLowerCase();

    const result = await sendSingleFlowRequest({
      loginUrl: check.login_url,
      verifiedHost,
      contentType: check.content_type as "json" | "form",
      emailField: check.email_field,
      passwordField: check.password_field,
      testEmail: check.test_email,
      password,
    });

    const durationMs = Date.now() - start;
    const statusMatches = result.status === check.expected_status;
    const textMatches =
      !check.expected_text || result.bodyText.includes(check.expected_text);
    const passed = result.ok && statusMatches && textMatches;

    const excerpt = result.error
      ? result.error
      : scrubSecrets(result.bodyText || `HTTP ${result.status ?? "N/A"}`);

    await admin.from("flow_check_results").insert({
      flow_check_id: check.id,
      user_id: check.user_id,
      ok: passed,
      status_code: result.status,
      duration_ms: durationMs,
      excerpt,
    });

    const nextFailures = passed ? 0 : (check.consecutive_failures || 0) + 1;

    await admin
      .from("flow_checks")
      .update({
        last_run_at: new Date().toISOString(),
        last_status: passed ? "ok" : "failing",
        consecutive_failures: nextFailures,
      })
      .eq("id", check.id);

    processed++;
  }

  return NextResponse.json({ ok: true, processed });
}
