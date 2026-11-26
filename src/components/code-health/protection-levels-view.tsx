"use client";

import * as React from "react";
import Link from "next/link";
import {
  getProtectionLevels,
  type ProtectionLevelsResponse,
} from "@/app/actions/protection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlowCheckSection } from "@/components/code-health/flow-check-section";
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  Circle,
  ChevronDown,
  ChevronRight,
  Lock,
  ArrowRight,
  Ban,
} from "lucide-react";

interface ProtectionLevelsViewProps {
  applicationId: string;
}

export function ProtectionLevelsView({
  applicationId,
}: ProtectionLevelsViewProps) {
  const [data, setData] = React.useState<ProtectionLevelsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [expandedCantSee, setExpandedCantSee] = React.useState<
    Record<number, boolean>
  >({});

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getProtectionLevels(applicationId);
    if (res.error) setError(res.error);
    else if (res.data) setData(res.data);
    setLoading(false);
  }, [applicationId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const toggleCantSee = (level: number) => {
    setExpandedCantSee((prev) => ({ ...prev, [level]: !prev[level] }));
  };

  if (loading) {
    return (
      <div className="p-6 text-xs text-muted-foreground">
        Loading protection levels...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-500">
        {error || "Could not load protection levels."}
      </div>
    );
  }

  const pct = Math.round((data.connectedCount / 6) * 100);

  return (
    <div className="space-y-6">
      {/* Coverage Meter */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-500" />
              <CardTitle className="text-base font-semibold">
                Protection level: {data.connectedCount} of 6 connected
              </CardTitle>
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              {pct}% coverage
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            The more you connect, the more Pulse can catch. Everything beyond
            Level 1 is optional.
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Six Level Cards */}
      <div className="space-y-4">
        {data.levels.map((lvl) => {
          const isOpen = Boolean(expandedCantSee[lvl.level]);
          const badge =
            lvl.status === "connected" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </span>
            ) : lvl.status === "needs_attention" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                Needs attention
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                <Circle className="h-3 w-3" />
                Not connected
              </span>
            );

          return (
            <Card key={lvl.level} className="border-border/70">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono font-semibold text-muted-foreground">
                      LEVEL {lvl.level}
                    </span>
                    <CardTitle className="text-sm font-semibold">
                      {lvl.title}
                    </CardTitle>
                    {!lvl.optional && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                        Required
                      </span>
                    )}
                  </div>
                  {badge}
                </div>
                {lvl.statusReason && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    {lvl.statusReason}
                  </p>
                )}
              </CardHeader>

              <CardContent className="space-y-3 text-xs">
                <div>
                  <span className="font-semibold text-foreground">
                    What Pulse can detect when you add this:{" "}
                  </span>
                  <span className="text-muted-foreground">{lvl.detects}</span>
                </div>

                <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    {lvl.safeLabel}{" "}
                  </span>
                  <span className="text-muted-foreground">{lvl.safeBecause}</span>
                </div>

                <div>
                  <span className="font-semibold text-foreground">
                    What you give Pulse:{" "}
                  </span>
                  <span className="text-muted-foreground">{lvl.youGive}</span>
                </div>

                {/* Collapsible "What Pulse still can't see at this level" */}
                <div>
                  <button
                    type="button"
                    onClick={() => toggleCantSee(lvl.level)}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                    What Pulse still can&apos;t see at this level
                  </button>
                  {isOpen && (
                    <p className="mt-1.5 pl-4 text-[11px] text-muted-foreground border-l border-border/60">
                      {lvl.cantSee}
                    </p>
                  )}
                </div>

                <div className="pt-1">
                  {lvl.ctaTab ? (
                    <Link
                      href={`/dashboard/applications/${data.applicationId}?tab=${lvl.ctaTab}`}
                    >
                      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                        {lvl.ctaLabel}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  ) : (
                    <FlowCheckSection
                      applicationId={data.applicationId}
                      domainVerified={data.domainVerified}
                      onChanged={load}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Honest Note */}
      <Card className="border-border/70 bg-muted/20">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-2">
          <p>
            Even with everything connected, Pulse cannot find logic mistakes
            (for example, one user seeing another user&apos;s data), bugs in
            code nobody has run yet, or problems in services you have not
            connected. Those need a human tester.
          </p>
          <p>
            <Link
              href="/dashboard/experts"
              className="underline underline-offset-2 text-foreground hover:opacity-80"
            >
              Browse Pulse Experts for human testing
            </Link>
          </p>
        </CardContent>
      </Card>

      {/* Permanent "What Pulse will never ask you for" box */}
      <Card className="border-rose-500/30 bg-rose-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <Ban className="h-4 w-4" />
            What Pulse will never ask you for
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Passwords or admin logins for your app, hosting, Google or GitHub</li>
            <li>Database passwords, connection strings or service role keys</li>
            <li>Payment secret keys</li>
            <li>Any token that can change or delete things</li>
            <li>Customer data</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
