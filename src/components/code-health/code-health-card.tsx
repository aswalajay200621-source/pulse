"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertTriangle, GitBranch, Rocket, FlaskConical, Bug } from "lucide-react";
import { getRepoStatus, type RepoStatusRecord } from "@/app/actions/code-health";
import { getOpenErrorCount } from "@/app/actions/errors";

interface Props {
  applicationId: string;
  hasGithubRepo: boolean;
}

type HealthState = "good" | "warn" | "bad" | "unknown";

function statusIcon(state: HealthState) {
  if (state === "good") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (state === "warn") return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  if (state === "bad") return <XCircle className="h-4 w-4 text-red-500" />;
  return <span className="h-4 w-4 rounded-full bg-muted border border-border inline-block" />;
}

function buildState(conclusion: string | null): HealthState {
  if (!conclusion || conclusion === "none") return "unknown";
  if (conclusion === "success") return "good";
  if (conclusion === "skipped") return "warn";
  return "bad"; // failure, cancelled, timed_out
}

function deployState(state: string | null): HealthState {
  if (!state) return "unknown";
  if (state === "success") return "good";
  if (state === "in_progress" || state === "pending" || state === "queued") return "warn";
  if (state === "inactive") return "unknown";
  return "bad";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function overallState(repo: RepoStatusRecord | null, openErrors: number): HealthState {
  if (!repo) return "unknown";
  const b = buildState(repo.last_run_conclusion);
  const d = deployState(repo.last_deploy_state);
  if (b === "bad" || d === "bad" || openErrors >= 10) return "bad";
  if (b === "warn" || d === "warn" || !repo.tests_present || openErrors > 0) return "warn";
  return "good";
}

const OVERALL_COLORS: Record<HealthState, string> = {
  good: "border-emerald-500/30 bg-emerald-500/5",
  warn: "border-yellow-500/30 bg-yellow-500/5",
  bad: "border-red-500/30 bg-red-500/5",
  unknown: "border-border/60 bg-muted/10",
};

export function CodeHealthCard({ applicationId, hasGithubRepo }: Props) {
  const [repo, setRepo] = React.useState<RepoStatusRecord | null>(null);
  const [openErrors, setOpenErrors] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    Promise.all([
      getRepoStatus(applicationId),
      getOpenErrorCount(applicationId),
    ]).then(([repoRes, errCount]) => {
      if (repoRes.success) setRepo(repoRes.data || null);
      setOpenErrors(errCount);
      setLoading(false);
    });
  }, [applicationId]);

  const overall = overallState(repo, openErrors);

  if (loading) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-4 text-xs text-muted-foreground">Loading code health…</CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border ${OVERALL_COLORS[overall]}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          {statusIcon(overall)}
          <span className="text-sm font-semibold text-foreground">
            Code Health {overall === "good" ? "— All Good" : overall === "warn" ? "— Warnings" : overall === "bad" ? "— Issues Found" : "— Not Configured"}
          </span>
          {repo && <span className="text-[11px] text-muted-foreground ml-auto">Updated {timeAgo(repo.checked_at)}</span>}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Build status */}
          <div className="flex items-center gap-2 rounded-md border border-border/50 bg-background/60 p-2">
            <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-foreground leading-tight">Build</p>
              {!hasGithubRepo ? (
                <p className="text-muted-foreground text-[11px]">No repo linked</p>
              ) : !repo ? (
                <p className="text-muted-foreground text-[11px]">Not checked yet</p>
              ) : (
                <div className="flex items-center gap-1">
                  {statusIcon(buildState(repo.last_run_conclusion))}
                  <span className="text-[11px] capitalize">{repo.last_run_conclusion || "none"}</span>
                </div>
              )}
            </div>
          </div>

          {/* Deploy status */}
          <div className="flex items-center gap-2 rounded-md border border-border/50 bg-background/60 p-2">
            <Rocket className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-foreground leading-tight">Deploy</p>
              {!hasGithubRepo ? (
                <p className="text-muted-foreground text-[11px]">No repo linked</p>
              ) : !repo ? (
                <p className="text-muted-foreground text-[11px]">Not checked yet</p>
              ) : (
                <div className="flex items-center gap-1">
                  {statusIcon(deployState(repo.last_deploy_state))}
                  <span className="text-[11px] capitalize">{repo.last_deploy_state || "none"}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tests */}
          <div className="flex items-center gap-2 rounded-md border border-border/50 bg-background/60 p-2">
            <FlaskConical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-foreground leading-tight">Tests</p>
              {!hasGithubRepo || !repo ? (
                <p className="text-muted-foreground text-[11px]">—</p>
              ) : repo.tests_present ? (
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  <span className="text-[11px]">Found</span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  <span className="text-[11px]">None found</span>
                </div>
              )}
            </div>
          </div>

          {/* Open errors */}
          <div className="flex items-center gap-2 rounded-md border border-border/50 bg-background/60 p-2">
            <Bug className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-foreground leading-tight">Errors</p>
              <div className="flex items-center gap-1">
                {openErrors === 0 ? (
                  <><CheckCircle2 className="h-3 w-3 text-emerald-500" /><span className="text-[11px]">None open</span></>
                ) : (
                  <><XCircle className="h-3 w-3 text-red-500" /><span className="text-[11px]">{openErrors} open</span></>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Links */}
        {repo && (
          <div className="flex flex-wrap gap-2 text-[11px]">
            {repo.last_commit_sha && (
              <span className="font-mono text-muted-foreground">commit {repo.last_commit_sha}</span>
            )}
            {repo.last_run_url && (
              <a href={repo.last_run_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View build ↗</a>
            )}
            {repo.last_deploy_url && (
              <a href={repo.last_deploy_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View deploy ↗</a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
