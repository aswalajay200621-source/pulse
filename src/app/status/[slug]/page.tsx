import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateMonitoringStats } from "@/lib/monitoring/stats";
import {
  buildPublicStatusPayload,
  checkPublicRateLimit,
  type PublicDailyBar,
  type PublicOverallStatus,
} from "@/lib/status-page";
import type { MonitoringCheckRecord } from "@/lib/supabase/types";

export const revalidate = 60;

async function getPublicStatusData(slug: string) {
  if (!slug || slug.length < 10) return null;

  const supabaseAdmin = createAdminClient();
  const { data: page } = await supabaseAdmin
    .from("status_pages")
    .select("application_id, enabled, display_title, allow_indexing")
    .eq("slug", slug)
    .maybeSingle();

  if (!page || !page.enabled) return null;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [checksRes, incidentsRes] = await Promise.all([
    supabaseAdmin
      .from("monitoring_checks")
      .select("status, checked_at")
      .eq("application_id", page.application_id)
      .gte("checked_at", thirtyDaysAgo)
      .order("checked_at", { ascending: false })
      .limit(1000),
    supabaseAdmin
      .from("monitoring_incidents")
      .select("started_at, resolved_at")
      .eq("application_id", page.application_id)
      .order("started_at", { ascending: false })
      .limit(10),
  ]);

  const checks = (checksRes.data || []) as MonitoringCheckRecord[];
  const stats24h = calculateMonitoringStats(checks, "24h");
  const stats7d = calculateMonitoringStats(checks, "7d");
  const stats30d = calculateMonitoringStats(checks, "30d");

  const latest = stats24h.latestCheck;
  const overallStatus: PublicOverallStatus =
    latest?.status === "down"
      ? "down"
      : latest?.status === "degraded"
      ? "degraded"
      : "operational";

  // Build 30-day daily bars
  const dailyBars: PublicDailyBar[] = [];
  for (let d = 29; d >= 0; d--) {
    const dayDate = new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const dayChecks = checks.filter((c) => c.checked_at.startsWith(dayDate));
    let status: PublicDailyBar["status"] = "no_data";
    if (dayChecks.length > 0) {
      if (dayChecks.some((c) => c.status === "down")) status = "down";
      else if (dayChecks.some((c) => c.status === "degraded")) status = "degraded";
      else status = "operational";
    }
    dailyBars.push({ date: dayDate, status });
  }

  const incidents = (incidentsRes.data || []).map((inc) => {
    const startMs = new Date(inc.started_at).getTime();
    const endMs = inc.resolved_at ? new Date(inc.resolved_at).getTime() : null;
    return {
      startedAt: inc.started_at,
      resolvedAt: inc.resolved_at,
      durationMinutes: endMs ? Math.max(1, Math.round((endMs - startMs) / 60000)) : null,
    };
  });

  return {
    allowIndexing: Boolean(page.allow_indexing),
    payload: buildPublicStatusPayload({
      displayTitle: page.display_title,
      overallStatus,
      uptime24h: stats24h.uptimePercentage,
      uptime7d: stats7d.uptimePercentage,
      uptime30d: stats30d.uptimePercentage,
      dailyBars,
      incidents,
    }),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const res = await getPublicStatusData(slug);
  if (!res) {
    return { title: "Not Found", robots: { index: false, follow: false } };
  }
  return {
    title: `${res.payload.displayTitle} — Status`,
    robots: res.allowIndexing ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export default async function PublicStatusPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkPublicRateLimit(ip, 60, 60_000)) {
    notFound();
  }

  const { slug } = await params;
  const res = await getPublicStatusData(slug);
  if (!res) notFound();

  const { payload } = res;
  const statusBanner =
    payload.overallStatus === "operational"
      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
      : payload.overallStatus === "degraded"
      ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400"
      : "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400";

  const statusText =
    payload.overallStatus === "operational"
      ? "All Systems Operational"
      : payload.overallStatus === "degraded"
      ? "Degraded Performance"
      : "Service Disruption";

  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <h1 className="text-2xl font-bold tracking-tight">{payload.displayTitle}</h1>
          <span className="text-xs text-muted-foreground font-mono">Powered by Pulse</span>
        </div>

        <div className={`rounded-xl border p-4 font-semibold text-sm ${statusBanner}`}>
          {statusText}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "24h Uptime", val: payload.uptime24h },
            { label: "7d Uptime", val: payload.uptime7d },
            { label: "30d Uptime", val: payload.uptime30d },
          ].map((u) => (
            <div key={u.label} className="rounded-lg border border-border/60 bg-card p-3 text-center">
              <p className="text-[11px] text-muted-foreground">{u.label}</p>
              <p className="text-lg font-bold font-mono mt-1">
                {u.val !== null ? `${u.val}%` : "—"}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
          <p className="text-xs font-semibold">30-Day Daily Status</p>
          <div className="flex items-center gap-1">
            {payload.dailyBars.map((bar) => (
              <div
                key={bar.date}
                title={`${bar.date}: ${bar.status}`}
                className={`h-6 flex-1 rounded-sm ${
                  bar.status === "operational"
                    ? "bg-emerald-500"
                    : bar.status === "degraded"
                    ? "bg-yellow-500"
                    : bar.status === "down"
                    ? "bg-red-500"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>30 days ago</span>
            <span>Today</span>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
          <p className="text-xs font-semibold">Past Incidents</p>
          {payload.incidents.length === 0 ? (
            <p className="text-xs text-muted-foreground">No incidents recorded in the last 30 days.</p>
          ) : (
            <div className="space-y-2">
              {payload.incidents.map((inc, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs border-b border-border/40 pb-2 last:border-0 last:pb-0">
                  <span>{new Date(inc.startedAt).toLocaleString()}</span>
                  <span className="font-mono text-muted-foreground">
                    {inc.resolvedAt ? `Resolved (${inc.durationMinutes ?? 1}m)` : "Ongoing"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
