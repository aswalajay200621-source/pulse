"use client";

import * as React from "react";
import { getAlerts, markAlertRead, markAllAlertsRead } from "@/app/actions/alerts";
import type { AlertRecord } from "@/lib/supabase/types";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle2, RefreshCw } from "lucide-react";

export default function AlertsPage() {
  const [alerts, setAlerts] = React.useState<AlertRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | "unread">("all");

  const loadAlerts = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getAlerts();
    if (res.error) setError(res.error);
    else setAlerts(res.alerts || []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  const handleMarkAllRead = async () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    await markAllAlertsRead();
  };

  const handleToggleRead = async (id: string, currentRead: boolean) => {
    const nextRead = !currentRead;
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, is_read: nextRead } : a))
    );
    await markAlertRead(id, nextRead);
  };

  const filteredAlerts = alerts.filter((a) => {
    if (filter === "unread") return !a.is_read;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Alerts & Notifications
            </h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-0.5 text-xs font-mono font-semibold">
                {unreadCount} Unread
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real problems found on your apps — downtime, slow loading, or security issues.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAlerts}
            disabled={loading}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            className="text-xs"
          >
            Mark All as Read
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border/50 pb-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === "all"
              ? "bg-muted text-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          All Alerts ({alerts.length})
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === "unread"
              ? "bg-muted text-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400">
          Could not load alerts: {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl border border-border bg-card/50" />
          ))}
        </div>
      ) : filteredAlerts.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-5 w-5" />}
          title="No alerts yet"
          description="Your apps look good. When Pulse finds a problem, it will show up here."
        />
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <Card
              key={alert.id}
              className={`transition-colors ${
                !alert.is_read ? "border-rose-500/40 bg-card" : "border-border bg-card/60"
              }`}
            >
              <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <StatusBadge
                      status={
                        alert.severity === "critical"
                          ? "critical"
                          : alert.severity === "high"
                            ? "high"
                            : alert.severity === "medium"
                              ? "medium"
                              : "low"
                      }
                    />
                    <h2 className="text-sm font-semibold text-foreground">
                      {alert.title}
                    </h2>
                    {!alert.is_read && (
                      <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400">
                        NEW
                      </span>
                    )}
                  </div>
                  {alert.description && (
                    <p className="text-sm text-muted-foreground">
                      {alert.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(alert.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleRead(alert.id, alert.is_read)}
                    className="text-xs gap-1.5"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {alert.is_read ? "Mark Unread" : "Mark Read"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
