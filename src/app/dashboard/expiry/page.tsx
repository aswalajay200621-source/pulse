"use client";

import * as React from "react";
import {
  getExpiryOverviewData,
  createCredentialReminder,
  updateCredentialReminder,
  deleteExpiryItem,
  scanApplicationExpiries,
} from "@/app/actions/expiry";
import type {
  ApplicationRecord,
  ExpiryCategory,
  ExpiryItemRecord,
} from "@/lib/supabase/types";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
  Plus,
  Trash2,
  Pencil,
  KeyRound,
} from "lucide-react";

const CATEGORY_LABELS: Record<ExpiryCategory, string> = {
  ssl_certificate: "SSL Certificate",
  domain: "Domain Registration",
  api_key: "API Key",
  oauth_token: "OAuth Token",
  service_account: "Service Account",
  integration: "Third-Party Integration",
  other: "Other Credential",
};

export default function ExpiryMonitoringPage() {
  const [items, setItems] = React.useState<ExpiryItemRecord[]>([]);
  const [applications, setApplications] = React.useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [scanning, setScanning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [filterApp, setFilterApp] = React.useState<string>("all");
  const [filterCategory, setFilterCategory] = React.useState<string>("all");

  // Modal / Form state for user-managed credential reminders
  const [showForm, setShowForm] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState<ExpiryCategory>("api_key");
  const [appId, setAppId] = React.useState<string>("");
  const [expiryDate, setExpiryDate] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getExpiryOverviewData();
    if (res.error) {
      setError(res.error);
    } else {
      setItems(res.items ?? []);
      setApplications(res.applications ?? []);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    const res = await scanApplicationExpiries();
    if (res.error) setError(res.error);
    await loadData();
    setScanning(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setCategory("api_key");
    setAppId("");
    setExpiryDate("");
    setDescription("");
    setShowForm(false);
  };

  const handleEdit = (item: ExpiryItemRecord) => {
    setEditingId(item.id);
    setName(item.name);
    setCategory(item.category);
    setAppId(item.application_id ?? "");
    setExpiryDate(item.expiry_date ? item.expiry_date.slice(0, 10) : "");
    setDescription(item.description ?? "");
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      name,
      category,
      application_id: appId || null,
      expiry_date: expiryDate,
      description,
    };

    const res = editingId
      ? await updateCredentialReminder(editingId, payload)
      : await createCredentialReminder(payload);

    if (res.error) {
      setError(res.error);
    } else {
      resetForm();
      await loadData();
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    const res = await deleteExpiryItem(id);
    if (res.error) setError(res.error);
    else await loadData();
  };

  const filteredItems = React.useMemo(() => {
    return items.filter((item) => {
      if (filterApp !== "all" && item.application_id !== filterApp) return false;
      if (filterCategory !== "all" && item.category !== filterCategory) return false;
      return true;
    });
  }, [items, filterApp, filterCategory]);

  const counts = React.useMemo(() => {
    return {
      expiringSoon: filteredItems.filter((i) => i.status === "expiring_soon").length,
      expired: filteredItems.filter((i) => i.status === "expired").length,
      healthy: filteredItems.filter((i) => i.status === "healthy").length,
      unknown: filteredItems.filter((i) => i.status === "unknown" || i.status === "error").length,
    };
  }, [filteredItems]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            SSL, Domain & Credential Expiry
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Track TLS certificates, RDAP domain registrations, and credential renewal reminders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleScan}
            disabled={scanning}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? "Scanning SSL & RDAP..." : "Scan Applications"}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="h-8 gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Credential Reminder
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
          {error}
        </div>
      )}

      {/* Overview KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Expiring Soon"
          value={String(counts.expiringSoon)}
          subtitle="Within 30 days"
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
        />
        <StatCard
          title="Expired"
          value={String(counts.expired)}
          subtitle="Immediate renewal required"
          icon={<XCircle className="h-4 w-4 text-red-500" />}
        />
        <StatCard
          title="Healthy"
          value={String(counts.healthy)}
          subtitle="More than 30 days remaining"
          icon={<ShieldCheck className="h-4 w-4 text-emerald-500" />}
        />
        <StatCard
          title="Unknown / Unverified"
          value={String(counts.unknown)}
          subtitle="Redacted RDAP or inspection error"
          icon={<HelpCircle className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Add / Edit Credential Reminder Form */}
      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              {editingId ? "Edit Credential Reminder" : "New Credential Reminder"}
            </CardTitle>
            <CardDescription className="text-xs">
              Reminder metadata only — never enter actual API keys, tokens, or secret values.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-medium mb-1">Credential Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Stripe Production Webhook Secret"
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Credential Type *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpiryCategory)}
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs"
                >
                  <option value="api_key">API Key</option>
                  <option value="oauth_token">OAuth Token</option>
                  <option value="service_account">Service Account</option>
                  <option value="integration">Third-Party Integration</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">Associated Application</label>
                <select
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs"
                >
                  <option value="">None (Global)</option>
                  {applications.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">Expiry Date *</label>
                <input
                  type="date"
                  required
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-medium mb-1">Optional Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Rotation notes or owner contact (do not paste secrets)"
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={submitting}>
                  {submitting ? "Saving..." : editingId ? "Update Reminder" : "Save Reminder"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filters & Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-sm font-semibold">Tracked Expiry Items</CardTitle>
            <CardDescription className="text-xs">
              Reminders trigger at 30 days, 7 days, 1 day, and on expiry.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterApp}
              onChange={(e) => setFilterApp(e.target.value)}
              className="h-8 rounded-md border border-border bg-card px-2.5 text-xs"
            >
              <option value="all">All Applications</option>
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))}
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="h-8 rounded-md border border-border bg-card px-2.5 text-xs"
            >
              <option value="all">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Loading expiry items...</div>
          ) : filteredItems.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No expiry items found. Click &ldquo;Scan Applications&rdquo; or add a credential reminder.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-y border-border/70 bg-muted/40 font-mono text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Item</th>
                    <th className="py-2.5 px-4 font-medium">Category</th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                    <th className="py-2.5 px-4 font-medium">Expiry Date</th>
                    <th className="py-2.5 px-4 font-medium">Remaining</th>
                    <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredItems.map((item) => {
                    const statusColor =
                      item.status === "healthy"
                        ? "text-emerald-500"
                        : item.status === "expiring_soon"
                        ? "text-amber-500"
                        : item.status === "expired" || item.status === "error"
                        ? "text-red-500"
                        : "text-muted-foreground";

                    return (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium text-foreground">{item.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {item.issuer ? `Issuer: ${item.issuer}` : item.description || item.target_host || "Manual"}
                          </div>
                          {item.error_message && (
                            <div className="text-[11px] text-red-500 mt-0.5">{item.error_message}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {CATEGORY_LABELS[item.category]}
                        </td>
                        <td className={`py-3 px-4 font-mono font-semibold uppercase ${statusColor}`}>
                          {item.status.replace("_", " ")}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {item.expiry_date
                            ? new Date(item.expiry_date).toLocaleDateString()
                            : "Unknown"}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {item.days_remaining !== null ? `${item.days_remaining}d` : "—"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            {item.source === "manual" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(item)}
                                className="h-7 w-7 p-0"
                                title="Edit reminder"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(item.id)}
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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
    </div>
  );
}
