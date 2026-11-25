"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock, AlertTriangle, Settings2 } from "lucide-react";
import { getHealthCheckResults, updateHealthCheckSettings, type HealthCheckResultRecord } from "@/app/actions/code-health";

interface Props {
  applicationId: string;
  applicationUrl: string;
  initialPath: string | null;
  initialEnabled: boolean;
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  healthy: { icon: <CheckCircle2 className="h-4 w-4" />, color: "text-emerald-500", label: "Healthy" },
  unhealthy: { icon: <XCircle className="h-4 w-4" />, color: "text-red-500", label: "Unhealthy" },
  timeout: { icon: <Clock className="h-4 w-4" />, color: "text-orange-500", label: "Timed out" },
  error: { icon: <AlertTriangle className="h-4 w-4" />, color: "text-yellow-500", label: "Error" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function HealthCheckTab({ applicationId, applicationUrl, initialPath, initialEnabled }: Props) {
  const [results, setResults] = React.useState<HealthCheckResultRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showSettings, setShowSettings] = React.useState(!initialEnabled);
  const [path, setPath] = React.useState(initialPath || "/api/health");
  const [enabled, setEnabled] = React.useState(initialEnabled);
  const [saving, setSaving] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    getHealthCheckResults(applicationId).then((r) => {
      if (r.success) setResults(r.data || []);
      setLoading(false);
    });
  }, [applicationId]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    const res = await updateHealthCheckSettings(applicationId, { healthCheckPath: path.trim() || null, enabled });
    setSaveMsg(res.success ? "Settings saved. Changes take effect on the next monitoring run." : (res.error || "Failed to save."));
    setSaving(false);
  };

  const latest = results[0];
  const latestConfig = latest ? (STATUS_CONFIG[latest.status] || STATUS_CONFIG.error) : null;

  const nextjsSnippet = `// src/app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Add your DB ping here, e.g.:
    // await db.query('SELECT 1');
    return NextResponse.json({ status: 'ok' });
  } catch {
    // Never expose internal details
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}`;

  const expressSnippet = `// Express
app.get('/api/health', async (req, res) => {
  try {
    // await db.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(500).json({ status: 'error' });
  }
});`;

  return (
    <div className="space-y-4">
      {/* Current status */}
      {!loading && latest && (
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <span className={latestConfig?.color}>{latestConfig?.icon}</span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Health endpoint is <span className={latestConfig?.color}>{latestConfig?.label}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Last checked {timeAgo(latest.checked_at)}
                  {latest.status_code && ` · HTTP ${latest.status_code}`}
                  {initialPath && ` · ${applicationUrl}${initialPath}`}
                </p>
              </div>
            </div>
            {latest.response_excerpt && (
              <pre className="mt-3 text-[10px] font-mono bg-muted/40 rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-20">
                {latest.response_excerpt}
              </pre>
            )}
            {latest.error_message && (
              <p className="mt-2 text-xs text-red-500">{latest.error_message}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Settings */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <button
            className="flex items-center justify-between w-full text-left"
            onClick={() => setShowSettings((s) => !s)}
          >
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              Health Check Settings
            </CardTitle>
            <span className={`text-xs px-2 py-0.5 rounded-full ${enabled ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
              {enabled ? "Enabled" : "Disabled"}
            </span>
          </button>
        </CardHeader>
        {showSettings && (
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Health check path</label>
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/api/health"
                className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <p className="text-[11px] text-muted-foreground">Relative path only, e.g. /api/health or /health</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="hc-enabled"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="hc-enabled" className="text-xs text-foreground">Enable health check monitoring</label>
            </div>
            <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 text-xs">
              {saving ? "Saving..." : "Save settings"}
            </Button>
            {saveMsg && <p className="text-xs text-muted-foreground">{saveMsg}</p>}
          </CardContent>
        )}
      </Card>

      {/* Recent results history */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Recent Health Check History</CardTitle>
          <CardDescription className="text-xs">Last 50 results (checked every 10 minutes when enabled)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
          ) : results.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs text-muted-foreground">No health check results yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Configure a path above and enable monitoring.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {results.slice(0, 20).map((r) => {
                const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.error;
                return (
                  <div key={r.id} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={cfg.color}>{cfg.icon}</span>
                      <span className="font-medium">{cfg.label}</span>
                      {r.status_code && <span className="text-muted-foreground font-mono">HTTP {r.status_code}</span>}
                    </div>
                    <span className="text-muted-foreground">{timeAgo(r.checked_at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Copy-paste examples */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Example Health Endpoints</CardTitle>
          <CardDescription className="text-xs">Copy-paste ready, safe to use in production</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs font-semibold mb-1 text-foreground">Next.js App Router</p>
            <pre className="text-[10px] font-mono bg-muted/50 rounded p-3 overflow-x-auto whitespace-pre-wrap">{nextjsSnippet}</pre>
          </div>
          <div>
            <p className="text-xs font-semibold mb-1 text-foreground">Express</p>
            <pre className="text-[10px] font-mono bg-muted/50 rounded p-3 overflow-x-auto whitespace-pre-wrap">{expressSnippet}</pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
