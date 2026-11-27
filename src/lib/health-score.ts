/**
 * Deterministic Application Health Score (0–100)
 *
 * Starts at 100 and subtracts points for active issues.
 * Skips any deduction whose data does not exist for the application
 * so users are never penalized for features they haven't set up.
 */

export const HEALTH_SCORE_CONFIG = {
  baseScore: 100,
  bands: {
    greenMin: 80,
    yellowMin: 50,
  },
  weights: {
    appDownNow: 40,
    uptimeBelow95: 20,
    uptimeBelow99: 10,
    sslExpired: 25,
    sslExpiring14d: 10,
    domainExpired: 20,
    domainExpiring30d: 5,
    criticalFindingEach: 15,
    criticalFindingCap: 30,
    highFindingEach: 8,
    highFindingCap: 20,
    mediumFindingEach: 3,
    mediumFindingCap: 10,
    errorGroupEach: 5,
    errorGroupCap: 15,
    buildFailing: 10,
    noAutomatedTests: 5,
    healthCheckFailing: 15,
  },
} as const;

export type HealthBand = "green" | "yellow" | "red";

export interface HealthScoreInput {
  applicationId: string;
  isDownNow?: boolean | null;
  uptime7d?: number | null;
  sslDaysRemaining?: number | null;
  domainDaysRemaining?: number | null;
  openCriticalFindings?: number | null;
  openHighFindings?: number | null;
  openMediumFindings?: number | null;
  openNewOrGrowingErrors?: number | null;
  latestBuildFailing?: boolean | null;
  testsPresent?: boolean | null;
  healthCheckFailing?: boolean | null;
}

export interface HealthFixItem {
  id: string;
  title: string;
  pointsRecovered: number;
  href: string;
}

export interface HealthScoreResult {
  score: number;
  band: HealthBand;
  topFixes: HealthFixItem[];
}

export function getHealthBand(score: number): HealthBand {
  if (score >= HEALTH_SCORE_CONFIG.bands.greenMin) return "green";
  if (score >= HEALTH_SCORE_CONFIG.bands.yellowMin) return "yellow";
  return "red";
}

export function computeHealthScore(input: HealthScoreInput): HealthScoreResult {
  const w = HEALTH_SCORE_CONFIG.weights;
  const appId = input.applicationId;
  const deductions: HealthFixItem[] = [];

  if (input.isDownNow === true) {
    deductions.push({
      id: "uptime-confirmed-downtime",
      title: "Confirmed Application Downtime",
      pointsRecovered: w.appDownNow,
      href: `/dashboard/applications/${appId}`,
    });
  }

  if (typeof input.uptime7d === "number") {
    if (input.uptime7d < 95) {
      deductions.push({
        id: "uptime-below-95",
        title: "7-Day Uptime Below 95%",
        pointsRecovered: w.uptimeBelow95,
        href: `/dashboard/applications/${appId}`,
      });
    } else if (input.uptime7d < 99) {
      deductions.push({
        id: "uptime-below-99",
        title: "7-Day Uptime Below 99%",
        pointsRecovered: w.uptimeBelow99,
        href: `/dashboard/applications/${appId}`,
      });
    }
  }

  if (typeof input.sslDaysRemaining === "number") {
    if (input.sslDaysRemaining <= 0) {
      deductions.push({
        id: "ssl-expired",
        title: "SSL/TLS Certificate Expired",
        pointsRecovered: w.sslExpired,
        href: `/dashboard/expiry`,
      });
    } else if (input.sslDaysRemaining <= 14) {
      deductions.push({
        id: "ssl-expiring-soon",
        title: "SSL/TLS Certificate Expiring Within 14 Days",
        pointsRecovered: w.sslExpiring14d,
        href: `/dashboard/expiry`,
      });
    }
  }

  if (typeof input.domainDaysRemaining === "number") {
    if (input.domainDaysRemaining <= 0) {
      deductions.push({
        id: "domain-expired",
        title: "Domain Registration Expired",
        pointsRecovered: w.domainExpired,
        href: `/dashboard/expiry`,
      });
    } else if (input.domainDaysRemaining <= 30) {
      deductions.push({
        id: "domain-expiring-soon",
        title: "Domain Registration Expiring Within 30 Days",
        pointsRecovered: w.domainExpiring30d,
        href: `/dashboard/expiry`,
      });
    }
  }

  if (typeof input.openCriticalFindings === "number" && input.openCriticalFindings > 0) {
    const pts = Math.min(input.openCriticalFindings * w.criticalFindingEach, w.criticalFindingCap);
    deductions.push({
      id: "critical-security-findings",
      title: `${input.openCriticalFindings} Critical Security Finding${input.openCriticalFindings > 1 ? "s" : ""}`,
      pointsRecovered: pts,
      href: `/dashboard/security`,
    });
  }

  if (typeof input.openHighFindings === "number" && input.openHighFindings > 0) {
    const pts = Math.min(input.openHighFindings * w.highFindingEach, w.highFindingCap);
    deductions.push({
      id: "high-security-findings",
      title: `${input.openHighFindings} High-Severity Security Finding${input.openHighFindings > 1 ? "s" : ""}`,
      pointsRecovered: pts,
      href: `/dashboard/security`,
    });
  }

  if (typeof input.openMediumFindings === "number" && input.openMediumFindings > 0) {
    const pts = Math.min(input.openMediumFindings * w.mediumFindingEach, w.mediumFindingCap);
    deductions.push({
      id: "medium-security-findings",
      title: `${input.openMediumFindings} Medium-Severity Security Finding${input.openMediumFindings > 1 ? "s" : ""}`,
      pointsRecovered: pts,
      href: `/dashboard/security`,
    });
  }

  if (typeof input.openNewOrGrowingErrors === "number" && input.openNewOrGrowingErrors > 0) {
    const pts = Math.min(input.openNewOrGrowingErrors * w.errorGroupEach, w.errorGroupCap);
    deductions.push({
      id: "open-error-groups",
      title: `${input.openNewOrGrowingErrors} Open Error Group${input.openNewOrGrowingErrors > 1 ? "s" : ""}`,
      pointsRecovered: pts,
      href: `/dashboard/applications/${appId}`,
    });
  }

  if (input.latestBuildFailing === true) {
    deductions.push({
      id: "github-build-failing",
      title: "Latest GitHub Build Failing",
      pointsRecovered: w.buildFailing,
      href: `/dashboard/applications/${appId}`,
    });
  }

  if (input.testsPresent === false) {
    deductions.push({
      id: "no-automated-tests",
      title: "No Automated Tests Found",
      pointsRecovered: w.noAutomatedTests,
      href: `/dashboard/applications/${appId}`,
    });
  }

  if (input.healthCheckFailing === true) {
    deductions.push({
      id: "health-check-failing",
      title: "Health Check Endpoint Failing",
      pointsRecovered: w.healthCheckFailing,
      href: `/dashboard/applications/${appId}`,
    });
  }

  const totalDeduction = deductions.reduce((sum, d) => sum + d.pointsRecovered, 0);
  let score = Math.max(0, Math.min(100, HEALTH_SCORE_CONFIG.baseScore - totalDeduction));

  // Never show 100/100 unless both website check AND backend/database health check have run and passed
  const bothCoreChecksPassed = input.isDownNow === false && input.healthCheckFailing === false;
  if (!bothCoreChecksPassed && score === 100) {
    score = 99;
  }

  const topFixes = [...deductions]
    .sort((a, b) => b.pointsRecovered - a.pointsRecovered)
    .slice(0, 3);

  return {
    score,
    band: getHealthBand(score),
    topFixes,
  };
}
