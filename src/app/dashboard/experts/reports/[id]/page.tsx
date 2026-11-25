"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  getReportDetail,
  triageTestReport,
  confirmRewardReceived,
  retestFixedReport,
  postReportMessage,
  type ReportStatus,
  type SeverityLevel,
} from "@/app/actions/experts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, RefreshCw } from "lucide-react";

export default function ReportDetailPage() {
  const params = useParams();
  const reportId = (params?.id as string) || "";
  const [data, setData] = React.useState<Awaited<ReturnType<typeof getReportDetail>> | null>(null);
  const [msg, setMsg] = React.useState("");
  const [triageStatus, setTriageStatus] = React.useState<ReportStatus>("valid");
  const [sevFinal, setSevFinal] = React.useState<SeverityLevel>("medium");
  const [reward, setReward] = React.useState(0);
  const [dupOf, setDupOf] = React.useState("");
  const [payRef, setPayRef] = React.useState("");
  const [ownerNote, setOwnerNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await getReportDetail(reportId);
    setData(res);
    if (res.report) {
      setTriageStatus(res.report.status);
      setSevFinal(res.report.severity_final || res.report.severity_claimed);
      setReward(res.report.reward_amount || 0);
      setOwnerNote(res.report.owner_note || "");
      setPayRef(res.report.payment_reference || "");
    }
  }, [reportId]);

  React.useEffect(() => { if (reportId) load(); }, [reportId, load]);

  if (!data) return <div className="text-xs text-muted-foreground">Loading report...</div>;
  if (data.error || !data.report) return <div className="text-xs text-red-500">{data.error || "Not found"}</div>;

  const r = data.report;

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/dashboard/experts" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Experts
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">{r.title}</CardTitle>
          <div className="text-xs font-mono text-muted-foreground uppercase">
            Status: {r.status} · Claimed: {r.severity_claimed} · Final: {r.severity_final || "Pending"} · Reward: ₹{r.reward_amount}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div><strong>Affected URL:</strong> <code>{r.affected_url}</code></div>
          <div><strong>Steps to Reproduce:</strong><pre className="mt-1 whitespace-pre-wrap rounded bg-muted/30 p-2">{r.steps_to_reproduce}</pre></div>
          <div><strong>Impact:</strong><p className="mt-1 text-muted-foreground">{r.impact}</p></div>
          {r.retest_status && <div className="rounded bg-muted/30 p-2 font-mono">{r.retest_status}</div>}
          {r.status === "fixed" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={async () => { setBusy(true); await retestFixedReport(r.id); await load(); setBusy(false); }} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} /> Retest Fix
            </Button>
          )}
          {data.isReporter && r.status === "paid" && !r.reward_confirmed_at && (
            <Button size="sm" onClick={async () => { await confirmRewardReceived(r.id); await load(); }}>
              Confirm Reward Received
            </Button>
          )}
        </CardContent>
      </Card>

      {data.isOwner && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Owner Triage Panel</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select value={triageStatus} onChange={(e) => setTriageStatus(e.target.value as ReportStatus)} className="h-9 rounded-md border border-border bg-background px-3">
                <option value="triaged">Triaged</option>
                <option value="valid">Valid</option>
                <option value="duplicate">Duplicate</option>
                <option value="invalid">Invalid</option>
                <option value="fixed">Fixed</option>
                <option value="paid">Paid</option>
              </select>
              <select value={sevFinal} onChange={(e) => setSevFinal(e.target.value as SeverityLevel)} className="h-9 rounded-md border border-border bg-background px-3">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              <Input type="number" placeholder="Reward (INR)" value={reward} onChange={(e) => setReward(Number(e.target.value))} />
            </div>
            {triageStatus === "duplicate" && (
              <Input placeholder="Duplicate of Report ID" value={dupOf} onChange={(e) => setDupOf(e.target.value)} />
            )}
            {triageStatus === "paid" && (
              <Input placeholder="Optional payment reference" value={payRef} onChange={(e) => setPayRef(e.target.value)} />
            )}
            <Input placeholder="Owner note" value={ownerNote} onChange={(e) => setOwnerNote(e.target.value)} />
            <Button size="sm" onClick={async () => {
              await triageTestReport(r.id, {
                status: triageStatus,
                severity_final: sevFinal,
                reward_amount: reward,
                duplicate_of: dupOf || null,
                owner_note: ownerNote,
                payment_reference: payRef,
              });
              await load();
            }}>Save Triage</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold">Private Message Thread</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-xs">
          {(data.messages || []).map((m) => (
            <div key={m.id} className="rounded border border-border/60 p-2.5">
              <div className="text-[11px] text-muted-foreground font-mono">{new Date(m.created_at).toLocaleString()}</div>
              <div className="mt-1">{m.body}</div>
            </div>
          ))}
          <form className="flex gap-2" onSubmit={async (e) => {
            e.preventDefault();
            if (!msg.trim()) return;
            await postReportMessage(r.id, msg);
            setMsg("");
            await load();
          }}>
            <Input placeholder="Write a message..." value={msg} onChange={(e) => setMsg(e.target.value)} />
            <Button type="submit" size="sm">Send</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
