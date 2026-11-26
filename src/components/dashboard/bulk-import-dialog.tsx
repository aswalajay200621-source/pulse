"use client";

import * as React from "react";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  bulkImportApplications,
  type BulkImportLineResult,
} from "@/app/actions/bulk-import";
import { parseBulkImportText } from "@/lib/bulk-import-parser";
import { CheckCircle2, XCircle, Upload, AlertTriangle } from "lucide-react";

interface BulkImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkImportDialog({ open, onClose, onSuccess }: BulkImportDialogProps) {
  const [text, setText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<BulkImportLineResult[] | null>(null);
  const [summary, setSummary] = React.useState<{
    added: number;
    skipped: number;
    quotaReached: boolean;
    quotaRemaining: number;
  } | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);

  const reset = () => {
    setText("");
    setResults(null);
    setSummary(null);
    setParseError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024) {
      setParseError("File too large — maximum 10 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setText((ev.target?.result as string) || "");
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setParseError(null);
    setResults(null);
    setSummary(null);

    let rows;
    try {
      rows = parseBulkImportText(text);
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : "Parse error.");
      return;
    }

    if (rows.length === 0) {
      setParseError("No valid URLs found. Enter one URL per line.");
      return;
    }

    setLoading(true);
    const res = await bulkImportApplications(rows);
    setLoading(false);

    if (res.error) {
      setParseError(res.error);
      return;
    }

    if (res.data) {
      setResults(res.data.results);
      setSummary({
        added: res.data.added,
        skipped: res.data.skipped,
        quotaReached: res.data.quotaReached,
        quotaRemaining: res.data.quotaRemaining,
      });
      if (res.data.added > 0) onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogHeader>
          <DialogTitle>Bulk Import Applications</DialogTitle>
          <DialogDescription className="text-xs">
            Paste URLs below or upload a CSV. One URL per line.
            Optionally add a name and health-check path:{" "}
            <code className="font-mono text-[11px]">https://example.com, My App, /health</code>
            <br />
            Max 50 rows · 10 KB. First checks run after import via the monitoring job.
          </DialogDescription>
        </DialogHeader>

        {!results ? (
          <div className="space-y-3">
            <textarea
              className="w-full h-40 rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder={"https://myapp.com\nhttps://api.example.com, API Server, /health\nhttps://staging.example.com, Staging"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={loading}
            />
            <div className="flex items-center gap-2">
              <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Upload className="h-3.5 w-3.5" />
                Upload CSV
                <input type="file" accept=".csv,.txt" className="sr-only" onChange={handleFileChange} />
              </label>
            </div>
            {parseError && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-500 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {parseError}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {summary && (
              <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs space-y-1">
                <div className="font-semibold text-sm">
                  {summary.added} added, {summary.skipped} skipped
                </div>
                {summary.quotaReached && (
                  <div className="text-amber-500 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Quota reached — maximum 3 apps allowed. {summary.skipped} URLs were not imported.
                  </div>
                )}
                {!summary.quotaReached && summary.quotaRemaining > 0 && (
                  <div className="text-muted-foreground">
                    {summary.quotaRemaining} app slot{summary.quotaRemaining !== 1 ? "s" : ""} remaining.
                  </div>
                )}
              </div>
            )}
            <div className="max-h-60 overflow-y-auto space-y-1">
              {results.map((r) => (
                <div
                  key={r.line}
                  className="flex items-start gap-2 rounded px-2 py-1.5 text-xs"
                >
                  {r.status === "added" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 mt-0.5 text-rose-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className="font-mono text-muted-foreground">L{r.line}</span>{" "}
                    <span className={r.status === "added" ? "text-foreground" : "text-muted-foreground"}>
                      {r.name || r.url}
                    </span>
                    {r.reason && (
                      <div className="text-[11px] text-muted-foreground/70">{r.reason}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2 flex-row justify-end">
          {!results ? (
            <>
              <Button variant="outline" size="sm" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleImport} disabled={loading || !text.trim()}>
                {loading ? "Importing…" : "Import"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => { setResults(null); setSummary(null); setParseError(null); }}>
                Import More
              </Button>
              <Button size="sm" onClick={handleClose}>
                Done
              </Button>
            </>
          )}
        </DialogFooter>
    </Dialog>
  );
}
