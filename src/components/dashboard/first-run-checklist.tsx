"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getChecklistState,
  skipChecklistStep,
  dismissChecklist,
  type ChecklistState,
} from "@/app/actions/checklist";
import { CheckCircle2, Circle, ArrowRight, X, Sparkles, Rocket } from "lucide-react";

export function FirstRunChecklist() {
  const [state, setState] = React.useState<ChecklistState | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    const res = await getChecklistState();
    if (res.data) setState(res.data);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  if (loading || !state || state.dismissed) return null;

  const doneCount = state.steps.filter((s) => s.completed || (s.optional && s.skipped)).length;
  const pct = Math.round((doneCount / state.steps.length) * 100);

  const handleSkip = async (stepId: string) => {
    await skipChecklistStep(stepId);
    await load();
  };

  const handleDismiss = async () => {
    await dismissChecklist();
    setState((prev) => (prev ? { ...prev, dismissed: true } : prev));
  };

  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" />
            Setup in Under 5 Minutes
          </CardTitle>
          <CardDescription className="text-xs mt-0.5">
            {doneCount} of {state.steps.length} steps complete ({pct}%)
          </CardDescription>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss checklist"
          className="text-muted-foreground hover:text-foreground p-1 rounded"
        >
          <X className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>

        {state.hasApps && state.firstAppId && (
          <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              Want Pulse to catch more?{" "}
              <Link
                href={`/dashboard/apps/${state.firstAppId}/protection`}
                className="font-medium text-foreground underline underline-offset-2 hover:opacity-80"
              >
                See your protection levels
              </Link>
            </span>
          </div>
        )}

        {!state.hasApps ? (
          <div className="rounded-lg border border-border/60 bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-foreground">No applications monitored yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add your first app URL to get an instant health check and score.
              </p>
            </div>
            <Link href="/dashboard/applications">
              <Button size="sm" className="gap-1.5 shrink-0">
                Add First App <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        ) : state.allDone ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-5 w-5 shrink-0" />
              <div>
                <p className="text-xs font-semibold">You&apos;re all set!</p>
                <p className="text-[11px] opacity-90">
                  Pulse is actively monitoring your application.
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={handleDismiss} className="text-xs h-7">
              Hide
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {state.steps.map((step) => {
              const isDone = step.completed || (step.optional && step.skipped);
              return (
                <div
                  key={step.id}
                  className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 text-xs ${
                    isDone ? "border-border/40 bg-muted/20 opacity-70" : "border-border/70 bg-card"
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {step.title}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">{step.timeEstimate}</span>
                        {step.optional && (
                          <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                            Optional
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{step.description}</p>
                    </div>
                  </div>

                  {!isDone && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {step.optional && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[11px] text-muted-foreground"
                          onClick={() => handleSkip(step.id)}
                        >
                          Skip for now
                        </Button>
                      )}
                      <Link href={step.href}>
                        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1">
                          Go <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
