"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  getGitHubInstallationStatus,
  getConnectedRepositories,
  syncGitHubRepositories,
  associateRepositoryWithApplication,
  disconnectGitHubInstallation,
  GitHubStatusResult,
} from "@/app/actions/github";
import { getApplications } from "@/app/actions/applications";
import {
  GithubInstallationRecord,
  GithubRepositoryRecord,
  ApplicationRecord,
} from "@/lib/supabase/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Link2,
  Lock,
  Globe,
  GitBranch,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

export function GitHubIntegrationPanel() {
  const searchParams = useSearchParams();
  const urlSuccess = searchParams.get("success");
  const urlError = searchParams.get("error");

  const [status, setStatus] = React.useState<GitHubStatusResult | null>(null);
  const [repos, setRepos] = React.useState<GithubRepositoryRecord[]>([]);
  const [apps, setApps] = React.useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [updatingRepoId, setUpdatingRepoId] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(urlSuccess ? "GitHub account connected successfully!" : null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(urlError);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    const [statusRes, reposRes, appsRes] = await Promise.all([
      getGitHubInstallationStatus(),
      getConnectedRepositories(),
      getApplications(),
    ]);

    setStatus(statusRes);
    if (reposRes.success) setRepos(reposRes.data);
    if (appsRes.success && appsRes.data) setApps(appsRes.data);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSync = async () => {
    if (!status?.installation) return;
    setSyncing(true);
    setErrorMessage(null);

    const res = await syncGitHubRepositories(status.installation.installation_id);
    if (res.success) {
      setMessage(`Successfully refreshed ${res.count} repositories from GitHub.`);
      await fetchData();
    } else {
      setErrorMessage(res.error || "Failed to sync repositories.");
    }
    setSyncing(false);
  };

  const handleDisconnect = async () => {
    if (!status?.installation) return;
    if (
      !confirm(
        `Disconnect GitHub account "${status.installation.account_login}"? Linked repository associations will be cleared.`
      )
    ) {
      return;
    }

    setDisconnecting(true);
    setErrorMessage(null);

    const res = await disconnectGitHubInstallation(status.installation.installation_id);
    if (res.success) {
      setMessage("GitHub installation disconnected successfully.");
      await fetchData();
    } else {
      setErrorMessage(res.error || "Failed to disconnect.");
    }
    setDisconnecting(false);
  };

  const handleLinkApplication = async (repoId: string, appId: string) => {
    setUpdatingRepoId(repoId);
    setErrorMessage(null);

    const targetAppId = appId === "none" ? null : appId;
    const res = await associateRepositoryWithApplication(repoId, targetAppId);

    if (res.success) {
      setMessage("Repository association updated.");
      await fetchData();
    } else {
      setErrorMessage(res.error || "Failed to link repository.");
    }
    setUpdatingRepoId(null);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-40 rounded-lg border border-border/60 bg-muted/20 animate-pulse" />
      </div>
    );
  }

  const isConfigured = status?.configured ?? false;
  const isConnected = status?.connected ?? false;
  const installation = status?.installation;

  return (
    <div className="space-y-6">
      {/* Alert Banners */}
      {message && (
        <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{message}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{errorMessage}</span>
        </div>
      )}

      {/* Configuration Status Notice */}
      {!isConfigured && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="font-semibold text-sm">GitHub App Configuration Notice</p>
              <p className="text-muted-foreground dark:text-amber-300/90 leading-relaxed">
                To connect real GitHub repositories, register a GitHub App on GitHub with read-only <strong>Contents</strong> and <strong>Metadata</strong> permissions, then add the credentials to your <code className="font-mono bg-amber-500/20 px-1 py-0.5 rounded">.env.local</code>:
              </p>
              <div className="font-mono text-[10px] bg-amber-500/20 p-2.5 rounded text-amber-950 dark:text-amber-100 space-y-0.5">
                <div>GITHUB_APP_ID=123456</div>
                <div>GITHUB_APP_SLUG=pulse-health-monitor</div>
                <div>GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."</div>
                <div>GITHUB_APP_WEBHOOK_SECRET=your-webhook-secret</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Connection Status Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm">
                <GithubIcon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  GitHub App Integration
                </CardTitle>
                <CardDescription className="text-xs">
                  Authorize repositories for vulnerability scanning and automated code change detection
                </CardDescription>
              </div>
            </div>

            <div>
              {isConnected ? (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Connected to GitHub
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs text-muted-foreground font-medium">
                  Not Connected
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isConnected && installation ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3.5">
                <div className="flex items-center gap-3">
                  {installation.account_avatar_url ? (
                    <img
                      src={installation.account_avatar_url}
                      alt={installation.account_login}
                      className="h-9 w-9 rounded-full border border-border"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted font-bold text-xs">
                      {installation.account_login.slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs sm:text-sm text-foreground">
                        {installation.account_login}
                      </span>
                      <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground uppercase">
                        {installation.account_type}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      Installation ID: {installation.installation_id} • Connected {new Date(installation.installed_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSync}
                    disabled={syncing}
                    className="gap-1.5 text-xs h-8"
                  >
                    <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
                    {syncing ? "Syncing..." : "Sync Repositories"}
                  </Button>

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="gap-1.5 text-xs h-8"
                  >
                    <Trash2 className="h-3 w-3" />
                    Disconnect
                  </Button>
                </div>
              </div>

              {/* Minimal Permissions Badge */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-border/40 pt-3">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>
                  <strong>Least-Privilege Scopes:</strong> Read-only Contents & Metadata. No write or administrative permissions.
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs sm:text-sm text-foreground font-medium">
                  Connect your GitHub repositories
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                  Install our official GitHub App to select public or private repositories. Pulse will monitor commits and trigger security audits without exposing your code.
                </p>
              </div>

              <div className="shrink-0">
                <a href="/api/github/connect">
                  <Button className="gap-2">
                    <GithubIcon className="h-4 w-4" />
                    Connect GitHub App
                  </Button>
                </a>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connected Repositories List & Application Association */}
      {isConnected && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  Authorized Repositories ({repos.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Associate authorized repositories with your monitored Pulse applications
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {repos.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No repositories detected for this installation. Click <strong>"Sync Repositories"</strong> above or check your GitHub App installation permissions.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="border-y border-border/70 bg-muted/40 font-mono text-[11px] uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Repository</th>
                      <th className="py-2.5 px-4 font-medium">Visibility</th>
                      <th className="py-2.5 px-4 font-medium">Branch</th>
                      <th className="py-2.5 px-4 font-medium">Associated Pulse App</th>
                      <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {repos.map((repo) => {
                      const linkedApp = apps.find((a) => a.id === repo.application_id);

                      return (
                        <tr key={repo.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <a
                                href={repo.html_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-foreground hover:underline inline-flex items-center gap-1"
                              >
                                {repo.full_name}
                                <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                              </a>
                            </div>
                            <span className="text-[11px] font-mono text-muted-foreground">
                              Synced {new Date(repo.last_synchronized_at).toLocaleTimeString()}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            {repo.is_private ? (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                <Lock className="h-2.5 w-2.5" /> Private
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[10px] font-mono font-medium text-muted-foreground border border-border">
                                <Globe className="h-2.5 w-2.5" /> Public
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 font-mono text-xs">
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <GitBranch className="h-3 w-3" /> {repo.default_branch}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <select
                              value={repo.application_id || "none"}
                              disabled={updatingRepoId === repo.id}
                              onChange={(e) => handleLinkApplication(repo.id, e.target.value)}
                              className="h-8 rounded-md border border-input bg-card px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-w-[200px]"
                            >
                              <option value="none">-- Not Associated --</option>
                              {apps.map((app) => (
                                <option key={app.id} value={app.id}>
                                  {app.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="py-3 px-4 text-right">
                            {linkedApp ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                <Link2 className="h-3 w-3" /> Linked to {linkedApp.name}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Available</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
