"use client";

import * as React from "react";
import Link from "next/link";
import {
  getExpertsDashboardData,
  createTestRequest,
  updateTestRequestStatus,
  inviteTester,
  respondToInvite,
  submitTestReport,
  type SeverityLevel,
} from "@/app/actions/experts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Users, Plus, Pause, Play, FileText, BookOpen, UserCheck } from "lucide-react";

const DEFAULT_RULES = `1. Test only in-scope URLs using test accounts.
2. No denial of service (DoS) or automated flooding.
3. No accessing or modifying other real users' data.
4. No social engineering or phishing.
5. No public disclosure without the owner's written permission.
6. Stop and report at once if you reach sensitive data.`;

const FOCUS_OPTIONS = [
  "login and accounts",
  "payments",
  "file upload",
  "user data access",
  "admin features",
  "API",
];

export default function ExpertsDashboardPage() {
  const [tab, setTab] = React.useState<"owner" | "tester">("owner");
  const [data, setData] = React.useState<Awaited<ReturnType<typeof getExpertsDashboardData>> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  // Create request form
  const [showCreate, setShowCreate] = React.useState(false);
  const [appId, setAppId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [scopeUrls, setScopeUrls] = React.useState("");
  const [outOfScope, setOutOfScope] = React.useState("Third-party services, DoS, social engineering");
  const [focusAreas, setFocusAreas] = React.useState<string[]>(["login and accounts"]);
  const [accountsNote, setAccountsNote] = React.useState("Sign up with a @pulse-test email address.");
  const [rulesText, setRulesText] = React.useState(DEFAULT_RULES);
  const [rewardLow, setRewardLow] = React.useState(500);
  const [rewardMed, setRewardMed] = React.useState(1500);
  const [rewardHigh, setRewardHigh] = React.useState(5000);
  const [rewardCrit, setRewardCrit] = React.useState(10000);
  const [safeHarbor, setSafeHarbor] = React.useState(false);

  // Submit report modal state
  const [reportReqId, setReportReqId] = React.useState<string | null>(null);
  const [repTitle, setRepTitle] = React.useState("");
  const [repSev, setRepSev] = React.useState<SeverityLevel>("medium");
  const [repUrl, setRepUrl] = React.useState("");
  const [repSteps, setRepSteps] = React.useState("");
  const [repImpact, setRepImpact] = React.useState("");
  const [repProof, setRepProof] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await getExpertsDashboardData();
    if (res.error) setError(res.error);
    else {
      setData(res);
      if (res.applications?.length && !appId) setAppId(res.applications[0].id);
    }
    setLoading(false);
  }, [appId]);

  React.useEffect(() => { load(); }, [load]);

  const handleCreateRequest = async (e: React.FormEvent, openImmediately: boolean) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const res = await createTestRequest({
      application_id: appId,
      title,
      scope_urls: scopeUrls.split(",").map((s) => s.trim()).filter(Boolean),
      out_of_scope: outOfScope,
      focus_areas: focusAreas,
      test_accounts_note: accountsNote,
      rules_text: rulesText,
      reward_low: rewardLow,
      reward_medium: rewardMed,
      reward_high: rewardHigh,
      reward_critical: rewardCrit,
      safe_harbor_accepted: safeHarbor,
      openImmediately,
    });
    if (res.error) setError(res.error);
    else {
      setShowCreate(false);
      setTitle("");
      setMessage("Test request saved.");
      await load();
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReqId) return;
    setError(null);
    const res = await submitTestReport({
      request_id: reportReqId,
      title: repTitle,
      severity_claimed: repSev,
      affected_url: repUrl,
      steps_to_reproduce: repSteps,
      impact: repImpact,
      proof_text: repProof,
    });
    if (res.error) setError(res.error);
    else {
      setReportReqId(null);
      setRepTitle("");
      setMessage("Report submitted.");
      await load();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Human Security Testing (Experts)
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Coordinate manual security testing for business logic, access control, and payment flows.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/experts/profile">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <UserCheck className="h-3.5 w-3.5" /> Tester Profile
            </Button>
          </Link>
          <Link href="/dashboard/experts/severity-guide">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <BookOpen className="h-3.5 w-3.5" /> Severity Guide
            </Button>
          </Link>
          <Link href="/terms/testing">
            <Button variant="ghost" size="sm" className="h-8 text-xs">
              Safe Harbor Terms
            </Button>
          </Link>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">{error}</div>}
      {message && <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-500">{message}</div>}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-2">
        <button
          onClick={() => setTab("owner")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium ${tab === "owner" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          My test requests
        </button>
        <button
          onClick={() => setTab("tester")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium ${tab === "tester" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          My invitations and reports
        </button>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground">Loading...</div>
      ) : tab === "owner" ? (
        <div className="space-y-6">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowCreate(!showCreate)} className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Create Test Request
            </Button>
          </div>

          {showCreate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">New Human Security Test Request</CardTitle>
                <CardDescription className="text-xs">
                  Domain ownership must be verified before opening. Rewards are tracked in INR and paid outside Pulse.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-medium mb-1">Application</label>
                      <select value={appId} onChange={(e) => setAppId(e.target.value)} className="w-full h-9 rounded-md border border-border bg-background px-3">
                        {(data?.applications || []).map((a) => (
                          <option key={a.id} value={a.id}>{a.name} ({a.url})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Request Title *</label>
                      <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q4 Checkout & Auth Review" />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium mb-1">In-Scope URLs (comma-separated)</label>
                    <Input value={scopeUrls} onChange={(e) => setScopeUrls(e.target.value)} placeholder="https://app.example.com, https://api.example.com" />
                  </div>

                  <div>
                    <label className="block font-medium mb-1">Focus Areas</label>
                    <div className="flex flex-wrap gap-2">
                      {FOCUS_OPTIONS.map((area) => (
                        <label key={area} className="inline-flex items-center gap-1.5 border border-border rounded px-2 py-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={focusAreas.includes(area)}
                            onChange={(e) =>
                              setFocusAreas(e.target.checked ? [...focusAreas, area] : focusAreas.filter((f) => f !== area))
                            }
                          />
                          {area}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div><label className="block mb-1">Low (INR)</label><Input type="number" value={rewardLow} onChange={(e) => setRewardLow(Number(e.target.value))} /></div>
                    <div><label className="block mb-1">Medium (INR)</label><Input type="number" value={rewardMed} onChange={(e) => setRewardMed(Number(e.target.value))} /></div>
                    <div><label className="block mb-1">High (INR)</label><Input type="number" value={rewardHigh} onChange={(e) => setRewardHigh(Number(e.target.value))} /></div>
                    <div><label className="block mb-1">Critical (INR)</label><Input type="number" value={rewardCrit} onChange={(e) => setRewardCrit(Number(e.target.value))} /></div>
                  </div>

                  <div>
                    <label className="block font-medium mb-1">Test Accounts Instructions (never real credentials)</label>
                    <Input value={accountsNote} onChange={(e) => setAccountsNote(e.target.value)} />
                  </div>

                  <div>
                    <label className="block font-medium mb-1">Rules & Out of Scope</label>
                    <textarea value={rulesText} onChange={(e) => setRulesText(e.target.value)} rows={4} className="w-full rounded-md border border-border bg-background p-2 text-xs" />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={safeHarbor} onChange={(e) => setSafeHarbor(e.target.checked)} />
                    <span>I accept the <Link href="/terms/testing" className="underline text-primary">Safe Harbor terms</Link> authorizing invited testers.</span>
                  </label>

                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={(e) => handleCreateRequest(e, false)}>Save Draft</Button>
                    <Button type="button" size="sm" onClick={(e) => handleCreateRequest(e, true)}>Open Request</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Owner Requests List */}
          {(data?.myRequests || []).length === 0 ? (
            <Card><CardContent className="p-6 text-center text-xs text-muted-foreground">No test requests created yet.</CardContent></Card>
          ) : (
            (data?.myRequests || []).map((req) => (
              <Card key={req.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-sm font-semibold">{req.title}</CardTitle>
                    <CardDescription className="text-xs font-mono uppercase">Status: {req.status}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {req.status !== "paused" ? (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => updateTestRequestStatus(req.id, "paused").then(load)}>
                        <Pause className="h-3 w-3" /> Pause
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => updateTestRequestStatus(req.id, "in_progress").then(load)}>
                        <Play className="h-3 w-3" /> Resume
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Invite Approved Tester:</span>
                    {(data?.approvedTesters || []).length === 0 ? (
                      <span className="text-muted-foreground">No approved testers available yet.</span>
                    ) : (
                      (data?.approvedTesters || []).map((t) => (
                        <Button key={t.user_id} size="sm" variant="outline" className="h-7 text-xs" onClick={() => inviteTester(req.id, t.user_id).then(() => setMessage(`Invited ${t.display_name}`))}>
                          Invite {t.display_name} ({t.skill_level})
                        </Button>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tester Invitations */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">My Invitations</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-xs">
              {(data?.myInvites || []).length === 0 ? (
                <div className="text-muted-foreground">No invitations received yet.</div>
              ) : (
                (data?.myInvites || []).map((inv) => (
                  <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-border/60 rounded-md p-3">
                    <div>
                      <div className="font-medium">{inv.test_requests?.title || "Test Request"}</div>
                      <div className="text-muted-foreground font-mono text-[11px]">
                        Invite: {inv.status} · Request: {inv.test_requests?.status}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {inv.status === "invited" && (
                        <>
                          <Button size="sm" onClick={() => respondToInvite(inv.id, "accepted").then(load)}>Accept</Button>
                          <Button size="sm" variant="outline" onClick={() => respondToInvite(inv.id, "declined").then(load)}>Decline</Button>
                        </>
                      )}
                      {inv.status === "accepted" && inv.test_requests?.status !== "paused" && (
                        <Button size="sm" onClick={() => setReportReqId(inv.request_id)}>Submit Report</Button>
                      )}
                      {inv.test_requests?.status === "paused" && (
                        <span className="text-amber-500 font-mono">Paused by owner</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {reportReqId && (
            <Card>
              <CardHeader><CardTitle className="text-sm font-semibold">Submit Security Report</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitReport} className="space-y-3 text-xs">
                  <Input required placeholder="Report title" value={repTitle} onChange={(e) => setRepTitle(e.target.value)} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select value={repSev} onChange={(e) => setRepSev(e.target.value as SeverityLevel)} className="h-9 rounded-md border border-border bg-background px-3">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                    <Input required placeholder="Affected URL" value={repUrl} onChange={(e) => setRepUrl(e.target.value)} />
                  </div>
                  <textarea required placeholder="Steps to reproduce (text & links only)" value={repSteps} onChange={(e) => setRepSteps(e.target.value)} rows={4} className="w-full rounded-md border border-border bg-background p-2" />
                  <textarea required placeholder="Impact" value={repImpact} onChange={(e) => setRepImpact(e.target.value)} rows={2} className="w-full rounded-md border border-border bg-background p-2" />
                  <textarea placeholder="Proof / observation (never paste real user data)" value={repProof} onChange={(e) => setRepProof(e.target.value)} rows={2} className="w-full rounded-md border border-border bg-background p-2" />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setReportReqId(null)}>Cancel</Button>
                    <Button type="submit" size="sm">Submit Report</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Reports List */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Submitted & Received Reports</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              {(data?.reports || []).length === 0 ? (
                <div className="flex items-center gap-2 text-muted-foreground"><ShieldCheck className="h-4 w-4" /> No reports yet.</div>
              ) : (
                (data?.reports || []).map((r) => (
                  <Link key={r.id} href={`/dashboard/experts/reports/${r.id}`} className="flex items-center justify-between border border-border/60 rounded-md p-3 hover:bg-muted/30">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{r.title}</span>
                    </div>
                    <span className="font-mono uppercase text-[11px]">{r.status} · {r.severity_final || r.severity_claimed}</span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
