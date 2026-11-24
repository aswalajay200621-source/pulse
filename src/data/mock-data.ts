export interface Application {
  id: string;
  name: string;
  url: string;
  environment: "Production" | "Staging" | "Preview";
  status: "online" | "degraded" | "down" | "maintenance";
  uptimePercent: number;
  avgLatencyMs: number;
  lastChecked: string;
  securityIssuesCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  sslCertificate: {
    issuer: string;
    validUntil: string;
    daysRemaining: number;
    status: "valid" | "expiring_soon" | "expired";
  };
  domainExpiry: {
    registrar: string;
    validUntil: string;
    daysRemaining: number;
  };
  healthScore: number; // 0 - 100
  location: string;
}

export interface SecurityFinding {
  id: string;
  appId: string;
  appName: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  category: "SSL/TLS" | "Headers" | "Vulnerabilities" | "Configuration" | "DNS";
  description: string;
  recommendation: string;
  discoveredAt: string;
  status: "open" | "resolved" | "ignored";
}

export interface SecurityScan {
  id: string;
  appId: string;
  appName: string;
  scannedAt: string;
  durationMs: number;
  status: "completed" | "in_progress" | "failed";
  findingsSummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  score: number;
}

export interface IncidentAlert {
  id: string;
  appId: string;
  appName: string;
  type: "downtime" | "latency" | "security" | "ssl_expiry";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  resolved: boolean;
}

export interface ActivityItem {
  id: string;
  type: "status_change" | "security_scan" | "alert_triggered" | "config_updated";
  title: string;
  description: string;
  timestamp: string;
  appId?: string;
  appName?: string;
}

export const mockApplications: Application[] = [
  {
    id: "app-1",
    name: "Payment Checkout Gateway",
    url: "https://pay.acmepay.io",
    environment: "Production",
    status: "online",
    uptimePercent: 99.98,
    avgLatencyMs: 84,
    lastChecked: "Just now",
    securityIssuesCount: { critical: 0, high: 0, medium: 1, low: 2 },
    sslCertificate: {
      issuer: "Let's Encrypt Authority X3",
      validUntil: "2027-04-12",
      daysRemaining: 72,
      status: "valid",
    },
    domainExpiry: {
      registrar: "Cloudflare Registrar",
      validUntil: "2028-09-15",
      daysRemaining: 412,
    },
    healthScore: 98,
    location: "US-East (N. Virginia)",
  },
  {
    id: "app-2",
    name: "Customer Web Portal",
    url: "https://portal.acmepay.io",
    environment: "Production",
    status: "online",
    uptimePercent: 99.92,
    avgLatencyMs: 142,
    lastChecked: "1 min ago",
    securityIssuesCount: { critical: 0, high: 1, medium: 2, low: 0 },
    sslCertificate: {
      issuer: "DigiCert Global Root G2",
      validUntil: "2027-01-20",
      daysRemaining: 18,
      status: "expiring_soon",
    },
    domainExpiry: {
      registrar: "Cloudflare Registrar",
      validUntil: "2028-09-15",
      daysRemaining: 412,
    },
    healthScore: 92,
    location: "EU-West (Frankfurt)",
  },
  {
    id: "app-3",
    name: "Auth & Identity Service",
    url: "https://auth.acmepay.io/oauth",
    environment: "Production",
    status: "degraded",
    uptimePercent: 98.45,
    avgLatencyMs: 380,
    lastChecked: "2 mins ago",
    securityIssuesCount: { critical: 1, high: 2, medium: 1, low: 1 },
    sslCertificate: {
      issuer: "Let's Encrypt Authority X3",
      validUntil: "2027-05-30",
      daysRemaining: 120,
      status: "valid",
    },
    domainExpiry: {
      registrar: "Cloudflare Registrar",
      validUntil: "2028-09-15",
      daysRemaining: 412,
    },
    healthScore: 78,
    location: "US-West (Oregon)",
  },
  {
    id: "app-4",
    name: "Webhook Delivery Engine",
    url: "https://hooks.acmepay.io",
    environment: "Production",
    status: "online",
    uptimePercent: 100.0,
    avgLatencyMs: 48,
    lastChecked: "30 secs ago",
    securityIssuesCount: { critical: 0, high: 0, medium: 0, low: 1 },
    sslCertificate: {
      issuer: "Cloudflare Inc ECC CA-3",
      validUntil: "2027-08-11",
      daysRemaining: 210,
      status: "valid",
    },
    domainExpiry: {
      registrar: "Cloudflare Registrar",
      validUntil: "2028-09-15",
      daysRemaining: 412,
    },
    healthScore: 99,
    location: "AP-East (Tokyo)",
  },
  {
    id: "app-5",
    name: "Analytics Reporting API",
    url: "https://analytics-staging.acmepay.io",
    environment: "Staging",
    status: "down",
    uptimePercent: 94.12,
    avgLatencyMs: 0,
    lastChecked: "3 mins ago",
    securityIssuesCount: { critical: 1, high: 0, medium: 3, low: 2 },
    sslCertificate: {
      issuer: "ZeroSSL RSA Domain Secure Site CA",
      validUntil: "2026-11-20",
      daysRemaining: 0,
      status: "expired",
    },
    domainExpiry: {
      registrar: "Cloudflare Registrar",
      validUntil: "2028-09-15",
      daysRemaining: 412,
    },
    healthScore: 54,
    location: "US-East (Ohio)",
  },
];

export const mockSecurityFindings: SecurityFinding[] = [
  {
    id: "sec-101",
    appId: "app-3",
    appName: "Auth & Identity Service",
    title: "CORS Wildcard Allowed with Credentials",
    severity: "critical",
    category: "Configuration",
    description: "The API endpoint returns 'Access-Control-Allow-Origin: *' alongside credentials headers, allowing unauthorized origin requests.",
    recommendation: "Restrict the Access-Control-Allow-Origin header to explicit trusted customer hostnames.",
    discoveredAt: "2 hours ago",
    status: "open",
  },
  {
    id: "sec-102",
    appId: "app-5",
    appName: "Analytics Reporting API",
    title: "SSL/TLS Certificate Expired",
    severity: "critical",
    category: "SSL/TLS",
    description: "The SSL certificate expired 4 days ago. Modern browsers and HTTP clients reject secure handshakes.",
    recommendation: "Renew the TLS certificate immediately using ACME automated issuance or certificate manager.",
    discoveredAt: "Yesterday",
    status: "open",
  },
  {
    id: "sec-103",
    appId: "app-2",
    appName: "Customer Web Portal",
    title: "Content Security Policy (CSP) Not Configured",
    severity: "high",
    category: "Headers",
    description: "No Content-Security-Policy header was detected. This leaves the application susceptible to Cross-Site Scripting (XSS).",
    recommendation: "Add a strict Content-Security-Policy header restricting script-src, object-src, and base-uri.",
    discoveredAt: "3 days ago",
    status: "open",
  },
  {
    id: "sec-104",
    appId: "app-3",
    appName: "Auth & Identity Service",
    title: "Missing Strict-Transport-Security (HSTS) Header",
    severity: "high",
    category: "Headers",
    description: "HTTP responses lack the Strict-Transport-Security header, allowing downgrade attacks on subsequent requests.",
    recommendation: "Include 'Strict-Transport-Security: max-age=31536000; includeSubDomains; preload' in all HTTPS responses.",
    discoveredAt: "1 day ago",
    status: "open",
  },
  {
    id: "sec-105",
    appId: "app-1",
    appName: "Payment Checkout Gateway",
    title: "X-Content-Type-Options Header Absent",
    severity: "medium",
    category: "Headers",
    description: "Browsers might MIME-sniff response types away from declared content-type, creating subtle security risks.",
    recommendation: "Set 'X-Content-Type-Options: nosniff' header on all HTTP responses.",
    discoveredAt: "4 days ago",
    status: "open",
  },
  {
    id: "sec-106",
    appId: "app-2",
    appName: "Customer Web Portal",
    title: "Server Information Disclosure in HTTP Banner",
    severity: "medium",
    category: "Headers",
    description: "Server header leaks 'Server: nginx/1.18.0 (Ubuntu)', disclosing precise runtime patch levels.",
    recommendation: "Configure 'server_tokens off;' to conceal web server versions from public probes.",
    discoveredAt: "5 days ago",
    status: "open",
  },
  {
    id: "sec-107",
    appId: "app-4",
    appName: "Webhook Delivery Engine",
    title: "Referrer-Policy Defaults to Lax Value",
    severity: "low",
    category: "Configuration",
    description: "No explicit Referrer-Policy header found. URL paths may leak in outgoing external requests.",
    recommendation: "Set 'Referrer-Policy: strict-origin-when-cross-origin'.",
    discoveredAt: "1 week ago",
    status: "resolved",
  },
];

export const mockSecurityScans: SecurityScan[] = [
  {
    id: "scan-901",
    appId: "app-1",
    appName: "Payment Checkout Gateway",
    scannedAt: "Today at 09:15 AM",
    durationMs: 4200,
    status: "completed",
    findingsSummary: { critical: 0, high: 0, medium: 1, low: 2 },
    score: 96,
  },
  {
    id: "scan-902",
    appId: "app-3",
    appName: "Auth & Identity Service",
    scannedAt: "Today at 08:30 AM",
    durationMs: 5120,
    status: "completed",
    findingsSummary: { critical: 1, high: 2, medium: 1, low: 1 },
    score: 74,
  },
  {
    id: "scan-903",
    appId: "app-2",
    appName: "Customer Web Portal",
    scannedAt: "Yesterday at 11:00 PM",
    durationMs: 3890,
    status: "completed",
    findingsSummary: { critical: 0, high: 1, medium: 2, low: 0 },
    score: 88,
  },
  {
    id: "scan-904",
    appId: "app-5",
    appName: "Analytics Reporting API",
    scannedAt: "Yesterday at 04:20 PM",
    durationMs: 2900,
    status: "completed",
    findingsSummary: { critical: 1, high: 0, medium: 3, low: 2 },
    score: 62,
  },
];

export const mockAlerts: IncidentAlert[] = [
  {
    id: "alt-01",
    appId: "app-5",
    appName: "Analytics Reporting API",
    type: "downtime",
    severity: "critical",
    title: "Service Outage Detected (HTTP 502 Bad Gateway)",
    message: "Synthetic check probe failed across 3 geographic regions (US-East, EU-Central, AP-South). Target returning HTTP 502.",
    timestamp: "12 minutes ago",
    read: false,
    resolved: false,
  },
  {
    id: "alt-02",
    appId: "app-3",
    appName: "Auth & Identity Service",
    type: "latency",
    severity: "high",
    title: "Response Latency Spike (>350ms)",
    message: "p95 latency exceeded SLA threshold of 250ms for 5 consecutive check intervals.",
    timestamp: "45 minutes ago",
    read: false,
    resolved: false,
  },
  {
    id: "alt-03",
    appId: "app-2",
    appName: "Customer Web Portal",
    type: "ssl_expiry",
    severity: "medium",
    title: "SSL Certificate Expiring in 18 Days",
    message: "The certificate issued by DigiCert for portal.acmepay.io expires on 2027-01-20. Auto-renewal not confirmed.",
    timestamp: "3 hours ago",
    read: true,
    resolved: false,
  },
  {
    id: "alt-04",
    appId: "app-1",
    appName: "Payment Checkout Gateway",
    type: "security",
    severity: "low",
    title: "Security Header Anomaly Detected",
    message: "Changes in HTTP response headers detected during scheduled background vulnerability audit.",
    timestamp: "1 day ago",
    read: true,
    resolved: true,
  },
];

export const mockRecentActivity: ActivityItem[] = [
  {
    id: "act-1",
    type: "alert_triggered",
    title: "Downtime detected for Analytics Reporting API",
    description: "Region probes reported non-200 HTTP response code.",
    timestamp: "12m ago",
    appName: "Analytics Reporting API",
  },
  {
    id: "act-2",
    type: "security_scan",
    title: "Automated scan finished for Auth & Identity Service",
    description: "Identified 1 critical vulnerability requiring attention.",
    timestamp: "1h ago",
    appName: "Auth & Identity Service",
  },
  {
    id: "act-3",
    type: "status_change",
    title: "Payment Checkout Gateway restored to 100% healthy",
    description: "Latency returned to normal baseline (84ms).",
    timestamp: "4h ago",
    appName: "Payment Checkout Gateway",
  },
  {
    id: "act-4",
    type: "config_updated",
    title: "Notification threshold updated",
    description: "Default alert threshold modified to notify on 2 consecutive failed health checks.",
    timestamp: "Yesterday",
  },
];

export const mockLatencyHistory = [
  { time: "00:00", value: 82 },
  { time: "02:00", value: 85 },
  { time: "04:00", value: 80 },
  { time: "06:00", value: 88 },
  { time: "08:00", value: 110 },
  { time: "10:00", value: 145 },
  { time: "12:00", value: 92 },
  { time: "14:00", value: 89 },
  { time: "16:00", value: 104 },
  { time: "18:00", value: 86 },
  { time: "20:00", value: 84 },
  { time: "22:00", value: 83 },
];

export interface UptimeBarItem {
  day: string;
  status: "up" | "degraded" | "down";
}

export const mockUptimeBars: UptimeBarItem[] = [
  { day: "Day 1", status: "up" },
  { day: "Day 2", status: "up" },
  { day: "Day 3", status: "up" },
  { day: "Day 4", status: "up" },
  { day: "Day 5", status: "degraded" },
  { day: "Day 6", status: "up" },
  { day: "Day 7", status: "up" },
  { day: "Day 8", status: "up" },
  { day: "Day 9", status: "up" },
  { day: "Day 10", status: "up" },
  { day: "Day 11", status: "up" },
  { day: "Day 12", status: "up" },
  { day: "Day 13", status: "up" },
  { day: "Day 14", status: "up" },
  { day: "Day 15", status: "up" },
  { day: "Day 16", status: "up" },
  { day: "Day 17", status: "down" },
  { day: "Day 18", status: "up" },
  { day: "Day 19", status: "up" },
  { day: "Day 20", status: "up" },
  { day: "Day 21", status: "up" },
  { day: "Day 22", status: "up" },
  { day: "Day 23", status: "up" },
  { day: "Day 24", status: "up" },
  { day: "Day 25", status: "up" },
  { day: "Day 26", status: "up" },
  { day: "Day 27", status: "up" },
  { day: "Day 28", status: "up" },
  { day: "Day 29", status: "up" },
  { day: "Day 30", status: "up" },
];
