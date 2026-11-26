"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { validateApplicationUrl } from "@/lib/security/url-validator";
import { revalidatePath } from "next/cache";
import { type BulkImportRow, MAX_IMPORT_ROWS } from "@/lib/bulk-import-parser";

const MAX_APPLICATIONS_PER_USER = 3;

export interface BulkImportLineResult {
  line: number;
  url: string;
  name?: string;
  status: "added" | "skipped";
  reason?: string;
}

export interface BulkImportResult {
  results: BulkImportLineResult[];
  added: number;
  skipped: number;
  quotaReached: boolean;
  quotaRemaining: number;
}

export { type BulkImportRow } from "@/lib/bulk-import-parser";

/** Bulk-import URLs after SSRF validation and quota checks. Never fetches URLs. */
export async function bulkImportApplications(
  rows: BulkImportRow[]
): Promise<{ data?: BulkImportResult; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase not configured." };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "No rows provided." };
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    return { error: `Too many rows — maximum is ${MAX_IMPORT_ROWS}.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized." };
  }

  // Current quota usage
  const { count, error: countError } = await supabase
    .from("applications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (countError) {
    return { error: "Failed to check application quota." };
  }

  const currentCount = count ?? 0;
  const remaining = Math.max(0, MAX_APPLICATIONS_PER_USER - currentCount);

  const results: BulkImportLineResult[] = [];
  let added = 0;
  let quotaReached = remaining === 0;

  // Deduplicate URLs seen in this batch
  const seenUrls = new Set<string>();

  for (const row of rows) {
    // Quota exhausted
    if (added >= remaining) {
      quotaReached = true;
      results.push({
        line: row.line,
        url: row.url,
        name: row.name,
        status: "skipped",
        reason: `Quota reached: maximum ${MAX_APPLICATIONS_PER_USER} apps allowed.`,
      });
      continue;
    }

    // SSRF validation (no DNS fetch during import — we validate URL structure
    // and DNS safety here, but the first actual HTTP check happens through
    // the existing monitoring job).
    let normalizedUrl: string;
    try {
      const validation = await validateApplicationUrl(row.url);
      if (!validation.valid || !validation.normalizedUrl) {
        results.push({
          line: row.line,
          url: row.url,
          name: row.name,
          status: "skipped",
          reason: validation.error || "Invalid URL.",
        });
        continue;
      }
      normalizedUrl = validation.normalizedUrl;
    } catch {
      results.push({
        line: row.line,
        url: row.url,
        name: row.name,
        status: "skipped",
        reason: "URL validation error.",
      });
      continue;
    }

    // Deduplicate within this batch
    if (seenUrls.has(normalizedUrl)) {
      results.push({
        line: row.line,
        url: row.url,
        name: row.name,
        status: "skipped",
        reason: "Duplicate URL in this import.",
      });
      continue;
    }
    seenUrls.add(normalizedUrl);

    // Check if this URL is already monitored by this user
    const { count: existingCount } = await supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("url", normalizedUrl);

    if ((existingCount ?? 0) > 0) {
      results.push({
        line: row.line,
        url: row.url,
        name: row.name,
        status: "skipped",
        reason: "Already monitoring this URL.",
      });
      continue;
    }

    // Build a name: use provided name, or derive from hostname
    let appName = row.name?.trim();
    if (!appName || appName.length < 2) {
      try {
        appName = new URL(normalizedUrl).hostname.replace(/^www\./, "");
      } catch {
        appName = normalizedUrl.slice(0, 60);
      }
    }

    // Insert
    const insertData: Record<string, unknown> = {
      user_id: user.id,
      name: appName,
      url: normalizedUrl,
      monitoring_enabled: true,
    };
    if (row.healthCheckPath) {
      // Store as description for now — the health_check_path column may differ;
      // only add if column exists (gracefully skip if error).
      insertData.description = `Health check: ${row.healthCheckPath}`;
    }

    const { error: insertError } = await supabase
      .from("applications")
      .insert(insertData);

    if (insertError) {
      results.push({
        line: row.line,
        url: row.url,
        name: row.name,
        status: "skipped",
        reason: insertError.message,
      });
      continue;
    }

    results.push({
      line: row.line,
      url: row.url,
      name: appName,
      status: "added",
    });
    added++;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/applications");

  return {
    data: {
      results,
      added,
      skipped: results.length - added,
      quotaReached,
      quotaRemaining: Math.max(0, remaining - added),
    },
  };
}
