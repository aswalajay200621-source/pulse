/**
 * Weekly report email cron endpoint.
 * Scheduled via cron-job.org (or Vercel Cron) to run once a week.
 * Sends the weekly digest email to every user who has a report this week.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, buildWeeklyReportEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function verifyCronSecret(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader || !authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7).trim();
  if (token.length !== secret.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret));
}

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Find unsent reports from the past 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: reports, error } = await supabase
    .from("weekly_reports")
    .select("*")
    .eq("email_sent", false)
    .gte("created_at", sevenDaysAgo);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!reports?.length) {
    return NextResponse.json({ ok: true, sent: 0, message: "No unsent reports" });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://pulse-woad-nine.vercel.app";
  let sent = 0;

  for (const report of reports) {
    try {
      // Get user email
      const { data: userData } = await supabase.auth.admin.getUserById(report.user_id);
      const ownerEmail = userData.user?.email;
      if (!ownerEmail) continue;

      const { htmlContent, textContent } = buildWeeklyReportEmail({
        periodStart: new Date(report.period_start).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        periodEnd: new Date(report.period_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        appsMonitored: report.apps_monitored ?? 0,
        uptimePct: report.uptime_percentage,
        incidents: report.downtime_incidents ?? 0,
        newFindings: report.new_findings ?? 0,
        recommendedActions: report.recommended_actions ?? [],
        dashboardUrl: `${baseUrl}/dashboard`,
      });

      const result = await sendEmail({
        to: [{ email: ownerEmail }],
        subject: `📊 Your Pulse Weekly Report — ${new Date(report.period_end).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
        htmlContent,
        textContent,
      });

      if (result.ok) {
        await supabase
          .from("weekly_reports")
          .update({ email_sent: true })
          .eq("id", report.id);
        sent++;
      }
    } catch (err) {
      console.error("[WeeklyReport] Failed to send email for report", report.id, err);
    }
  }

  return NextResponse.json({ ok: true, sent, total: reports.length });
}
