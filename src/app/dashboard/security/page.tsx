"use client";

import * as React from "react";
import {
  getSecurityDashboardData,
  triggerManualScan,
  updateFindingStatus,
} from "@/app/actions/security";
import { explainFinding } from "@/lib/explanations/engine";
import { FindingExplanationCard } from "@/components/shared/finding-explanation-card";
import type {
  SecurityScanRecord,
  SecurityFindingRecord,
} from "@/app/actions/security";
import type { ApplicationRecord } from "@/lib/supabase/types";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Info,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  EyeOff,
} from "lucide-react";

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-rose-500",
  high: "text-amber-500",
  medium: "text-blue-500",
  low: "text-muted-foreground",
};

const SEVERITY_BG: Record<string, string> = {
  critical: "bg-rose-500/10 text-rose-500",
  high: "bg-amber-500/10 text-amber-500",
  medium: "bg-blue-500/10 text-blue-500",
  low: "bg-muted text-muted-foreground",
};

const SOURCE_LABEL: Record<string, string> = {
  secret_scan: "Secret",
  dependency_scan: "Dependency",
  header_check: "Header",
};

export default function SecurityScansPage() {
  const [applications, setApplications] = React.useState<ApplicationRecord[]>([]);
  const [scans, setScans] = React.useState<SecurityScanRecord[]>([]);
  const [findings, setFindings] = React.useState<SecurityFindingRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [scanning, setScanning] = React.useState<string | null>(null); // appId being scanned
  const [severityFilter, setSeverityFilter] = React.useState("all");
  const [sourceFilter, setSourceFilter] = React.useState("all");
  const [appFilter, setAppFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getSecurityDashboardData();
    if (res.error) {
      setError(res.error);
    } else {
      setApplications(res.applications ?? []);
      setScans(res.scans ?? []);
      setFindings(res.findings ?? []);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => { loadData(); }, [loadData]);

  const handleScan = async (appId: string) => {
    setScanning(appId);
    setError(null);
    const res = await triggerManualScan(appId);
    if (res.error) setError(res.error);
    await loadData();
    setScanning(null);
  };

  const handleUpdateStatus = async (id: string, status: "resolved" | "ignored") => {
    const res = await updateFindingStatus(id, status);
    if (res.error) setError(res.error);
    else await loadData();
  };

  const openFindings = findings.filter((f) => f.status === "open");
  const criticalCount = openFindings.filter((f) => f.severity === "critical").length;
  const highCount = openFindings.filter((f) => f.severity === "high").length;
  const mediumCount = openFindings.filter((f) => f.severity === "medium").length;
  const lowCount = openFindings.filter((f) => f.severity === "low").length;

  const filteredFindings = React.useMemo(() => {
    return findings.filter((f) => {
      if (f.status === "ignored") return false;
      if (appFilter !== "all" && f.application_id !== appFilter) return false;
      if (severityFilter !== "all" && f.severity !== severityFilter) return false;
      if (sourceFilter !== "all" && f.source !== sourceFilter) return false;
      const q = search.toLowerCase();
      if (q && !f.title.toLowerCase().includes(q) && !f.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [findings, appFilter, severityFilter, sourceFilter, search]);

  const latestScan = scans[0] ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Security Scans & Vulnerability Audit
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Secret detection, dependency vulnerabilities (OSV), and HTTP security header analysis.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {applications.map((app) => (
            <Button
              key={app.id}
              size="sm"
              variant="outline"
              onClick={() => handleScan(app.id)}
              disabled={scanning === app.id}
              className="h-8 gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${scanning === app.id ? "animate-spin" : ""}`} />
              {scanning === app.id ? "Scanning..." : `Scan ${app.name}`}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
          {error}
        </div>
      )}

      {/* Latest Scan Info */}
      {latestScan && (
        <div className="rounded-md border border-border/70 bg-card px-4 py-3 text-xs flex flex-wrap items-center gap-4">
          <span className="text-muted-foreground">Last scan:</span>
          <span className="font-mono font-medium">{new Date(latestScan.scanned_at).toLocaleString()}</span>
          <span className={`inline-flex items-center gap-1 font-mono ${
            latestScan.scan_status === "completed" ? "text-emerald-500" :
            latestScan.scan_status === "failed" ? "text-red-500" : "text-amber-500"
          }`}>
            {latestScan.scan_status === "completed" && <CheckCircle2 className="h-3.5 w-3.5" />}
            {latestScan.scan_status === "failed" && <XCircle className="h-3.5 w-3.5" />}
            {latestScan.scan_status.toUpperCase()}
          </span>
          {latestScan.duration_ms && (
            <span className="text-muted-foreground">{(latestScan.duration_ms / 1000).toFixed(1)}s</span>
          )}
          {latestScan.error_message && (
            <span className="text-red-500">{latestScan.error_message}</span>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Critical" value={String(criticalCount)}
          change={criticalCount > 0 ? "Immediate Action" : "None"}
          changeType={criticalCount > 0 ? "negative" : "positive"}
          subtitle="Secrets & high-risk vulns"
          icon={<ShieldAlert className="h-4 w-4 text-rose-500" />} />
        <StatCard title="High" value={String(highCount)}
          change={highCount > 0 ? "Review Required" : "None"}
          changeType={highCount > 0 ? "negative" : "positive"}
          subtitle="CSP, HSTS & dependencies"
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} />
        <StatCard title="Medium" value={String(mediumCount)}
          subtitle="Header hardening & moderate vulns"
          icon={<Info className="h-4 w-4 text-blue-500" />} />
        <StatCard title="Low" value={String(lowCount)}
          subtitle="Best-practice improvements"
          icon={<ShieldCheck className="h-4 w-4 text-emerald-500" />} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search findings..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-9 text-xs" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={appFilter} onChange={(e) => setAppFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-2.5 text-xs">
            <option value="all">All Applications</option>
            {applications.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-2.5 text-xs">
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-2.5 text-xs">
            <option value="all">All Sources</option>
            <option value="secret_scan">Secrets</option>
            <option value="dependency_scan">Dependencies</option>
            <option value="header_check">Headers</option>
          </select>
        </div>
      </div>

      {/* Findings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Security Findings ({filteredFindings.length})
          </CardTitle>
          <CardDescription className="text-xs">
            Real findings from secret scanning, OSV vulnerability database, and HTTP header analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-xs text-muted-foreground">Loading findings...</div>
          ) : filteredFindings.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              No open findings. Run a scan to check your applications.
            </div>
          ) : (
            filteredFindings.map((finding) => (
              <div key={finding.id}
                className={`rounded-lg border p-4 transition-all ${
                  finding.status === "resolved"
                    ? "border-border/40 bg-muted/20 opacity-60"
                    : "border-border/70 bg-card hover:border-border"
                }`}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold uppercase ${SEVERITY_BG[finding.severity]}`}>
                      {finding.severity}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground uppercase">
                      {SOURCE_LABEL[finding.source] || finding.source}
                    </span>
                    {finding.is_new && (
                      <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-mono text-blue-500 uppercase">New</span>
                    )}
                    {finding.is_recurring && (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-mono text-amber-500 uppercase">Recurring</span>
                    )}
                    <span className="font-mono text-xs font-semibold text-foreground">{finding.title}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {finding.status === "open" && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(finding.id, "resolved")}
                          className="h-7 text-xs px-2 gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Resolve
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleUpdateStatus(finding.id, "ignored")}
                          className="h-7 text-xs px-2 gap-1 text-muted-foreground">
                          <EyeOff className="h-3 w-3" /> Ignore
                        </Button>
                      </>
                    )}
                    {finding.status === "resolved" && (
                      <span className="text-xs text-emerald-500 font-mono">Resolved</span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{finding.description}</p>

                {(finding.file_path || finding.package_name) && (
                  <div className="mt-2 font-mono text-[11px] text-muted-foreground">
                    {finding.file_path && <span>File: <span className="text-foreground">{finding.file_path}{finding.line_number ? `:${finding.line_number}` : ""}</span></span>}
                    {finding.masked_secret && <span className="ml-3">Detected: <span className="text-foreground">{finding.masked_secret}</span></span>}
                    {finding.package_name && <span>Package: <span className="text-foreground">{finding.package_name}@{finding.installed_version}</span></span>}
                    {finding.fixed_version && <span className="ml-3 text-emerald-500">Fix: {finding.fixed_version}</span>}
                    {finding.vuln_id && <span className="ml-3">ID: <span className="text-foreground">{finding.vuln_id}</span></span>}
                  </div>
                )}

                <FindingExplanationCard
                  explained={explainFinding({
                    ruleId: finding.rule_id,
                    category: finding.category,
                    source: finding.source,
                    severity: finding.severity,
                    title: finding.title,
                    description: finding.description,
                    remediation: finding.remediation,
                    affectedResource: finding.affected_resource,
                    filePath: finding.file_path,
                    packageName: finding.package_name,
                    fixedVersion: finding.fixed_version,
                    timestamp: finding.first_seen_at || finding.created_at,
                  })}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Scan History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Scan History</CardTitle>
          <CardDescription className="text-xs">Historical security scans with finding counts.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {scans.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">No scans run yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-y border-border/70 bg-muted/40 font-mono text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Application</th>
                    <th className="py-2.5 px-4 font-medium">Date</th>
                    <th className="py-2.5 px-4 font-medium">Type</th>
                    <th className="py-2.5 px-4 font-medium">Findings</th>
                    <th className="py-2.5 px-4 font-medium">Duration</th>
                    <th className="py-2.5 px-4 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-mono">
                  {scans.map((scan) => {
                    const app = applications.find((a) => a.id === scan.application_id);
                    return (
                      <tr key={scan.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-sans font-medium text-foreground">{app?.name ?? scan.application_id.slice(0, 8)}</td>
                        <td className="py-3 px-4 text-muted-foreground">{new Date(scan.scanned_at).toLocaleString()}</td>
                        <td className="py-3 px-4 capitalize text-muted-foreground">{scan.scan_type}</td>
                        <td className="py-3 px-4">
                          <span className={SEVERITY_COLOR["critical"]}>{scan.critical_count}C</span>{" "}
                          <span className={SEVERITY_COLOR["high"]}>{scan.high_count}H</span>{" "}
                          <span className={SEVERITY_COLOR["medium"]}>{scan.medium_count}M</span>{" "}
                          <span className={SEVERITY_COLOR["low"]}>{scan.low_count}L</span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {scan.duration_ms ? `${(scan.duration_ms / 1000).toFixed(1)}s` : "—"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-sans ${
                            scan.scan_status === "completed" ? "bg-emerald-500/10 text-emerald-500" :
                            scan.scan_status === "failed" ? "bg-red-500/10 text-red-500" :
                            "bg-amber-500/10 text-amber-500"
                          }`}>
                            {scan.scan_status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
