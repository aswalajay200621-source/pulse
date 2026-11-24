"use client";

import * as React from "react";
import { mockApplications, mockUptimeBars } from "@/data/mock-data";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { UptimeBarStrip } from "@/components/shared/simple-charts";
import {
  FileText,
  Download,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  Share2,
} from "lucide-react";

export default function ReportsPage() {
  const [downloading, setDownloading] = React.useState(false);

  const handleDownload = () => {
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      alert("Weekly Health PDF report generated successfully (Demo).");
    }, 800);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Weekly Application Health Digest
            </h1>
            <span className="rounded bg-primary/10 text-primary border border-primary/20 text-xs font-mono px-2 py-0.5">
              Week 47, 2026
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Automated executive summary ready for client delivery or stakeholder review.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
          <Button
            size="sm"
            onClick={handleDownload}
            disabled={downloading}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            {downloading ? "Exporting PDF..." : "Export PDF Report"}
          </Button>
        </div>
      </div>

      {/* Executive Summary Card */}
      <Card className="border-border/80 bg-card">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold">
                Executive Health Briefing
              </CardTitle>
              <CardDescription className="text-xs">
                Period: Monday, Nov 17 – Sunday, Nov 23, 2026
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Overall Organization Score: <strong className="text-emerald-500 font-bold text-sm">96.4% (A)</strong>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            During this 7-day monitoring window, Pulse recorded <strong>99.96% uptime</strong> across core services. Four of five production services operated with zero unhandled downtime. One isolated degradation event on the Staging Analytics API occurred due to an expired testing certificate and was logged with full synthetic diagnostic traces.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">
                Uptime Attainment
              </span>
              <p className="text-xl font-bold font-mono text-foreground mt-1">99.96%</p>
              <p className="text-[11px] text-emerald-500 mt-0.5">Exceeded 99.90% SLA target</p>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">
                Mean Time to Detect (MTTD)
              </span>
              <p className="text-xl font-bold font-mono text-foreground mt-1">42 secs</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Synthetic probe reaction speed</p>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">
                Mean Time to Resolve (MTTR)
              </span>
              <p className="text-xl font-bold font-mono text-foreground mt-1">8.4 mins</p>
              <p className="text-[11px] text-emerald-500 mt-0.5">Well within 30m response tier</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Target Breakdown Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Weekly Breakdown by Target
          </CardTitle>
          <CardDescription className="text-xs">
            Individual target availability, average latency, and detected anomalies
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-y border-border/70 bg-muted/40 font-mono text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Application</th>
                  <th className="py-2.5 px-4 font-medium">Weekly Uptime</th>
                  <th className="py-2.5 px-4 font-medium">Avg Latency</th>
                  <th className="py-2.5 px-4 font-medium">Incidents</th>
                  <th className="py-2.5 px-4 font-medium text-right">Health Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {mockApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-semibold text-foreground">{app.name}</span>
                      <p className="text-[11px] font-mono text-muted-foreground">{app.url}</p>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium">{app.uptimePercent}%</td>
                    <td className="py-3 px-4 font-mono">
                      {app.avgLatencyMs > 0 ? `${app.avgLatencyMs} ms` : "—"}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {app.status === "down" ? "1 incident" : "0 incidents"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      <span
                        className={
                          app.healthScore >= 90
                            ? "text-emerald-500"
                            : app.healthScore >= 75
                            ? "text-amber-500"
                            : "text-rose-500"
                        }
                      >
                        {app.healthScore >= 95
                          ? "A+"
                          : app.healthScore >= 90
                          ? "A"
                          : app.healthScore >= 75
                          ? "B"
                          : "C-"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 30-Day Fleet Timeline Visual */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Fleet Historical Reliability
          </CardTitle>
          <CardDescription className="text-xs">
            Continuity overview for the rolling 30-day reporting window
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UptimeBarStrip bars={mockUptimeBars} />
        </CardContent>
      </Card>
    </div>
  );
}
