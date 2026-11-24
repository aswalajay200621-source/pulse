"use client";

import * as React from "react";
import {
  mockSecurityFindings,
  mockSecurityScans,
  SecurityFinding,
} from "@/data/mock-data";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
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
  ExternalLink,
  CheckCircle2,
} from "lucide-react";

export default function SecurityScansPage() {
  const [findings, setFindings] = React.useState<SecurityFinding[]>(mockSecurityFindings);
  const [severityFilter, setSeverityFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [scanning, setScanning] = React.useState(false);

  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const highCount = findings.filter((f) => f.severity === "high").length;
  const mediumCount = findings.filter((f) => f.severity === "medium").length;
  const lowCount = findings.filter((f) => f.severity === "low").length;

  const triggerScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
    }, 1200);
  };

  const handleResolve = (id: string) => {
    setFindings((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, status: f.status === "resolved" ? "open" : "resolved" } : f
      )
    );
  };

  const filteredFindings = findings.filter((f) => {
    const matchesSeverity =
      severityFilter === "all" || f.severity === severityFilter;
    const matchesSearch =
      f.title.toLowerCase().includes(search.toLowerCase()) ||
      f.appName.toLowerCase().includes(search.toLowerCase()) ||
      f.category.toLowerCase().includes(search.toLowerCase());
    return matchesSeverity && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Security Scans & Vulnerability Audit
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Automated audits for HTTP security headers, TLS configuration, CORS, and exposed headers.
          </p>
        </div>

        <Button
          size="sm"
          onClick={triggerScan}
          disabled={scanning}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? "Scanning Endpoints..." : "Run Global Security Audit"}
        </Button>
      </div>

      {/* Severity Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Critical Severity"
          value={criticalCount}
          change={criticalCount > 0 ? "Immediate Action Required" : "None"}
          changeType={criticalCount > 0 ? "negative" : "positive"}
          subtitle="TLS expiry & open credentials CORS"
          icon={<ShieldAlert className="h-4 w-4 text-rose-500" />}
        />
        <StatCard
          title="High Severity"
          value={highCount}
          change="CSP & HSTS policies"
          changeType="negative"
          subtitle="Vulnerability to downgrade & XSS"
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
        />
        <StatCard
          title="Medium Severity"
          value={mediumCount}
          change="Header leakages"
          changeType="neutral"
          subtitle="MIME-sniffing & server banners"
          icon={<Info className="h-4 w-4 text-blue-500" />}
        />
        <StatCard
          title="Low Severity"
          value={lowCount}
          change="Best practice hints"
          changeType="neutral"
          subtitle="Referrer & cache directives"
          icon={<ShieldCheck className="h-4 w-4 text-emerald-500" />}
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search security findings by title, app, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs sm:text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Findings List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Active Security Findings ({filteredFindings.length})
          </CardTitle>
          <CardDescription className="text-xs">
            Detected risks accompanied by clear, plain-language remediation instructions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredFindings.map((finding) => (
            <div
              key={finding.id}
              className={`rounded-lg border p-4 transition-all ${
                finding.status === "resolved"
                  ? "border-border/40 bg-muted/20 opacity-60"
                  : "border-border/70 bg-card hover:border-border"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={finding.severity} />
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {finding.title}
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground uppercase">
                    {finding.category}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {finding.discoveredAt}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleResolve(finding.id)}
                    className="h-7 text-xs px-2"
                  >
                    {finding.status === "resolved" ? "Reopen" : "Mark Resolved"}
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                {finding.description}
              </p>

              <div className="mt-3 rounded-md border border-border/50 bg-muted/30 p-2.5 text-xs">
                <span className="font-semibold text-foreground">Plain-language Fix: </span>
                <span className="text-muted-foreground">{finding.recommendation}</span>
              </div>

              <div className="mt-2 text-[11px] text-muted-foreground font-mono">
                Target: <span className="font-semibold text-foreground">{finding.appName}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Scan History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Automated Audit History
          </CardTitle>
          <CardDescription className="text-xs">
            Historical logs of synthetic security scans executed across targets
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-y border-border/70 bg-muted/40 font-mono text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Scan ID</th>
                  <th className="py-2.5 px-4 font-medium">Application</th>
                  <th className="py-2.5 px-4 font-medium">Date & Time</th>
                  <th className="py-2.5 px-4 font-medium">Duration</th>
                  <th className="py-2.5 px-4 font-medium">Score</th>
                  <th className="py-2.5 px-4 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono">
                {mockSecurityScans.map((scan) => (
                  <tr key={scan.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-muted-foreground">{scan.id}</td>
                    <td className="py-3 px-4 font-sans font-medium text-foreground">
                      {scan.appName}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{scan.scannedAt}</td>
                    <td className="py-3 px-4 text-muted-foreground">{scan.durationMs} ms</td>
                    <td className="py-3 px-4 font-bold text-foreground">
                      <span className={scan.score >= 90 ? "text-emerald-500" : "text-amber-500"}>
                        {scan.score}/100
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-500 font-sans">
                        Completed
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
