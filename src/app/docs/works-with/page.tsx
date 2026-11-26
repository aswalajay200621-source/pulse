import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Works With — Pulse",
  description:
    "How Pulse complements uptime monitors, error trackers, and observability tools — and when to use them together.",
};

export default function WorksWithPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Works With</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pulse is focused on external health monitoring and security posture for
          your web applications. This page explains how it fits alongside other
          common tools — and when you might want to use them together.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          <em>Last reviewed: [DATE — fill in before publishing]</em>
        </p>
      </div>

      {/* What Pulse covers */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">What Pulse covers</h2>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>HTTP/HTTPS uptime checks (periodic external checks)</li>
          <li>Response-time tracking and 24 h / 7 d / 30 d uptime history</li>
          <li>SSL certificate expiry monitoring</li>
          <li>Domain registration expiry monitoring</li>
          <li>Basic security header scanning</li>
          <li>Client-side error capture via a lightweight JS snippet</li>
          <li>GitHub Actions build-status integration</li>
          <li>Weekly digest emails with a health summary</li>
          <li>An opt-in public status page per application</li>
        </ul>
      </section>

      {/* What Pulse does not cover */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">What Pulse does not cover</h2>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Deep server-side performance profiling or APM traces</li>
          <li>Log aggregation or log-based alerting</li>
          <li>Multi-step synthetic browser tests (e.g., Playwright flows)</li>
          <li>On-call scheduling and escalation policy management</li>
          <li>Real user monitoring (RUM) or Core Web Vitals at scale</li>
          <li>Alerting via phone call or SMS</li>
          <li>Infrastructure-level metrics (CPU, memory, disk)</li>
        </ul>
      </section>

      {/* UptimeRobot */}
      <section className="space-y-2 rounded-lg border border-border/60 p-4">
        <h2 className="text-base font-semibold">Pulse + UptimeRobot</h2>
        <p className="text-sm text-muted-foreground">
          UptimeRobot is a mature uptime-monitoring service with SMS and phone-call
          alerts and very short check intervals (every 5 minutes on the free tier).
          Pulse adds SSL/domain expiry tracking, security-header scanning, error
          capture, and GitHub health — things UptimeRobot does not do.
        </p>
        <p className="text-sm text-muted-foreground">
          <strong>Use together when:</strong> you need sub-5-minute alerting or
          phone-call escalation from UptimeRobot, while Pulse handles the broader
          security and health picture.
        </p>
        <div className="rounded-md bg-muted/40 p-3 text-xs space-y-1">
          <p className="font-medium">Exporting from UptimeRobot:</p>
          <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
            <li>Log in → <em>My Monitors</em></li>
            <li>Click <em>Bulk Actions</em> → <em>Export Monitors</em></li>
            <li>Download the CSV, then paste the URL column into Pulse&apos;s Bulk Import</li>
          </ol>
        </div>
      </section>

      {/* Better Stack */}
      <section className="space-y-2 rounded-lg border border-border/60 p-4">
        <h2 className="text-base font-semibold">Pulse + Better Stack (Uptime)</h2>
        <p className="text-sm text-muted-foreground">
          Better Stack Uptime offers uptime monitoring, incident management,
          on-call scheduling, and status pages. It is a more complete on-call
          product. Pulse is simpler and free, targeting solo developers or small
          teams who want a quick health overview without configuring escalation
          policies.
        </p>
        <p className="text-sm text-muted-foreground">
          <strong>Use together when:</strong> your team already uses Better Stack
          for on-call, but you also want Pulse&apos;s security-header and
          certificate-expiry checks in one dashboard.
        </p>
        <div className="rounded-md bg-muted/40 p-3 text-xs space-y-1">
          <p className="font-medium">Exporting from Better Stack Uptime:</p>
          <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
            <li>Go to <em>Monitors</em> in the sidebar</li>
            <li>Use the Better Stack API (<code>/api/v2/monitors</code>) to list all monitors as JSON — the free tier includes API access</li>
            <li>Extract the <code>url</code> field from each monitor and paste into Pulse&apos;s Bulk Import</li>
          </ol>
        </div>
      </section>

      {/* Sentry */}
      <section className="space-y-2 rounded-lg border border-border/60 p-4">
        <h2 className="text-base font-semibold">Pulse + Sentry</h2>
        <p className="text-sm text-muted-foreground">
          Sentry specialises in runtime error tracking, performance monitoring,
          and release health across your code. Pulse&apos;s built-in error capture
          is intentionally lightweight — it surfaces error groups in one dashboard
          alongside uptime and security data, so you don&apos;t need a separate tab for
          basic error awareness. For complex, high-volume error triage, Sentry&apos;s
          filtering, source maps, and performance tools go much further.
        </p>
        <p className="text-sm text-muted-foreground">
          <strong>Use together when:</strong> you want Sentry&apos;s full error
          pipeline but also want Pulse&apos;s uptime, SSL, and domain expiry checks in
          a single lightweight dashboard.
        </p>
      </section>

      {/* General note */}
      <section className="text-sm text-muted-foreground space-y-1">
        <p>
          There is no technical integration between Pulse and these services —
          they run independently. The comparison above is based on each
          product&apos;s publicly documented free-tier capabilities as of the last
          review date above. Features change; always check the current docs before
          deciding.
        </p>
        <p>
          Have a tool you&apos;d like to see covered here?{" "}
          <Link href="/dashboard" className="underline underline-offset-2 hover:text-foreground">
            Open a discussion on GitHub
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
