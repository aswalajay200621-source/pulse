/**
 * Brevo (formerly Sendinblue) email utility for PULSE transactional emails.
 * Uses the REST API directly (fetch) so no SDK import issues with Next.js edge.
 */

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

function getBrevoHeaders() {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY is not set");
  return {
    "api-key": apiKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function getSender() {
  return {
    name: process.env.BREVO_FROM_NAME ?? "Pulse",
    email: process.env.BREVO_FROM_EMAIL ?? "aswalajay200621@gmail.com",
  };
}

export interface SendEmailOptions {
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
  textContent?: string;
}

/**
 * Send a transactional email via Brevo.
 * Returns { ok: true } on success, { ok: false, error: string } on failure.
 */
export async function sendEmail(
  opts: SendEmailOptions
): Promise<{ ok: boolean; error?: string }> {
  try {
    const body = {
      sender: getSender(),
      to: opts.to,
      subject: opts.subject,
      htmlContent: opts.htmlContent,
      ...(opts.textContent ? { textContent: opts.textContent } : {}),
    };

    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: getBrevoHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[email] Brevo error:", res.status, errText);
      return { ok: false, error: `Brevo ${res.status}: ${errText}` };
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[email] sendEmail failed:", msg);
    return { ok: false, error: msg };
  }
}

// ─── Email templates ────────────────────────────────────────────────────────

export function buildAlertEmail(opts: {
  appName: string;
  appUrl: string;
  severity: string;
  findings: string[];
  dashboardUrl: string;
}) {
  const severityColor =
    opts.severity === "critical"
      ? "#dc2626"
      : opts.severity === "high"
        ? "#ea580c"
        : "#ca8a04";

  const findingsList = opts.findings
    .map((f) => `<li style="margin-bottom:4px;">${f}</li>`)
    .join("");

  const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:Inter,Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:0;">
  <div style="max-width:600px;margin:40px auto;background:#1e293b;border-radius:12px;overflow:hidden;">
    <div style="background:${severityColor};padding:20px 32px;">
      <h1 style="margin:0;font-size:20px;color:#fff;">
        🚨 ${opts.severity.toUpperCase()} Security Alert — ${opts.appName}
      </h1>
    </div>
    <div style="padding:32px;">
      <p style="margin-top:0;">Pulse detected new security findings for <strong>${opts.appName}</strong>:</p>
      <ul style="padding-left:20px;line-height:1.8;">
        ${findingsList}
      </ul>
      <p>Application URL: <a href="${opts.appUrl}" style="color:#60a5fa;">${opts.appUrl}</a></p>
      <div style="margin-top:28px;">
        <a href="${opts.dashboardUrl}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
          View in Dashboard →
        </a>
      </div>
      <p style="margin-top:28px;font-size:12px;color:#94a3b8;">
        You are receiving this because you have security alerts enabled in Pulse.<br/>
        Pulse · <a href="${opts.dashboardUrl}/settings" style="color:#60a5fa;">Manage notifications</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  const textContent = `
PULSE SECURITY ALERT — ${opts.severity.toUpperCase()}

App: ${opts.appName} (${opts.appUrl})

Findings:
${opts.findings.map((f) => `  • ${f}`).join("\n")}

View in dashboard: ${opts.dashboardUrl}
  `.trim();

  return { htmlContent, textContent };
}

export function buildWeeklyReportEmail(opts: {
  periodStart: string;
  periodEnd: string;
  appsMonitored: number;
  uptimePct: number | null;
  incidents: number;
  newFindings: number;
  recommendedActions: string[];
  dashboardUrl: string;
}) {
  const uptime =
    opts.uptimePct != null ? `${opts.uptimePct.toFixed(2)}%` : "N/A";
  const actionsList = opts.recommendedActions
    .map((a) => `<li style="margin-bottom:6px;">${a}</li>`)
    .join("");

  const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:Inter,Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:0;">
  <div style="max-width:600px;margin:40px auto;background:#1e293b;border-radius:12px;overflow:hidden;">
    <div style="background:#1d4ed8;padding:20px 32px;">
      <h1 style="margin:0;font-size:20px;color:#fff;">📊 Pulse Weekly Report</h1>
      <p style="margin:4px 0 0;color:#bfdbfe;font-size:14px;">${opts.periodStart} – ${opts.periodEnd}</p>
    </div>
    <div style="padding:32px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
        <div style="background:#0f172a;border-radius:8px;padding:16px;">
          <div style="font-size:28px;font-weight:700;color:#34d399;">${uptime}</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Overall Uptime</div>
        </div>
        <div style="background:#0f172a;border-radius:8px;padding:16px;">
          <div style="font-size:28px;font-weight:700;color:#60a5fa;">${opts.appsMonitored}</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Apps Monitored</div>
        </div>
        <div style="background:#0f172a;border-radius:8px;padding:16px;">
          <div style="font-size:28px;font-weight:700;color:${opts.incidents > 0 ? "#f87171" : "#34d399"};">${opts.incidents}</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Downtime Incidents</div>
        </div>
        <div style="background:#0f172a;border-radius:8px;padding:16px;">
          <div style="font-size:28px;font-weight:700;color:${opts.newFindings > 0 ? "#fb923c" : "#34d399"};">${opts.newFindings}</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:4px;">New Security Findings</div>
        </div>
      </div>
      ${
        opts.recommendedActions.length > 0
          ? `
      <h3 style="color:#f1f5f9;margin-bottom:12px;">💡 Recommended Actions</h3>
      <ul style="padding-left:20px;line-height:1.8;color:#cbd5e1;">
        ${actionsList}
      </ul>`
          : '<p style="color:#34d399;">✅ No critical actions needed this week. Great work!</p>'
      }
      <div style="margin-top:28px;">
        <a href="${opts.dashboardUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
          Open Dashboard →
        </a>
      </div>
      <p style="margin-top:28px;font-size:12px;color:#94a3b8;">
        Pulse · Weekly digest · <a href="${opts.dashboardUrl}/settings" style="color:#60a5fa;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  const textContent = `
PULSE WEEKLY REPORT — ${opts.periodStart} to ${opts.periodEnd}

Uptime: ${uptime}
Apps monitored: ${opts.appsMonitored}
Downtime incidents: ${opts.incidents}
New security findings: ${opts.newFindings}

Recommended Actions:
${opts.recommendedActions.map((a) => `  • ${a}`).join("\n") || "  None — great week!"}

Open dashboard: ${opts.dashboardUrl}
  `.trim();

  return { htmlContent, textContent };
}
