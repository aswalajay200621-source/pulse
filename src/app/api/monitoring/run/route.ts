import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  safeFetchWithSsrfProtection,
  recordCheckAndEvaluateHealth,
} from "@/lib/monitoring/engine";
import { runHealthCheck, recordHealthCheckResult } from "@/lib/monitoring/health-check";
import type { ApplicationRecord } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function verifyCronSecret(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.slice(7).trim();
  if (token.length !== secret.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret));
}

function getTenMinuteBucketKey(date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const minBucket = String(Math.floor(date.getUTCMinutes() / 10) * 10).padStart(2, "0");
  return `cron-${yyyy}-${mm}-${dd}T${hh}:${minBucket}Z`;
}

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let customKey: string | undefined;
  try {
    const body = await request.json();
    if (body && typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()) {
      customKey = body.idempotencyKey.trim();
    }
  } catch {
    // Empty body is fine
  }

  const idempotencyKey = customKey || getTenMinuteBucketKey();
  const supabaseAdmin = createAdminClient();

  // 1. Acquire idempotent job lock
  const { data: job, error: jobInsertError } = await supabaseAdmin
    .from("monitoring_jobs")
    .insert({
      idempotency_key: idempotencyKey,
      status: "running",
    })
    .select()
    .single();

  if (jobInsertError) {
    if (jobInsertError.code === "23505") {
      return NextResponse.json({
        skipped: true,
        idempotencyKey,
        reason: "Duplicate scheduled job for this 10-minute window.",
      });
    }
    return NextResponse.json(
      { error: "Failed to initialize monitoring job", details: jobInsertError.message },
      { status: 500 }
    );
  }

  try {
    // 2. Fetch all monitoring-enabled applications (no user session required)
    const { data: apps, error: appsError } = await supabaseAdmin
      .from("applications")
      .select("*")
      .eq("monitoring_enabled", true);

    if (appsError) {
      throw new Error(`Failed to load applications: ${appsError.message}`);
    }

    const enabledApps = (apps || []) as ApplicationRecord[];
    let succeededCount = 0;
    let failedCount = 0;

    // 3. Process in bounded batches of 5
    const BATCH_SIZE = 5;
    for (let i = 0; i < enabledApps.length; i += BATCH_SIZE) {
      const batch = enabledApps.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (app) => {
          const checkResult = await safeFetchWithSsrfProtection(app.url);
          await recordCheckAndEvaluateHealth(supabaseAdmin, app, checkResult, job.id);

          // Feature 2: Health check endpoint (best-effort, never throws)
          if (app.health_check_enabled && app.health_check_path) {
            try {
              const hcResult = await runHealthCheck(app.url, app.health_check_path);
              await recordHealthCheckResult(supabaseAdmin, app.id, app.user_id, app.name, hcResult, app.health_check_path);
            } catch { /* swallow — must not break uptime monitoring */ }
          }

          return checkResult;
        })
      );

      for (const res of results) {
        if (res.status === "fulfilled" && res.value.ok) {
          succeededCount++;
        } else {
          failedCount++;
        }
      }
    }

    // 4. Mark job completed
    await supabaseAdmin
      .from("monitoring_jobs")
      .update({
        status: "completed",
        total_apps: enabledApps.length,
        succeeded_count: succeededCount,
        failed_count: failedCount,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      idempotencyKey,
      totalApps: enabledApps.length,
      succeededCount,
      failedCount,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown monitoring worker error";
    await supabaseAdmin
      .from("monitoring_jobs")
      .update({
        status: "failed",
        error_message: message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    return NextResponse.json({ error: message, jobId: job.id }, { status: 500 });
  }
}
