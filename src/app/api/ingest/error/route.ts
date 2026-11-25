import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrubString, scrubRoute, scrubStack, extractBrowserFamily } from "@/lib/errors/scrubber";
import { computeFingerprint, deriveSeverity } from "@/lib/errors/fingerprint";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024; // 16 KB
const RATE_LIMIT_PER_MINUTE = 60;
const RATE_LIMIT_PER_DAY = 2000;

function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function truncate(s: string | null | undefined, maxLen: number): string {
  if (!s) return "";
  return s.slice(0, maxLen);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Body size guard
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  // 2. Read and size-check body
  let rawBody: string;
  try {
    rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // 3. Parse JSON — strict shape validation
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    typeof payload.message !== "string" ||
    typeof payload.name !== "string" ||
    typeof payload.stack !== "string"
  ) {
    return NextResponse.json({ error: "Missing required fields: message, name, stack" }, { status: 422 });
  }

  // 4. Authenticate ingest key
  const rawKey = request.headers.get("x-pulse-key");
  if (!rawKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keyHash = hashKey(rawKey.trim());
  const supabaseAdmin = createAdminClient();

  const { data: ingestKey, error: keyErr } = await supabaseAdmin
    .from("ingest_keys")
    .select("id, application_id, user_id, allowed_origins, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (keyErr || !ingestKey || ingestKey.revoked_at) {
    // Generic 401 — do not reveal which field failed
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 5. CORS / Origin check
  const origin = request.headers.get("origin");
  const allowedOrigins: string[] = ingestKey.allowed_origins || [];

  if (origin && allowedOrigins.length > 0) {
    const isAllowed = allowedOrigins.some((o) => {
      const normalized = o.trim().toLowerCase();
      return origin.toLowerCase() === normalized;
    });
    if (!isAllowed) {
      return new NextResponse(null, {
        status: 403,
        headers: { "Vary": "Origin" },
      });
    }
  }

  // Build CORS response headers for allowed browser requests
  const corsHeaders: Record<string, string> = { "Vary": "Origin" };
  if (origin && allowedOrigins.length > 0) {
    corsHeaders["Access-Control-Allow-Origin"] = origin;
    corsHeaders["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    corsHeaders["Access-Control-Allow-Headers"] = "Content-Type, x-pulse-key";
  }

  // 6. Rate limiting — per-minute and per-day
  const now = new Date();
  const windowMinute = new Date(Math.floor(now.getTime() / 60000) * 60000).toISOString();

  // Upsert minute counter via RPC
  let minuteCount = 0;
  try {
    const rpcRes = await supabaseAdmin.rpc("upsert_error_rate_limit", {
      p_key_id: ingestKey.id,
      p_window: windowMinute,
    });
    // rpc returns the first row's value directly in data when it's a scalar table function
    if (Array.isArray(rpcRes.data) && rpcRes.data.length > 0) {
      minuteCount = (rpcRes.data[0] as { count: number }).count ?? 0;
    }
  } catch { /* rate limit table may not exist yet — degrade gracefully */ }
  if (minuteCount > RATE_LIMIT_PER_MINUTE) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: corsHeaders });
  }

  // Check 24h count for this application
  const dayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { count: dayCount } = await supabaseAdmin
    .from("error_events")
    .select("*", { count: "exact", head: true })
    .eq("application_id", ingestKey.application_id)
    .gte("occurred_at", dayStart);

  if ((dayCount ?? 0) >= RATE_LIMIT_PER_DAY) {
    return NextResponse.json({ error: "Daily limit exceeded" }, { status: 429, headers: corsHeaders });
  }

  // 7. Extract and scrub fields
  const errorName = truncate(scrubString(String(payload.name)), 200);
  const errorMessage = truncate(scrubString(String(payload.message)), 500);
  const rawStack = truncate(String(payload.stack), 10000);
  const route = payload.route ? scrubRoute(String(payload.route)) : "/";
  const release = payload.release ? truncate(scrubString(String(payload.release)), 100) : null;
  const rawUA = payload.userAgent ? String(payload.userAgent) : request.headers.get("user-agent") || "";
  const userAgentFamily = extractBrowserFamily(rawUA);
  const stackExcerpt = scrubStack(rawStack, 15);

  // 8. Compute fingerprint
  const fingerprint = computeFingerprint(errorName, errorMessage, rawStack);
  const title = `${errorName}: ${errorMessage}`.slice(0, 300);

  // 9. Upsert error group
  const nowIso = now.toISOString();

  const { data: existingGroup } = await supabaseAdmin
    .from("error_groups")
    .select("id, count_total, count_24h, status, first_seen, severity, alerted_new_at, alerted_thresholds")
    .eq("application_id", ingestKey.application_id)
    .eq("fingerprint", fingerprint)
    .maybeSingle();

  let groupId: string;
  let isNewGroup = false;
  let newCount24h = 1;

  if (existingGroup) {
    groupId = existingGroup.id;
    newCount24h = existingGroup.count_24h + 1;
    const newSeverity = deriveSeverity(route, newCount24h, new Date(existingGroup.first_seen).getTime());

    // Reopen resolved groups when they recur
    const newStatus = existingGroup.status === "resolved" ? "open" : existingGroup.status;

    await supabaseAdmin.from("error_groups").update({
      last_seen: nowIso,
      count_total: existingGroup.count_total + 1,
      count_24h: newCount24h,
      last_route: route,
      severity: newSeverity,
      status: newStatus,
    }).eq("id", groupId);
  } else {
    isNewGroup = true;
    const severity = deriveSeverity(route, 1, Date.now());
    const { data: newGroup, error: insertErr } = await supabaseAdmin
      .from("error_groups")
      .insert({
        application_id: ingestKey.application_id,
        user_id: ingestKey.user_id,
        fingerprint,
        title,
        status: "open",
        last_route: route,
        severity,
        first_seen: nowIso,
        last_seen: nowIso,
        count_total: 1,
        count_24h: 1,
      })
      .select("id")
      .single();

    if (insertErr || !newGroup) {
      // Could be a race condition duplicate — try fetching the existing one
      const { data: raceGroup } = await supabaseAdmin
        .from("error_groups")
        .select("id")
        .eq("application_id", ingestKey.application_id)
        .eq("fingerprint", fingerprint)
        .maybeSingle();
      if (!raceGroup) {
        return NextResponse.json({}, { status: 202, headers: corsHeaders });
      }
      groupId = raceGroup.id;
      isNewGroup = false;
    } else {
      groupId = newGroup.id;
    }
  }

  // 10. Insert error event
  await supabaseAdmin.from("error_events").insert({
    group_id: groupId,
    application_id: ingestKey.application_id,
    user_id: ingestKey.user_id,
    route,
    user_agent_family: userAgentFamily,
    release,
    stack_excerpt: stackExcerpt,
    occurred_at: nowIso,
  });

  // 11. Alert logic (best-effort, never throws)
  try {
    await handleAlerts(supabaseAdmin, ingestKey, groupId, isNewGroup, newCount24h, existingGroup);
  } catch {
    // Swallow — alert failure must not fail ingest
  }

  // 12. Return 202 immediately with no body details
  return NextResponse.json({}, { status: 202, headers: corsHeaders });
}

// Handle CORS preflight
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-pulse-key",
    "Vary": "Origin",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return new NextResponse(null, { status: 204, headers });
}

type ExistingGroup = {
  id: string;
  count_24h: number;
  alerted_new_at: string | null;
  alerted_thresholds: Record<string, string>;
} | null;

async function handleAlerts(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  ingestKey: { application_id: string; user_id: string },
  groupId: string,
  isNewGroup: boolean,
  count24h: number,
  existingGroup: ExistingGroup
): Promise<void> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // Alert a: new error group (once per day per group)
  if (isNewGroup) {
    await supabaseAdmin.from("alerts").insert({
      user_id: ingestKey.user_id,
      application_id: ingestKey.application_id,
      severity: "medium",
      title: "New error group detected",
      description: `A new type of error was first seen in your application.`,
    });
    await supabaseAdmin.from("error_groups").update({
      alerted_new_at: now.toISOString(),
    }).eq("id", groupId);
    return;
  }

  if (!existingGroup) return;

  // Alert b: threshold crossing (10, 100) — deduplicated per group per day
  const thresholds = [10, 100];
  const alertedThresholds: Record<string, string> = existingGroup.alerted_thresholds || {};

  for (const threshold of thresholds) {
    const key = String(threshold);
    const lastAlertedAt = alertedThresholds[key];
    if (count24h >= threshold && (!lastAlertedAt || lastAlertedAt < dayAgo)) {
      await supabaseAdmin.from("alerts").insert({
        user_id: ingestKey.user_id,
        application_id: ingestKey.application_id,
        severity: threshold >= 100 ? "high" : "medium",
        title: `Error spike: ${count24h} occurrences in 24h`,
        description: `An error group has occurred ${count24h} times in the last 24 hours.`,
      });
      alertedThresholds[key] = now.toISOString();
      await supabaseAdmin.from("error_groups").update({
        alerted_thresholds: alertedThresholds,
      }).eq("id", groupId);
      break; // alert only the highest crossed threshold per ingest
    }
  }
}
