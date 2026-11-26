"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { getApplicationHealthScore, type HealthSnapshotPoint } from "@/app/actions/health-score";
import type { HealthScoreResult } from "@/lib/health-score";
import { CheckCircle2, ArrowRight, TrendingUp } from "lucide-react";

interface Props {
  applicationId: string;
}

const BAND_STYLES = {
  green: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  yellow: "text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  red: "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/30",
};

function TrendSparkline({ points }: { points: HealthSnapshotPoint[] }) {
  if (points.length < 2) return null;
  const width = 140;
  const height = 36;
  const coords = points
    .map((p, idx) => {
      const x = (idx / (points.length - 1)) * width;
      const y = height - (p.score / 100) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible" aria-label="Health score trend">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary"
        points={coords}
      />
    </svg>
  );
}

export function HealthScoreCard({ applicationId }: Props) {
  const [data, setData] = React.useState<(HealthScoreResult & { snapshots: HealthSnapshotPoint[] }) | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    getApplicationHealthScore(applicationId).then((res) => {
      if (res.data) setData(res.data);
      setLoading(false);
    });
  }, [applicationId]);

  if (loading) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-4 text-xs text-muted-foreground">Calculating health score...</CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-sm font-semibold">Application Health Score</CardTitle>
          <CardDescription className="text-xs">
            Deterministic score (0–100) based on active monitoring, security, expiry, and code health
          </CardDescription>
        </div>
        <div className="flex items-center gap-3">
          {data.snapshots.length >= 2 && (
            <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              <TrendSparkline points={data.snapshots} />
            </div>
          )}
          <div className={`rounded-xl border px-3.5 py-1.5 text-center ${BAND_STYLES[data.band]}`}>
            <span className="text-xl font-bold font-mono">{data.score}</span>
            <span className="text-xs opacity-75">/100</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.topFixes.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>No active deductions. Everything configured is healthy!</span>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">Top {data.topFixes.length} Things to Fix</p>
            {data.topFixes.map((fix) => (
              <Link
                key={fix.id}
                href={fix.href}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs hover:bg-muted/40 transition-colors"
              >
                <span className="font-medium text-foreground">{fix.title}</span>
                <span className="inline-flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400 shrink-0 ml-2">
                  Fix this to gain +{fix.pointsRecovered}
                  <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
