"use client";

import * as React from "react";
import {
  getDeepScanState,
  initDomainVerification,
  checkDomainVerification,
  recordScanConsent,
  toggleWeeklyDeepScan,
  triggerDeepScan,
  type DomainVerificationRecord,
  type DeepScanAuditRecord,
} from "@/app/actions/deep-scan";
import type { SecurityFindingRecord } from "@/app/actions/security";
import { explainFinding } from "@/lib/explanations/engine";
import { FindingExplanationCard } from "@/components/shared/finding-explanation-card";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  Printer,
  Lock,
} from "lucide-react";

interface DeepScanTabProps {
  applicationId: string;
  applicationName: string;
  applicationUrl: string;
}

export function DeepScanTab({
  applicationId,
  applicationName,
  applicationUrl,
}: DeepScanTabProps) {
  const [verification, setVerification] = React.useState<DomainVerificationRecord | null>(null);
  const [hasConsent, setHasConsent] = React.useState(false);
  const [weeklyEnabled, setWeeklyEnabled] = React.useState(false);
  const [scans, setScans] = React.useState<DeepScanAuditRecord[]>([]);
  const [findings, setFindings] = React.useState<SecurityFindingRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await getDeepScanState(applicationId);
    if (res.error) setError(res.error);
    else {
      setVerification(res.verification ?? null);
      setHasConsent(!!res.hasConsent);
      setWeeklyEnabled(!!res.weeklyEnabled);
      setScans(res.scans ?? []);
      setFindings(res.findings ?? []);
    }
    setLoading(false);
  }, [applicationId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const isVerified =
    !!verification?.verified_at &&
    !!verification?.expires_at &&
    new Date(verification.expires_at) > new Date();

  const hostname = React.useMemo(() => {
    try {
      return new URL(applicationUrl).hostname;
    } catch {
      return applicationUrl;
    }
  }, [applicationUrl]);

  const handleInitVerify = async () => {
    setBusy(true);
    setError(null);
    const res = await initDomainVerification(applicationId);
    if (res.error) setError(res.error);
    else if (res.verification) setVerification(res.verification);
    setBusy(false);
  };

  const handleCheckVerify = async (method: "well_known" | "dns_txt") => {
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await checkDomainVerification(applicationId, method);
    if (!res.verified) setError(res.error || "Verification failed.");
    else {
      setMessage("Domain ownership verified for 30 days.");
      await load();
    }
    setBusy(false);
  };

  const handleConsent = async () => {
    setBusy(true);
    const res = await recordScanConsent(applicationId);
    if (res.error) setError(res.error);
    else setHasConsent(true);
    setBusy(false);
  };

  const handleRunScan = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await triggerDeepScan(applicationId);
    if (res.error) setError(res.error);
    else {
      setMessage("Deep scan completed.");
      await load();
    }
    setBusy(false);
  };

  const handleToggleWeekly = async () => {
    const next = !weeklyEnabled;
    setWeeklyEnabled(next);
    await toggleWeeklyDeepScan(applicationId, next);
  };

  if (loading) {
    return <div className="text-xs text-muted-foreground py-4">Loading deep scan status...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground flex items-center justify-between gap-2 print:hidden">
        <span>
          <strong className="text-foreground">Note:</strong> Automated checks find common mistakes. They do not replace a human security test.
        </span>
        {findings.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => window.print()} className="h-7 gap-1.5 text-xs shrink-0">
            <Printer className="h-3.5 w-3.5" /> Export Printable Report
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500 print:hidden">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-500 print:hidden">
          {message}
        </div>
      )}

      {/* Step 1: Domain Ownership Verification */}
      <Card className="print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4" />
            1. Domain Ownership Verification
          </CardTitle>
          <CardDescription className="text-xs">
            Required before running active checks. Re-verification is required every 30 days.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          {isVerified ? (
            <div className="flex items-center gap-2 text-emerald-500 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Verified ({verification?.method}) until{" "}
              {new Date(verification!.expires_at!).toLocaleDateString()}
            </div>
          ) : !verification ? (
            <Button size="sm" onClick={handleInitVerify} disabled={busy}>
              Generate Verification Token
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border border-border bg-muted/30 p-3 font-mono text-[11px] break-all">
                Token: {verification.token}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-md border border-border/60 p-3 space-y-2">
                  <div className="font-semibold">Option A: Well-Known File</div>
                  <p className="text-muted-foreground">
                    Serve the token at <code>/.well-known/pulse-verify.txt</code> on {hostname}.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => handleCheckVerify("well_known")} disabled={busy}>
                    Verify File
                  </Button>
                </div>
                <div className="rounded-md border border-border/60 p-3 space-y-2">
                  <div className="font-semibold">Option B: DNS TXT Record</div>
                  <p className="text-muted-foreground">
                    Add a TXT record at <code>_pulse-verify.{hostname}</code> with the token.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => handleCheckVerify("dns_txt")} disabled={busy}>
                    Verify DNS TXT
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Owner Consent */}
      {isVerified && !hasConsent && (
        <Card className="print:hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">2. Owner Consent</CardTitle>
            <CardDescription className="text-xs">
              Confirm you own {applicationName} ({hostname}) and authorize non-destructive checks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <p>
              Pulse will send rate-limited (max 2 req/s, 300 req cap, 2 min limit) GET, HEAD, and OPTIONS
              requests to check for exposed files, directory listings, admin/debug paths, CORS, cookie
              flags, security headers, TLS, version banners, harmless reflection probes, open redirects,
              public JS secrets, and dangling DNS.
            </p>
            <Button size="sm" onClick={handleConsent} disabled={busy}>
              I Consent — Enable Deep Scan
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Run Scan & Weekly Toggle */}
      {isVerified && hasConsent && (
        <Card className="print:hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-semibold">Run Deep Scan</CardTitle>
              <CardDescription className="text-xs">
                Max 2 scans per 24 hours · 1 running scan at a time
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={weeklyEnabled}
                  onChange={handleToggleWeekly}
                  className="rounded border-border"
                />
                Weekly auto-scan
              </label>
              <Button size="sm" onClick={handleRunScan} disabled={busy} className="gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
                {busy ? "Scanning..." : "Run Deep Scan"}
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Findings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-500" />
            Deep Scan Findings ({findings.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {findings.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              No deep scan findings recorded yet.
            </div>
          ) : (
            findings.map((f) => (
              <div key={f.id} className="rounded-lg border border-border/70 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold">{f.title}</span>
                  <span className="text-[11px] font-mono uppercase text-muted-foreground">{f.severity}</span>
                </div>
                <FindingExplanationCard
                  explained={explainFinding({
                    ruleId: f.rule_id,
                    category: f.category,
                    source: f.source,
                    severity: f.severity,
                    title: f.title,
                    description: f.description,
                    affectedResource: f.affected_resource,
                    timestamp: f.created_at,
                  })}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Audit Log / Scan History */}
      <Card className="print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Deep Scan Audit Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {scans.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">No deep scans run yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-y border-border/70 bg-muted/40 text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 px-4">Started</th>
                    <th className="py-2 px-4">Requests</th>
                    <th className="py-2 px-4">Findings</th>
                    <th className="py-2 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {scans.map((s) => (
                    <tr key={s.id}>
                      <td className="py-2.5 px-4">{new Date(s.started_at).toLocaleString()}</td>
                      <td className="py-2.5 px-4">{s.request_count}</td>
                      <td className="py-2.5 px-4">{s.findings_count}</td>
                      <td className="py-2.5 px-4 text-right uppercase">{s.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
