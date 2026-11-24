import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface LogoProps {
  className?: string;
  size?: "sm" | "default" | "lg";
  withText?: boolean;
}

export function Logo({
  className,
  size = "default",
  withText = true,
}: LogoProps) {
  const sizeClasses = {
    sm: "h-7 w-7",
    default: "h-8 w-8",
    lg: "h-10 w-10",
  };

  const textClasses = {
    sm: "text-base tracking-tight font-semibold",
    default: "text-lg tracking-tight font-semibold",
    lg: "text-xl tracking-tight font-bold",
  };

  return (
    <div className={cn("inline-flex items-center gap-2.5 group select-none", className)}>
      <div
        className={cn(
          "relative flex items-center justify-center rounded-lg border border-border/80 bg-foreground text-background dark:bg-foreground dark:text-background shadow-sm transition-transform duration-200 group-hover:scale-105",
          sizeClasses[size]
        )}
      >
        {/* Heartbeat pulse path */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4/5 w-4/5 text-current"
        >
          <path d="M3 12h3.5l2-6 3.5 12 3-8 2 4 1.5-2H21" />
        </svg>
      </div>

      {withText && (
        <span className={cn("text-foreground font-sans", textClasses[size])}>
          Pulse
        </span>
      )}
    </div>
  );
}

export function LogoLink({
  href = "/",
  ...props
}: LogoProps & { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center focus:outline-none">
      <Logo {...props} />
    </Link>
  );
}
