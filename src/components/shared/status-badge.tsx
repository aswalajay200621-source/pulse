import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatusBadgeProps {
  status: "online" | "degraded" | "down" | "maintenance" | "valid" | "expiring_soon" | "expired" | "critical" | "high" | "medium" | "low" | "open" | "resolved";
  className?: string;
  showIcon?: boolean;
}

export function StatusBadge({ status, className, showIcon = true }: StatusBadgeProps) {
  switch (status) {
    case "online":
    case "valid":
    case "resolved":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
            className
          )}
        >
          {showIcon && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
          {status === "online" ? "Online" : status === "valid" ? "Valid" : "Resolved"}
        </span>
      );

    case "degraded":
    case "expiring_soon":
    case "medium":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
            className
          )}
        >
          {showIcon && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
          {status === "degraded" ? "Degraded" : status === "expiring_soon" ? "Expiring Soon" : "Medium"}
        </span>
      );

    case "down":
    case "expired":
    case "critical":
    case "high":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
            className
          )}
        >
          {showIcon && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />}
          {status === "down"
            ? "Down"
            : status === "expired"
            ? "Expired"
            : status === "critical"
            ? "Critical"
            : "High"}
        </span>
      );

    case "low":
    case "open":
    case "maintenance":
    default:
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground border border-border/80",
            className
          )}
        >
          {showIcon && <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />}
          {status === "maintenance" ? "Maintenance" : status === "low" ? "Low" : "Open"}
        </span>
      );
  }
}
