import type { MonitoringCheckRecord } from "@/lib/supabase/types";

export type MonitoringWindow = "24h" | "7d" | "30d";

export interface MonitoringStats {
  window: MonitoringWindow;
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  /**
   * Percentage (0-100) of successful checks.
   * Null when no monitoring checks exist in the window (unavailable data != downtime).
   */
  uptimePercentage: number | null;
  avgResponseTime: number | null;
  minResponseTime: number | null;
  maxResponseTime: number | null;
  slowWarningsCount: number;
  latestCheck: MonitoringCheckRecord | null;
}

const WINDOW_MS: Record<MonitoringWindow, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

/**
 * Calculates real uptime and response-time statistics from stored monitoring checks.
 * Never fabricates data or counts missing checks as successful.
 */
export function calculateMonitoringStats(
  checks: MonitoringCheckRecord[],
  window: MonitoringWindow,
  nowMs: number = Date.now()
): MonitoringStats {
  const cutoff = nowMs - WINDOW_MS[window];
  const filtered = checks
    .filter((c) => new Date(c.checked_at).getTime() >= cutoff)
    .sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime());

  const totalChecks = filtered.length;
  if (totalChecks === 0) {
    return {
      window,
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      uptimePercentage: null,
      avgResponseTime: null,
      minResponseTime: null,
      maxResponseTime: null,
      slowWarningsCount: 0,
      latestCheck: null,
    };
  }

  let successfulChecks = 0;
  let failedChecks = 0;
  let slowWarningsCount = 0;
  const latencies: number[] = [];

  for (const check of filtered) {
    if (check.status === "online" || check.status === "degraded") {
      successfulChecks++;
    } else if (check.status === "down") {
      failedChecks++;
    }

    if (check.is_slow) {
      slowWarningsCount++;
    }

    if (typeof check.response_time === "number" && check.response_time >= 0) {
      latencies.push(check.response_time);
    }
  }

  const uptimePercentage = Number(((successfulChecks / totalChecks) * 100).toFixed(2));

  let avgResponseTime: number | null = null;
  let minResponseTime: number | null = null;
  let maxResponseTime: number | null = null;

  if (latencies.length > 0) {
    const sum = latencies.reduce((acc, v) => acc + v, 0);
    avgResponseTime = Math.round(sum / latencies.length);
    minResponseTime = Math.min(...latencies);
    maxResponseTime = Math.max(...latencies);
  }

  return {
    window,
    totalChecks,
    successfulChecks,
    failedChecks,
    uptimePercentage,
    avgResponseTime,
    minResponseTime,
    maxResponseTime,
    slowWarningsCount,
    latestCheck: filtered[0] ?? null,
  };
}

/**
 * Calculates how much of the monthly downtime budget has been used.
 * Example: 99.9% goal allows 0.1% downtime (~43.2 minutes per 30 days).
 */
export function calculateUptimeGoalStatus(
  actualUptimePct: number | null,
  goalPct: number = 99.9
): {
  budgetUsedPct: number | null;
  summary: string;
} {
  if (actualUptimePct === null) {
    return { budgetUsedPct: null, summary: "Waiting for enough checks to measure your goal." };
  }
  const allowedDowntimePct = Math.max(0.001, 100 - goalPct);
  const actualDowntimePct = Math.max(0, 100 - actualUptimePct);
  const budgetUsedPct = Math.min(100, Math.round((actualDowntimePct / allowedDowntimePct) * 100));

  return {
    budgetUsedPct,
    summary: `You have used ${budgetUsedPct}% of your allowed downtime for your ${goalPct}% goal.`,
  };
}

/**
 * Computes the slowest 5% response time from real measured checks.
 */
export function calculateSlowest5Percent(responseTimesMs: number[]): number | null {
  if (!responseTimesMs.length) return null;
  const sorted = [...responseTimesMs].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return sorted[idx];
}
