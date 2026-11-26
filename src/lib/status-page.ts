/**
 * Public Status Page & Badge Helpers
 *
 * Enforces an explicit allowlist of public fields.
 * Never exposes error messages, security findings, health score details,
 * repository names, internal URLs/paths, scan results, or user data.
 */

import crypto from "node:crypto";

export type PublicOverallStatus = "operational" | "degraded" | "down";

export interface PublicDailyBar {
  date: string;
  status: PublicOverallStatus | "no_data";
}

export interface PublicIncidentItem {
  startedAt: string;
  resolvedAt: string | null;
  durationMinutes: number | null;
}

export interface PublicStatusPayload {
  displayTitle: string;
  overallStatus: PublicOverallStatus;
  uptime24h: number | null;
  uptime7d: number | null;
  uptime30d: number | null;
  dailyBars: PublicDailyBar[];
  incidents: PublicIncidentItem[];
}

export function generateStatusSlug(): string {
  return crypto.randomBytes(18).toString("base64url");
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Builds the public status payload using an explicit allowlist.
 */
export function buildPublicStatusPayload(input: {
  displayTitle: string;
  overallStatus: PublicOverallStatus;
  uptime24h: number | null;
  uptime7d: number | null;
  uptime30d: number | null;
  dailyBars: PublicDailyBar[];
  incidents: PublicIncidentItem[];
}): PublicStatusPayload {
  return {
    displayTitle: String(input.displayTitle || "Service Status").slice(0, 80),
    overallStatus:
      input.overallStatus === "down" || input.overallStatus === "degraded"
        ? input.overallStatus
        : "operational",
    uptime24h: typeof input.uptime24h === "number" ? input.uptime24h : null,
    uptime7d: typeof input.uptime7d === "number" ? input.uptime7d : null,
    uptime30d: typeof input.uptime30d === "number" ? input.uptime30d : null,
    dailyBars: (input.dailyBars || []).slice(0, 30).map((b) => ({
      date: String(b.date).slice(0, 10),
      status: b.status,
    })),
    incidents: (input.incidents || []).slice(0, 10).map((inc) => ({
      startedAt: String(inc.startedAt),
      resolvedAt: inc.resolvedAt ? String(inc.resolvedAt) : null,
      durationMinutes: typeof inc.durationMinutes === "number" ? inc.durationMinutes : null,
    })),
  };
}

/**
 * Generates a compact, escaped SVG status badge.
 */
export function buildStatusBadgeSvg(
  status: PublicOverallStatus,
  uptime30d: number | null
): string {
  const statusLabel =
    status === "operational" ? "operational" : status === "degraded" ? "degraded" : "down";
  const color =
    status === "operational" ? "#10b981" : status === "degraded" ? "#f59e0b" : "#ef4444";
  const uptimeText = uptime30d !== null ? `${uptime30d}%` : "n/a";
  const rightText = escapeXml(`${statusLabel} · ${uptimeText}`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="210" height="20" role="img" aria-label="Pulse: ${rightText}">
  <rect width="58" height="20" rx="3" fill="#18181b"/>
  <rect x="55" width="155" height="20" rx="3" fill="${color}"/>
  <rect x="55" width="4" height="20" fill="${color}"/>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="29" y="14">pulse</text>
    <text x="132" y="14">${rightText}</text>
  </g>
</svg>`;
}

// Simple per-IP sliding window rate limiter for public endpoints
const ipHits = new Map<string, { count: number; resetAt: number }>();

export function checkPublicRateLimit(
  ip: string,
  maxRequests = 60,
  windowMs = 60_000
): boolean {
  const now = Date.now();
  const key = ip || "unknown";
  const entry = ipHits.get(key);
  if (!entry || now > entry.resetAt) {
    ipHits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count += 1;
  return true;
}
