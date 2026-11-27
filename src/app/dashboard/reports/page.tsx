"use client";

import * as React from "react";
import {
  getWeeklyReports,
  generateWeeklyReport,
  type WeeklyReportRecord,
} from "@/app/actions/reports";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Printer, CheckCircle2 } from "lucide-react";

export default function WeeklyReportsPage() {
  const [reports, setReports] = React.useState<WeeklyReportRecord[]>([]);
  const [selected, setSelected] = React.useState<WeeklyReportRecord | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadReports = React.useCallback(async () => {
    setLoading(true);
    const res = await getWeeklyReports();
    if (res.error) setError(res.error);
    else if (res.reports) {
      setReports(res.reports);
      setSelected((prev) => (prev ? prev : res.reports![0] ?? null));
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setMessage(null);
    const res = await generateWeeklyReport();
    if (res.error) {
      setError(res.error);
    } else if (res.report) {
      setSelected(res.report);
      setMessage(
        res.duplicate
          ? `Report for ${res.report.period_key} already exists (duplicate prevented).`
          : `Generated weekly report for ${res.report.period_key}.`
      );
      await loadReports();
    }
    setGenerating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Weekly Health & Security Reports
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Automated weekly summaries built from real monitoring, security, and expiry records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selected && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="h-8 gap-1.5 text-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Report
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={generating}
            className="h-8 gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            {generating ? "Generating..." : "Generate This Week's Report"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500 print:hidden">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-500 print:hidden">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report History */}
        <Card className="print:hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Report History</CardTitle>
            <CardDescription className="text-xs">Select a period to inspect</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="text-xs text-muted-foreground">Loading reports...</div>
            ) : reports.length === 0 ? (
              <div className="text-xs text-muted-foreground">No reports generated yet.</div>
            ) : (
              reports.map((rep) => (
                <button
                  key={rep.id}
                  onClick={() => setSelected(rep)}
                  className={`w-full text-left rounded-md border p-3 text-xs transition-colors ${
                    selected?.id === rep.id
                      ? "border-primary bg-primary/5"
                      : "border-border/60 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between font-medium text-foreground">
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      {rep.period_key}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {new Date(rep.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {rep.apps_monitored} apps · {rep.new_findings} new findings
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Selected Report Details (Print-Friendly) */}
        <Card className="lg:col-span-2 print:border-none print:shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              {selected ? `Pulse Weekly Report — ${selected.period_key}` : "Report Details"}
            </CardTitle>
            {selected && (
              <CardDescription className="text-xs">
                Period: {new Date(selected.period_start).toLocaleDateString()} –{" "}
                {new Date(selected.period_end).toLocaleDateString()}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!selected ? (
              <div className="text-xs text-muted-foreground">
                Generate or select a weekly report to view its details.
              </div>
            ) : (
              <div className="space-y-5 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-md border border-border/60 p-3">
                    <div className="text-muted-foreground">Apps Monitored</div>
                    <div className="text-lg font-bold mt-1">{selected.apps_monitored}</div>
                  </div>
                  <div className="rounded-md border border-border/60 p-3">
                    <div className="text-muted-foreground">Uptime</div>
                    <div className="text-lg font-bold mt-1">
                      {selected.uptime_percentage !== null ? `${selected.uptime_percentage}%` : "No data"}
                    </div>
                  </div>
                  <div className="rounded-md border border-border/60 p-3">
                    <div className="text-muted-foreground">Avg Latency</div>
                    <div className="text-lg font-bold mt-1">
                      {selected.avg_response_time !== null ? `${selected.avg_response_time} ms` : "—"}
                    </div>
                  </div>
                  <div className="rounded-md border border-border/60 p-3">
                    <div className="text-muted-foreground">Incidents / Recoveries</div>
                    <div className="text-lg font-bold mt-1">
                      {selected.downtime_incidents} / {selected.recovery_events}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-md border border-border/60 p-3">
                    <div className="text-muted-foreground">New Security Findings</div>
                    <div className="text-base font-bold mt-1">{selected.new_findings}</div>
                  </div>
                  <div className="rounded-md border border-border/60 p-3">
                    <div className="text-muted-foreground">Resolved Findings</div>
                    <div className="text-base font-bold mt-1 text-emerald-500">
                      {selected.resolved_findings}
                    </div>
                  </div>
                  <div className="rounded-md border border-border/60 p-3">
                    <div className="text-muted-foreground">Upcoming Expiries</div>
                    <div className="text-base font-bold mt-1 text-amber-500">
                      {selected.upcoming_expiries}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-foreground mb-2">Recommended Actions</div>
                  <ul className="space-y-1.5">
                    {(selected.recommended_actions || []).map((action, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
