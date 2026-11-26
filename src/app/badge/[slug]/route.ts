import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateMonitoringStats } from "@/lib/monitoring/stats";
import {
  buildStatusBadgeSvg,
  checkPublicRateLimit,
  type PublicOverallStatus,
} from "@/lib/status-page";
import type { MonitoringCheckRecord } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkPublicRateLimit(ip, 60, 60_000)) {
    return new NextResponse("Rate limit exceeded", { status: 429 });
  }

  const { slug } = await context.params;
  if (!slug || slug.length < 10) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const supabaseAdmin = createAdminClient();
  const { data: page } = await supabaseAdmin
    .from("status_pages")
    .select("application_id, enabled")
    .eq("slug", slug)
    .maybeSingle();

  if (!page || !page.enabled) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: checksData } = await supabaseAdmin
    .from("monitoring_checks")
    .select("status, checked_at")
    .eq("application_id", page.application_id)
    .gte("checked_at", thirtyDaysAgo)
    .order("checked_at", { ascending: false })
    .limit(1000);

  const checks = (checksData || []) as MonitoringCheckRecord[];
  const stats30d = calculateMonitoringStats(checks, "30d");
  const latest = stats30d.latestCheck;
  const status: PublicOverallStatus =
    latest?.status === "down"
      ? "down"
      : latest?.status === "degraded"
      ? "degraded"
      : "operational";

  const svg = buildStatusBadgeSvg(status, stats30d.uptimePercentage);

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=60",
    },
  });
}
