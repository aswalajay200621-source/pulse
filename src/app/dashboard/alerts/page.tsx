"use client";

import * as React from "react";
import { mockAlerts, IncidentAlert } from "@/data/mock-data";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle2, Filter, AlertOctagon, RefreshCw } from "lucide-react";

export default function AlertsPage() {
  const [alerts, setAlerts] = React.useState<IncidentAlert[]>(mockAlerts);
  const [filter, setFilter] = React.useState<"all" | "unread" | "resolved">("all");

  const unreadCount = alerts.filter((a) => !a.read).length;

  const markAllRead = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
  };

  const toggleRead = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, read: !a.read } : a))
    );
  };

  const toggleResolved = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, resolved: !a.resolved, read: true } : a
      )
    );
  };

  const filteredAlerts = alerts.filter((a) => {
    if (filter === "unread") return !a.read;
    if (filter === "resolved") return a.resolved;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Incident Alerts & Notifications
            </h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 px-2 py-0.5 text-xs font-mono font-semibold">
                {unreadCount} Unread
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Downtime warnings, latency alerts, and TLS expiry escalations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="text-xs"
          >
            Mark All as Read
          </Button>
        </div>
      </div>

      {/* Tabs */}
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
        <button
          onClick={() => setFilter("resolved")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === "resolved"
              ? "bg-muted text-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Resolved ({alerts.filter((a) => a.resolved).length})
        </button>
      </div>

      {/* Alert List */}
      {filteredAlerts.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-6 w-6 text-emerald-500" />}
          title="No alerts in this view"
          description="Everything is running smoothly or all incidents in this category have been addressed."
        />
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <Card
              key={alert.id}
              className={`transition-all ${
                !alert.read
                  ? "border-l-4 border-l-rose-500 bg-card shadow-sm"
                  : "border-border/60 bg-card/60 opacity-80"
              }`}
            >
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={alert.severity} />
                      <span className="font-semibold text-sm text-foreground">
                        {alert.title}
                      </span>
                      {!alert.read && (
                        <span className="rounded bg-rose-500/10 text-rose-500 text-[10px] font-mono px-1.5 py-0.2">
                          NEW
                        </span>
                      )}
                      {alert.resolved && (
                        <span className="rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-mono px-1.5 py-0.2">
                          RESOLVED
                        </span>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {alert.message}
                    </p>

                    <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground pt-1">
                      <span>Application: <strong className="font-sans text-foreground">{alert.appName}</strong></span>
                      <span>•</span>
                      <span>{alert.timestamp}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleRead(alert.id)}
                      className="text-xs h-8"
                    >
                      {alert.read ? "Mark Unread" : "Mark Read"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleResolved(alert.id)}
                      className="text-xs h-8"
                    >
                      {alert.resolved ? "Reopen" : "Resolve Incident"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
