import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  subtitle,
  icon,
  className,
}: StatCardProps) {
  const changeColors = {
    positive: "text-emerald-600 dark:text-emerald-400",
    negative: "text-rose-600 dark:text-rose-400",
    neutral: "text-muted-foreground",
  };

  return (
    <Card className={cn("relative overflow-hidden bg-card/60 backdrop-blur-sm", className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
            {title}
          </p>
          {icon && (
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-muted/40 text-muted-foreground">
              {icon}
            </div>
          )}
        </div>

        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground font-mono">
            {value}
          </span>
          {change && (
            <span className={cn("text-xs font-medium", changeColors[changeType])}>
              {change}
            </span>
          )}
        </div>

        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground/80 leading-relaxed">
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
