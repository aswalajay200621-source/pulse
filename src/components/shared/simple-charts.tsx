"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface LatencyPoint {
  time: string;
  value: number;
}

export function LatencyAreaChart({
  data,
  height = 140,
  className,
}: {
  data: LatencyPoint[];
  height?: number;
  className?: string;
}) {
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => d.value), 10);
  const minVal = Math.min(...data.map((d) => d.value), 0);
  const range = maxVal - minVal || 1;

  // 1000 x 200 coordinate space
  const width = 1000;
  const chartHeight = 200;
  const paddingY = 20;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = chartHeight - paddingY - ((d.value - minVal) / range) * (chartHeight - paddingY * 2);
    return { x, y, value: d.value, time: d.time };
  });

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, "");

  const areaD = `${pathD} L ${width} ${chartHeight} L 0 ${chartHeight} Z`;

  return (
    <div className={cn("w-full overflow-hidden flex flex-col justify-end", className)}>
      <div className="relative w-full" style={{ height: `${height}px` }}>
        <svg
          viewBox={`0 0 ${width} ${chartHeight}`}
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
        >
          <defs>
            <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1="0"
            y1={paddingY}
            x2={width}
            y2={paddingY}
            stroke="currentColor"
            strokeDasharray="4 4"
            className="text-border/60"
            strokeWidth="1"
          />
          <line
            x1="0"
            y1={chartHeight / 2}
            x2={width}
            y2={chartHeight / 2}
            stroke="currentColor"
            strokeDasharray="4 4"
            className="text-border/60"
            strokeWidth="1"
          />
          <line
            x1="0"
            y1={chartHeight - paddingY}
            x2={width}
            y2={chartHeight - paddingY}
            stroke="currentColor"
            strokeDasharray="4 4"
            className="text-border/60"
            strokeWidth="1"
          />

          {/* Area */}
          <path
            d={areaD}
            fill="url(#latencyGradient)"
            className="text-primary/40 dark:text-primary/30"
          />

          {/* Line */}
          <path
            d={pathD}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary"
          />

          {/* Points */}
          {points.map((p, idx) => (
            <circle
              key={idx}
              cx={p.x}
              cy={p.y}
              r="3.5"
              className="fill-background stroke-primary stroke-2"
            />
          ))}
        </svg>
      </div>

      {/* Axis labels */}
      <div className="mt-2 flex justify-between text-[11px] font-mono text-muted-foreground/70">
        <span>{data[0]?.time}</span>
        <span>{data[Math.floor(data.length / 2)]?.time}</span>
        <span>{data[data.length - 1]?.time}</span>
      </div>
    </div>
  );
}

export function UptimeBarStrip({
  bars,
  className,
}: {
  bars: { day: string; status: "up" | "degraded" | "down" }[];
  className?: string;
}) {
  return (
    <div className={cn("w-full space-y-2", className)}>
      <div className="flex h-7 w-full items-stretch gap-1 sm:gap-1.5">
        {bars.map((bar, i) => {
          let bgClass = "bg-emerald-500 hover:bg-emerald-400";
          if (bar.status === "degraded") bgClass = "bg-amber-500 hover:bg-amber-400";
          if (bar.status === "down") bgClass = "bg-rose-500 hover:bg-rose-400";

          return (
            <div
              key={i}
              className="group relative flex-1"
            >
              <div
                className={cn(
                  "h-full w-full rounded-sm opacity-85 transition-opacity group-hover:opacity-100",
                  bgClass
                )}
              />
              <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background opacity-0 shadow-md transition-opacity group-hover:opacity-100 z-20">
                {bar.day}: {bar.status.toUpperCase()}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
        <span>30 days ago</span>
        <span className="text-emerald-500 dark:text-emerald-400 font-medium">99.98% Uptime</span>
        <span>Today</span>
      </div>
    </div>
  );
}
