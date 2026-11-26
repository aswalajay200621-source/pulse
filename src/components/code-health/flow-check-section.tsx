"use client";

import * as React from "react";
import {
  getFlowChecks,
  createFlowCheck,
  replaceFlowCheckPassword,
  deleteFlowCheckCredentials,
  deleteFlowCheck,
  type FlowCheckPublic,
} from "@/app/actions/flow-checks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  XCircle,
  KeyRound,
  Trash2,
  Plus,
  AlertTriangle,
} from "lucide-react";

interface FlowCheckSectionProps {
  applicationId: string;
  domainVerified: boolean;
  onChanged?: () => void;
}

export function FlowCheckSection({
  applicationId,
  domainVerified,
  onChanged,
}: FlowCheckSectionProps) {
  const [checks, setChecks] = React.useState<FlowCheckPublic[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Form fields
  const [name, setName] = React.useState("Login Check");
  const [loginUrl, setLoginUrl] = React.useState("");
  const [contentType, setContentType] = React.useState<"json" | "form">("json");
  const [emailField, setEmailField] = React.useState("email");
  const [passwordField, setPasswordField] = React.useState("password");
  const [testEmail, setTestEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [expectedStatus, setExpectedStatus] = React.useState("200");
  const [expectedText, setExpectedText] = React.useState("");
  const [confirmThrowaway, setConfirmThrowaway] = React.useState(false);
  const [confirmAuthorize, setConfirmAuthorize] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await getFlowChecks(applicationId);
    if (res.data) setChecks(res.data);
    setLoading(false);
  }, [applicationId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await createFlowCheck({
      applicationId,
      name,
      loginUrl,
      contentType,
      emailField,
      passwordField,
      testEmail,
      password,
      expectedStatus: Number(expectedStatus) || 200,
      expectedText: expectedText || undefined,
      confirmThrowaway,
      confirmAuthorize,
    });
    setSubmitting(false);

    if (!res.success) {
      setError(res.error || "Failed to create flow check.");
      return;
    }

    setPassword("");
    setShowForm(false);
    await load();
    onChanged?.();
  };

  const handleReplacePassword = async (id: string) => {
    const newPwd = window.prompt("Enter new throwaway test account password:");
    if (!newPwd) return;
    await replaceFlowCheckPassword(id, newPwd);
    await load();
    onChanged?.();
  };

  const handleDeleteCredentials = async (id: string) => {
    await deleteFlowCheckCredentials(id);
    await load();
    onChanged?.();
  };

  const handleDelete = async (id: string) => {
    await deleteFlowCheck(id);
    await load();
    onChanged?.();
  };

  if (!domainVerified) {
    return (
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Verify your domain (Level 2) first before setting up a login flow check.
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2">
      {!loading && checks.length > 0 && (
        <div className="space-y-2.5">
          {checks.map((c) => (
            <div
              key={c.id}
              className="rounded-md border border-border/70 bg-muted/20 p-3 space-y-2 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-foreground">{c.name}</span>{" "}
                  <span className="font-mono text-[11px] text-muted-foreground">
                    ({c.login_url})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px] gap-1"
                    onClick={() => handleReplacePassword(c.id)}
                  >
                    <KeyRound className="h-3 w-3" />
                    Replace password
                  </Button>
                  {c.has_password && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => handleDeleteCredentials(c.id)}
                    >
                      Delete credentials
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px] text-rose-500"
                    onClick={() => handleDelete(c.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground font-mono">
                Account: {c.test_email} · Password: {c.masked_password} · Expected
                HTTP {c.expected_status}
              </div>

              {c.recent_results.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-border/50">
                  <div className="text-[11px] font-medium text-muted-foreground">
                    Recent results:
                  </div>
                  {c.recent_results.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between text-[11px] font-mono"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {r.ok ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-rose-500" />
                        )}
                        HTTP {r.status_code ?? "ERR"} · {r.duration_ms}ms
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(r.checked_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!showForm ? (
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setShowForm(true)}
          disabled={checks.length >= 2}
        >
          <Plus className="h-3.5 w-3.5" />
          {checks.length >= 2 ? "Max 2 flow checks reached" : "Add login flow check"}
        </Button>
      ) : (
        <form
          onSubmit={handleCreate}
          className="rounded-md border border-border/70 p-3 space-y-3 text-xs"
        >
          {error && (
            <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-red-500">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-medium mb-1">Check name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Login POST URL</label>
              <Input
                value={loginUrl}
                onChange={(e) => setLoginUrl(e.target.value)}
                placeholder="https://yourapp.com/api/login"
                required
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Content type</label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value as "json" | "form")}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="json">JSON (application/json)</option>
                <option value="form">Form (application/x-www-form-urlencoded)</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Expected HTTP status</label>
              <Input
                type="number"
                value={expectedStatus}
                onChange={(e) => setExpectedStatus(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Email field name</label>
              <Input
                value={emailField}
                onChange={(e) => setEmailField(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Password field name</label>
              <Input
                value={passwordField}
                onChange={(e) => setPasswordField(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Throwaway test email</label>
              <Input
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="throwaway-test@example.com"
                required
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Throwaway test password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium mb-1">
              Optional: response must contain (case-sensitive, max 100 chars)
            </label>
            <Input
              value={expectedText}
              onChange={(e) => setExpectedText(e.target.value)}
              maxLength={100}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1.5 pt-1">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmThrowaway}
                onChange={(e) => setConfirmThrowaway(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                This is a throwaway test account with no real data and no admin rights
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmAuthorize}
                onChange={(e) => setConfirmAuthorize(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I authorize Pulse to send this login request to my app every 30 minutes
              </span>
            </label>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" size="sm" disabled={submitting} className="h-8 text-xs">
              {submitting ? "Saving..." : "Save login check"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowForm(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
