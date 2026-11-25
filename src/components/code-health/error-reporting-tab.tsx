"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getErrorGroups,
  getErrorEvents,
  updateErrorGroupStatus,
  listIngestKeys,
  createIngestKey,
  revokeIngestKey,
  type ErrorGroupRecord,
  type ErrorEventRecord,
  type IngestKeyRecord,
} from "@/app/actions/errors";
import { AlertTriangle, Bug, CheckCircle2, ChevronDown, ChevronRight, Copy, Eye, EyeOff, KeyRound, Plus, RefreshCw, XCircle } from "lucide-react";

interface Props {
  applicationId: string;
  applicationUrl: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-500/10 text-red-600 dark:text-red-400",
  resolved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  ignored: "bg-muted text-muted-foreground",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function ErrorReportingTab({ applicationId, applicationUrl }: Props) {
  const [groups, setGroups] = React.useState<ErrorGroupRecord[]>([]);
  const [keys, setKeys] = React.useState<IngestKeyRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedGroup, setSelectedGroup] = React.useState<ErrorGroupRecord | null>(null);
  const [events, setEvents] = React.useState<ErrorEventRecord[]>([]);
  const [eventsLoading, setEventsLoading] = React.useState(false);
  const [newKeyData, setNewKeyData] = React.useState<{ rawKey: string; keyPrefix: string } | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [showSnippets, setShowSnippets] = React.useState(false);
  const [copiedKey, setCopiedKey] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState<"errors" | "setup">("errors");
  const [testKey, setTestKey] = React.useState("");
  const [testStatus, setTestStatus] = React.useState<"idle" | "sending" | "received" | "error">("idle");
  const [testMessage, setTestMessage] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    const [groupsRes, keysRes] = await Promise.all([
      getErrorGroups(applicationId),
      listIngestKeys(applicationId),
    ]);
    if (groupsRes.success) setGroups(groupsRes.data || []);
    if (keysRes.success) setKeys(keysRes.data || []);
    setLoading(false);
  }, [applicationId]);

  React.useEffect(() => { loadData(); }, [loadData]);

  const handleSelectGroup = async (group: ErrorGroupRecord) => {
    setSelectedGroup(group);
    setEventsLoading(true);
    const res = await getErrorEvents(group.id);
    if (res.success) setEvents(res.data || []);
    setEventsLoading(false);
  };

  const handleUpdateStatus = async (groupId: string, status: "open" | "resolved" | "ignored") => {
    await updateErrorGroupStatus(groupId, status);
    setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, status } : g));
    if (selectedGroup?.id === groupId) setSelectedGroup((g) => g ? { ...g, status } : g);
  };

  const handleCreateKey = async () => {
    setCreating(true);
    const res = await createIngestKey({ applicationId });
    if (res.success && res.data) {
      setNewKeyData({ rawKey: res.data.rawKey, keyPrefix: res.data.record.key_prefix });
      setTestKey(res.data.rawKey);
      setKeys((prev) => [res.data!.record, ...prev]);
    }
    setCreating(false);
  };

  const handleSendTestError = async () => {
    const keyToUse = (testKey || newKeyData?.rawKey || "").trim();
    if (!keyToUse) {
      setTestStatus("error");
      setTestMessage("Paste your full ingest key first (shown once when created).");
      return;
    }
    setTestStatus("sending");
    setTestMessage(null);
    try {
      const res = await fetch("/api/ingest/error", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-pulse-key": keyToUse,
        },
        body: JSON.stringify({
          name: "PulseTestError",
          message: "[TEST] Pulse test error — safe to resolve",
          stack: "Error: [TEST] Pulse test error\n    at sendTestError (pulse-dashboard:1:1)",
          route: "/pulse-test",
          isTest: true,
        }),
      });
      if (res.status === 202) {
        setTestStatus("received");
        setTestMessage("Received! Test error arrived (no alert email sent).");
        await loadData();
      } else if (res.status === 401) {
        setTestStatus("error");
        setTestMessage("Wrong or revoked ingest key (401).");
      } else if (res.status === 403) {
        setTestStatus("error");
        setTestMessage("Blocked origin (403) — check allowed origins on this key.");
      } else if (res.status === 429) {
        setTestStatus("error");
        setTestMessage("Rate limited (429) — too many events, try again shortly.");
      } else {
        setTestStatus("error");
        setTestMessage(`Failed with HTTP ${res.status}.`);
      }
    } catch {
      setTestStatus("error");
      setTestMessage("Network error while sending test event.");
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm("Revoke this key? Apps using it will stop sending error reports.")) return;
    await revokeIngestKey(keyId);
    setKeys((prev) => prev.filter((k) => k.id !== keyId));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const browserSnippet = (key: string) => `<!-- Paste in your <head> — no dependencies -->
<script>
(function() {
  var INGEST_URL = '${process.env.NEXT_PUBLIC_APP_URL || ""}/api/ingest/error';
  var KEY = '${key}';
  function send(payload) {
    try {
      fetch(INGEST_URL, {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', 'x-pulse-key': KEY },
        body: JSON.stringify(payload)
      });
    } catch(_) {}
  }
  window.onerror = function(msg, src, line, col, err) {
    send({ name: err ? err.name : 'Error', message: String(msg),
      stack: err ? (err.stack || '') : '', route: location.pathname });
  };
  window.onunhandledrejection = function(e) {
    var err = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
    send({ name: err.name, message: err.message, stack: err.stack || '',
      route: location.pathname });
  };
})();
</script>`;

  const nodeSnippet = (key: string) => `// Add to your Next.js instrumentation.ts or Express error handler
import { createServer } from 'http';

async function reportError(err: Error, route?: string) {
  try {
    await fetch(\`\${process.env.NEXT_PUBLIC_APP_URL}/api/ingest/error\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-pulse-key': '${key}' },
      body: JSON.stringify({
        name: err.name, message: err.message,
        stack: err.stack || '', route: route || '/server'
      })
    });
  } catch (_) {}
}

// Next.js App Router — in src/instrumentation.ts:
// export async function register() { /* ... */ }
// Use: process.on('uncaughtException', e => reportError(e));
// Use: process.on('unhandledRejection', e => reportError(e instanceof Error ? e : new Error(String(e))));`;

  const displayKey = keys[0];
  const displayRawKey = newKeyData?.rawKey || "";

  return (
    <div className="space-y-4">
      {/* Section toggle */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-2">
        <button
          onClick={() => setActiveSection("errors")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeSection === "errors" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Error Groups
          {groups.filter((g) => g.status === "open").length > 0 && (
            <span className="ml-1.5 rounded-full bg-red-500 text-white text-[10px] px-1.5 py-0.5">
              {groups.filter((g) => g.status === "open").length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveSection("setup")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeSection === "setup" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Setup &amp; Keys
        </button>
      </div>

      {activeSection === "errors" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Error groups list */}
          <Card className="border-border/60">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Bug className="h-4 w-4 text-muted-foreground" />
                  Error Groups
                </CardTitle>
                <CardDescription className="text-xs">Grouped by fingerprint, deduplicated</CardDescription>
              </div>
              <Button size="sm" variant="ghost" onClick={loadData} className="h-7 w-7 p-0">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-xs text-muted-foreground text-center py-6">Loading...</div>
              ) : groups.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                  <p className="text-xs text-muted-foreground">No errors reported yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">Set up the snippet to start tracking errors.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {groups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => handleSelectGroup(group)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors hover:bg-muted/40 ${selectedGroup?.id === group.id ? "border-primary/50 bg-muted/40" : "border-border/60"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-medium text-foreground line-clamp-2 flex-1">{group.title}</span>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold border ${SEVERITY_COLORS[group.severity] || ""}`}>
                          {group.severity}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[group.status] || ""}`}>
                          {group.status}
                        </span>
                        <span>{group.count_24h} in 24h</span>
                        <span>·</span>
                        <span>{timeAgo(group.last_seen)}</span>
                        {group.last_route && <span className="font-mono truncate max-w-[100px]">{group.last_route}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Event detail */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                {selectedGroup ? selectedGroup.title.slice(0, 60) : "Select an error group"}
              </CardTitle>
              {selectedGroup && (
                <CardDescription className="text-xs font-mono">{selectedGroup.fingerprint.slice(0, 16)}…</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {!selectedGroup ? (
                <p className="text-xs text-muted-foreground text-center py-8">Click an error group to see details.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => handleUpdateStatus(selectedGroup.id, "resolved")}
                      disabled={selectedGroup.status === "resolved"}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />Resolve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => handleUpdateStatus(selectedGroup.id, "ignored")}
                      disabled={selectedGroup.status === "ignored"}
                    >
                      <EyeOff className="h-3 w-3 mr-1" />Ignore
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => handleUpdateStatus(selectedGroup.id, "open")}
                      disabled={selectedGroup.status === "open"}
                    >
                      <Eye className="h-3 w-3 mr-1" />Reopen
                    </Button>
                  </div>

                  {eventsLoading ? (
                    <div className="text-xs text-muted-foreground text-center py-4">Loading events...</div>
                  ) : events.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No recent events.</p>
                  ) : (
                    <div className="space-y-2">
                      {events.slice(0, 5).map((ev) => (
                        <div key={ev.id} className="rounded-lg border border-border/60 bg-muted/20 p-2.5 space-y-1">
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span>{timeAgo(ev.occurred_at)}</span>
                            {ev.route && <span className="font-mono truncate max-w-[120px]">{ev.route}</span>}
                            {ev.user_agent_family && <span>{ev.user_agent_family}</span>}
                            {ev.release && <span className="font-mono">v{ev.release}</span>}
                          </div>
                          {ev.stack_excerpt && (
                            <pre className="text-[10px] font-mono bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-28">
                              {ev.stack_excerpt}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          {/* New key revealed */}
          {newKeyData && (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Your ingest key — save it now, it will not be shown again
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">{newKeyData.rawKey}</code>
                  <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => handleCopy(newKeyData.rawKey)}>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    {copiedKey ? "Copied!" : "Copy"}
                  </Button>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => setNewKeyData(null)}>
                  I have saved it — dismiss
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Key management */}
          <Card className="border-border/60">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  Ingest Keys
                </CardTitle>
                <CardDescription className="text-xs">
                  Keys are safe to use in browser code — they can only send reports, not read data.
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={handleCreateKey} disabled={creating}>
                <Plus className="h-3.5 w-3.5" />
                {creating ? "Creating..." : "New Key"}
              </Button>
            </CardHeader>
            <CardContent>
              {keys.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No keys yet. Create one to start collecting errors.</p>
              ) : (
                <div className="space-y-2">
                  {keys.map((key) => (
                    <div key={key.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3">
                      <div className="space-y-0.5">
                        <code className="text-xs font-mono text-foreground">{key.key_prefix}••••••••••</code>
                        <p className="text-[11px] text-muted-foreground">
                          Created {new Date(key.created_at).toLocaleDateString()}
                          {key.allowed_origins.length > 0 && ` · ${key.allowed_origins.length} origin(s)`}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleRevokeKey(key.id)}>
                        <XCircle className="h-3.5 w-3.5 mr-1" />Revoke
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Send Test Error */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Send Test Error</CardTitle>
              <CardDescription className="text-xs">
                Verify your ingest key works end-to-end. Test events are marked as tests and never trigger alert emails.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="password"
                  value={testKey}
                  onChange={(e) => setTestKey(e.target.value)}
                  placeholder="Paste full ingest key (pk_...)"
                  className="flex-1 rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSendTestError}
                  disabled={testStatus === "sending"}
                  className="h-8 text-xs shrink-0"
                >
                  {testStatus === "sending" ? "Sending..." : "Send test error"}
                </Button>
              </div>
              {testMessage && (
                <p
                  className={`text-xs ${
                    testStatus === "received"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-500"
                  }`}
                >
                  {testMessage}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Snippets */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <button
                className="flex items-center justify-between w-full text-left"
                onClick={() => setShowSnippets((s) => !s)}
              >
                <CardTitle className="text-sm font-semibold">Integration Snippets</CardTitle>
                {showSnippets ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>
            </CardHeader>
            {showSnippets && (
              <CardContent className="space-y-4">
                {displayKey ? (
                  <>
                    <div className="rounded-lg border border-border/60 bg-muted/10 p-3 space-y-2">
                      <p className="text-xs font-semibold text-foreground">🌐 Browser snippet</p>
                      <p className="text-[11px] text-muted-foreground">Paste in your HTML &lt;head&gt;. No dependencies, under 40 lines.</p>
                      <pre className="text-[10px] font-mono bg-muted/50 rounded p-3 overflow-x-auto whitespace-pre-wrap">
                        {browserSnippet(newKeyData?.rawKey || displayKey.key_prefix + "••••")}
                      </pre>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/10 p-3 space-y-2">
                      <p className="text-xs font-semibold text-foreground">🖥 Node.js / Next.js snippet</p>
                      <pre className="text-[10px] font-mono bg-muted/50 rounded p-3 overflow-x-auto whitespace-pre-wrap">
                        {nodeSnippet(newKeyData?.rawKey || displayKey.key_prefix + "••••")}
                      </pre>
                    </div>
                    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-1">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">🔒 Security notes</p>
                      <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc list-inside">
                        <li>The ingest key is safe to expose in browser code — it can only <em>send</em> reports, never read them.</li>
                        <li>Restrict allowed origins in key settings to block third-party abuse.</li>
                        <li>Never put real secrets or PII in error messages — Pulse scrubs common patterns but defence-in-depth matters.</li>
                        <li>To rotate, create a new key, deploy it, then revoke the old one.</li>
                      </ul>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Create a key above to see the integration snippets.</p>
                )}
              </CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
