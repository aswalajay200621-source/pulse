"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getStatusPageSettings,
  updateStatusPageSettings,
  rotateStatusPageSlug,
  type StatusPageSettings,
} from "@/app/actions/status-page";
import { Globe, RefreshCw, ExternalLink, Copy, CheckCircle2 } from "lucide-react";

interface Props {
  applicationId: string;
  applicationName: string;
}

export function StatusPageTab({ applicationId, applicationName }: Props) {
  const [settings, setSettings] = React.useState<StatusPageSettings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [enabled, setEnabled] = React.useState(false);
  const [displayTitle, setDisplayTitle] = React.useState(applicationName);
  const [allowIndexing, setAllowIndexing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [rotating, setRotating] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  React.useEffect(() => {
    getStatusPageSettings(applicationId).then((res) => {
      if (res.data) {
        setSettings(res.data);
        setEnabled(res.data.enabled);
        setDisplayTitle(res.data.display_title);
        setAllowIndexing(res.data.allow_indexing);
      }
      setLoading(false);
    });
  }, [applicationId]);

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    const res = await updateStatusPageSettings(applicationId, {
      enabled,
      displayTitle,
      allowIndexing,
    });
    if (res.error) setMsg(res.error);
    else if (res.data) {
      setSettings(res.data);
      setMsg("Status page settings saved.");
    }
    setSaving(false);
  };

  const handleRotate = async () => {
    if (!confirm("Rotate the status page URL? The old link and badge URLs will stop working.")) return;
    setRotating(true);
    const res = await rotateStatusPageSlug(applicationId);
    if (res.data) {
      setSettings(res.data);
      setMsg("Slug rotated.");
    }
    setRotating(false);
  };

  const copyText = (label: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return <div className="p-4 text-xs text-muted-foreground">Loading status page settings...</div>;
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const statusUrl = settings ? `${baseUrl}/status/${settings.slug}` : "";
  const badgeUrl = settings ? `${baseUrl}/badge/${settings.slug}.svg` : "";
  const markdownSnippet = settings ? `[![Status](${badgeUrl})](${statusUrl})` : "";
  const htmlSnippet = settings ? `<a href="${statusUrl}"><img src="${badgeUrl}" alt="Service Status" /></a>` : "";

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            Public Status Page (Opt-In)
          </CardTitle>
          <CardDescription className="text-xs">
            Shows only overall status, 24h/7d/30d uptime, daily bars, and past downtime incidents. Never exposes security findings, errors, or internal URLs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-border"
            />
            <span>Enable public status page</span>
          </label>

          <div>
            <label className="block text-xs font-medium mb-1">Display Title</label>
            <Input
              value={displayTitle}
              onChange={(e) => setDisplayTitle(e.target.value)}
              maxLength={80}
              placeholder={applicationName}
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={allowIndexing}
              onChange={(e) => setAllowIndexing(e.target.checked)}
              className="rounded border-border"
            />
            <span>Allow search engines to index this page (off / noindex by default)</span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
            {settings && (
              <Button size="sm" variant="outline" onClick={handleRotate} disabled={rotating} className="gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${rotating ? "animate-spin" : ""}`} />
                Rotate Slug
              </Button>
            )}
          </div>

          {msg && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> {msg}
            </p>
          )}
        </CardContent>
      </Card>

      {settings && settings.enabled && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Shareable Link &amp; Badge</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-3 py-2 font-mono truncate">{statusUrl}</code>
              <a href={statusUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1">
                  Open <ExternalLink className="h-3 w-3" />
                </Button>
              </a>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">Markdown Badge</span>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => copyText("md", markdownSnippet)}>
                  <Copy className="h-3 w-3 mr-1" /> {copied === "md" ? "Copied" : "Copy"}
                </Button>
              </div>
              <pre className="rounded bg-muted/50 p-2 font-mono text-[10px] overflow-x-auto">{markdownSnippet}</pre>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">HTML Badge</span>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => copyText("html", htmlSnippet)}>
                  <Copy className="h-3 w-3 mr-1" /> {copied === "html" ? "Copied" : "Copy"}
                </Button>
              </div>
              <pre className="rounded bg-muted/50 p-2 font-mono text-[10px] overflow-x-auto">{htmlSnippet}</pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
