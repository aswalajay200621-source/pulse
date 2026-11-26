export type ProtectionStatus = "connected" | "not_connected" | "needs_attention";

export interface ProtectionLevelInfo {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  optional: boolean;
  status: ProtectionStatus;
  statusReason?: string;
  detects: string;
  safeLabel: string;
  safeBecause: string;
  youGive: string;
  cantSee: string;
  ctaLabel: string;
  ctaTab?: string;
}

export interface ProtectionInput {
  hasUrl: boolean;
  appStatus?: string | null;
  domainVerifiedAt?: string | null;
  healthCheckEnabled?: boolean;
  healthCheckPath?: string | null;
  lastHealthCheckOk?: boolean | null;
  lastHealthCheckAt?: string | null;
  hasActiveIngestKey?: boolean;
  lastErrorEventAt?: string | null;
  hasGithubRepo?: boolean;
  githubLastBuildFailed?: boolean;
  hasActiveFlowCheck?: boolean;
  flowCheckFailing?: boolean;
  now?: Date;
}

export function computeProtectionLevels(input: ProtectionInput): {
  levels: ProtectionLevelInfo[];
  connectedCount: number;
} {
  const now = input.now ?? new Date();
  const thirtyDaysAgoMs = now.getTime() - 30 * 24 * 60 * 60 * 1000;

  // Level 1: App URL (required, always on)
  const level1Status: ProtectionStatus = input.hasUrl ? "connected" : "not_connected";

  // Level 2: Domain verification
  const level2Status: ProtectionStatus = input.domainVerifiedAt
    ? "connected"
    : "not_connected";

  // Level 3: Health check route
  let level3Status: ProtectionStatus = "not_connected";
  let level3Reason: string | undefined;
  if (input.healthCheckEnabled && input.healthCheckPath) {
    if (input.lastHealthCheckOk === false) {
      level3Status = "needs_attention";
      level3Reason = "The health check route is currently failing.";
    } else {
      level3Status = "connected";
    }
  }

  // Level 4: Error reporting snippet
  let level4Status: ProtectionStatus = "not_connected";
  let level4Reason: string | undefined;
  if (input.hasActiveIngestKey) {
    if (!input.lastErrorEventAt) {
      level4Status = "needs_attention";
      level4Reason = "Key created, but no error report has arrived yet.";
    } else if (new Date(input.lastErrorEventAt).getTime() < thirtyDaysAgoMs) {
      level4Status = "needs_attention";
      level4Reason = "No error reports received in the last 30 days.";
    } else {
      level4Status = "connected";
    }
  }

  // Level 5: GitHub (read-only)
  let level5Status: ProtectionStatus = "not_connected";
  let level5Reason: string | undefined;
  if (input.hasGithubRepo) {
    if (input.githubLastBuildFailed) {
      level5Status = "needs_attention";
      level5Reason = "The latest GitHub build is failing.";
    } else {
      level5Status = "connected";
    }
  }

  // Level 6: Test account (login flow check)
  let level6Status: ProtectionStatus = "not_connected";
  let level6Reason: string | undefined;
  if (input.hasActiveFlowCheck) {
    if (input.flowCheckFailing) {
      level6Status = "needs_attention";
      level6Reason = "The login flow check is currently failing.";
    } else {
      level6Status = "connected";
    }
  }

  const levels: ProtectionLevelInfo[] = [
    {
      level: 1,
      title: "App URL",
      optional: false,
      status: level1Status,
      detects:
        "your site being down or slow, error pages on the URLs you add, an SSL certificate about to expire, a domain about to expire.",
      safeLabel: "Is it safe?",
      safeBecause:
        "Pulse only visits the same public address anyone can open in a browser.",
      youGive: "your app's public URL.",
      cantSee:
        "anything behind the page, such as your database, login or file uploads.",
      ctaLabel: "View monitoring",
      ctaTab: "overview",
    },
    {
      level: 2,
      title: "Prove you own the domain",
      optional: true,
      status: level2Status,
      detects:
        "security mistakes on your live app, such as exposed files, missing security headers, open database access, CORS and cookie mistakes.",
      safeLabel: "Is it safe?",
      safeBecause:
        "you add a small file or DNS record to show the site is yours. Pulse never receives a password or login. Without this step, Pulse does not run any active security checks.",
      youGive: "a verification file or DNS record on your own domain.",
      cantSee: "problems inside your code or logic.",
      ctaLabel: level2Status === "connected" ? "Manage verification" : "Verify domain",
      ctaTab: "deep-scan",
    },
    {
      level: 3,
      title: "Add a health check route",
      optional: true,
      status: level3Status,
      statusReason: level3Reason,
      detects:
        "a paused or unreachable database, missing settings, and other services your app depends on failing (for example Supabase or Google Apps Script), even when your homepage still loads.",
      safeLabel: "Is it safe?",
      safeBecause:
        'you write the route yourself, and it should only answer "ok" or "error". It never needs to show private details.',
      youGive: "the path of your health route, such as /api/health.",
      cantSee: "bugs in features that the health route does not test.",
      ctaLabel:
        level3Status === "not_connected" ? "Add health route" : "Manage health route",
      ctaTab: "health-check",
    },
    {
      level: 4,
      title: "Add the error reporting snippet",
      optional: true,
      status: level4Status,
      statusReason: level4Reason,
      detects:
        "real crashes and failed requests that your users hit, grouped and explained in plain language, with an alert when a new error appears.",
      safeLabel: "Is it safe?",
      safeBecause:
        "the key can only SEND error reports and cannot read anything. Emails, tokens and secrets are removed before storing, and reports are deleted after 30 days. You can revoke the key at any time.",
      youGive: "a few lines of code in your app and a send-only key.",
      cantSee: "errors that your app never reports.",
      ctaLabel:
        level4Status === "not_connected" ? "Set up error snippet" : "Manage error keys",
      ctaTab: "errors",
    },
    {
      level: 5,
      title: "Connect GitHub (read-only)",
      optional: true,
      status: level5Status,
      statusReason: level5Reason,
      detects:
        "secrets accidentally left in code, packages with known security problems, failed builds and deployments, and missing automated tests.",
      safeLabel: "Is it safe?",
      safeBecause:
        "access is read-only, you choose which repositories, Pulse never changes your code, and you can disconnect at any time.",
      youGive: "read-only access to the repositories you select.",
      cantSee: "how your app behaves while running.",
      ctaLabel:
        level5Status === "not_connected" ? "Connect GitHub" : "Manage GitHub",
      ctaTab: "overview",
    },
    {
      level: 6,
      title: "Add a test account (optional, advanced)",
      optional: true,
      status: level6Status,
      statusReason: level6Reason,
      detects: "a broken login, so you hear about it before your users do.",
      safeLabel: "Safe only if:",
      safeBecause:
        "you use a throwaway test account that has no real data and no admin rights. The password is encrypted, never shown again, used only for this check, and you can delete it at any time. Never use your own account or an admin account.",
      youGive: "a login address and a test account's email and password.",
      cantSee: "anything beyond the single login step that you set up.",
      ctaLabel:
        level6Status === "not_connected" ? "Set up login check" : "Manage login check",
    },
  ];

  const connectedCount = levels.filter((l) => l.status !== "not_connected").length;
  return { levels, connectedCount };
}
