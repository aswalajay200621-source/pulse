"use client";

import * as React from "react";
import Link from "next/link";
import {
  getApplications,
  createApplication,
  updateApplication,
  deleteApplication,
} from "@/app/actions/applications";
import { ApplicationRecord } from "@/lib/supabase/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { BulkImportDialog } from "@/components/dashboard/bulk-import-dialog";
import {
  Plus,
  Search,
  ExternalLink,
  Server,
  Layers,
  AlertCircle,
  CheckCircle2,
  Edit2,
  Trash2,
  Power,
  AlertTriangle,
  Upload,
} from "lucide-react";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

const MAX_APPS = 3;

export default function MyApplicationsPage() {
  const [apps, setApps] = React.useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  // Modals state
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [showImportModal, setShowImportModal] = React.useState(false);
  const [selectedApp, setSelectedApp] = React.useState<ApplicationRecord | null>(null);

  // Form states
  const [name, setName] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [githubRepo, setGithubRepo] = React.useState("");
  const [formLoading, setFormLoading] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formSuccess, setFormSuccess] = React.useState<string | null>(null);

  const fetchApps = React.useCallback(async () => {
    setLoading(true);
    const res = await getApplications();
    if (res.success && res.data) {
      setApps(res.data);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  const resetForm = () => {
    setName("");
    setUrl("");
    setDescription("");
    setGithubRepo("");
    setFormError(null);
    setFormSuccess(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleOpenEdit = (app: ApplicationRecord) => {
    resetForm();
    setSelectedApp(app);
    setName(app.name);
    setUrl(app.url);
    setDescription(app.description || "");
    setGithubRepo(app.github_repository_url || "");
    setShowEditModal(true);
  };

  const handleOpenDelete = (app: ApplicationRecord) => {
    setSelectedApp(app);
    setShowDeleteModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    const res = await createApplication({
      name,
      url,
      description: description || undefined,
      github_repository_url: githubRepo || undefined,
    });

    if (!res.success) {
      setFormError(res.error || "Failed to create application.");
      setFormLoading(false);
      return;
    }

    setFormSuccess("Application created and scheduled for monitoring!");
    setFormLoading(false);
    await fetchApps();
    setTimeout(() => {
      setShowAddModal(false);
      resetForm();
    }, 1200);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;

    setFormError(null);
    setFormLoading(true);

    const res = await updateApplication(selectedApp.id, {
      name,
      url,
      description,
      github_repository_url: githubRepo,
    });

    if (!res.success) {
      setFormError(res.error || "Failed to update application.");
      setFormLoading(false);
      return;
    }

    setFormSuccess("Application details updated!");
    setFormLoading(false);
    await fetchApps();
    setTimeout(() => {
      setShowEditModal(false);
      resetForm();
    }, 1000);
  };

  const handleDelete = async () => {
    if (!selectedApp) return;
    setFormLoading(true);

    const res = await deleteApplication(selectedApp.id);
    if (!res.success) {
      alert(res.error || "Failed to delete application.");
      setFormLoading(false);
      return;
    }

    setFormLoading(false);
    setShowDeleteModal(false);
    setSelectedApp(null);
    await fetchApps();
  };

  const handleToggleMonitoring = async (app: ApplicationRecord) => {
    const updatedStatus = !app.monitoring_enabled;
    // Optimistic local update
    setApps((prev) =>
      prev.map((a) =>
        a.id === app.id ? { ...a, monitoring_enabled: updatedStatus } : a
      )
    );

    const res = await updateApplication(app.id, {
      monitoring_enabled: updatedStatus,
    });

    if (!res.success) {
      // Revert if failed
      setApps((prev) =>
        prev.map((a) =>
          a.id === app.id ? { ...a, monitoring_enabled: app.monitoring_enabled } : a
        )
      );
      alert(res.error || "Failed to toggle monitoring.");
    }
  };

  const filteredApps = apps.filter((app) => {
    return (
      app.name.toLowerCase().includes(search.toLowerCase()) ||
      app.url.toLowerCase().includes(search.toLowerCase()) ||
      (app.description && app.description.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const quotaReached = apps.length >= MAX_APPS;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              My Applications
            </h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-mono font-medium border ${
                quotaReached
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                  : "bg-muted text-muted-foreground border-border"
              }`}
            >
              {apps.length} of {MAX_APPS} used
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage monitored endpoints, GitHub repository connections, and check intervals.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImportModal(true)}
            disabled={quotaReached}
            className="gap-1.5"
            title={quotaReached ? "Maximum limit of 3 applications reached" : "Bulk import URLs"}
          >
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <Button
            size="sm"
            onClick={handleOpenAdd}
            disabled={quotaReached}
            className="gap-1.5"
            title={quotaReached ? "Maximum limit of 3 applications reached" : undefined}
          >
            <Plus className="h-4 w-4" />
            Add Application
          </Button>
        </div>
      </div>

      <SupabaseNotice />

      {/* Quota limit notice */}
      {quotaReached && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <span>
              <strong>Application Quota Reached:</strong> Each account is limited to {MAX_APPS} applications. To add a new one, remove an existing application.
            </span>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search applications by name, URL, or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 text-xs sm:text-sm"
        />
      </div>

      {/* Content list or Empty State */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-44 rounded-lg border border-border/60 bg-muted/20 animate-pulse"
            />
          ))}
        </div>
      ) : filteredApps.length === 0 ? (
        <EmptyState
          icon={<Server className="h-6 w-6" />}
          title={apps.length === 0 ? "No applications yet" : "No matches found"}
          description={
            apps.length === 0
              ? "Add your first web application or API endpoint to begin synthetic health monitoring and security scans."
              : `No applications matched "${search}". Try clearing your search.`
          }
          actionLabel={apps.length === 0 ? "Add Your First Application" : "Clear Search"}
          onAction={apps.length === 0 ? handleOpenAdd : () => setSearch("")}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredApps.map((app) => (
            <Card
              key={app.id}
              className="border-border/70 hover:border-border transition-all hover:shadow-sm"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/applications/${app.id}`}
                        className="text-base font-semibold text-foreground hover:underline truncate"
                      >
                        {app.name}
                      </Link>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-mono uppercase ${
                          app.monitoring_enabled
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-muted text-muted-foreground border border-border"
                        }`}
                      >
                        {app.monitoring_enabled ? "Active" : "Paused"}
                      </span>
                    </div>

                    <a
                      href={app.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground truncate max-w-full"
                    >
                      {app.url}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>

                    {app.description && (
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                        {app.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleMonitoring(app)}
                      title={app.monitoring_enabled ? "Pause monitoring" : "Resume monitoring"}
                      className={`h-7 w-7 rounded flex items-center justify-center border transition-colors ${
                        app.monitoring_enabled
                          ? "border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                          : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(app)}
                      title="Edit application"
                      className="h-7 w-7 rounded flex items-center justify-center border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleOpenDelete(app)}
                      title="Delete application"
                      className="h-7 w-7 rounded flex items-center justify-center border border-border/70 text-muted-foreground hover:text-rose-500 hover:border-rose-500/30 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-xs">
                  <div className="flex items-center gap-2">
                    {app.github_repository_url ? (
                      <a
                        href={app.github_repository_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground"
                      >
                        <GithubIcon className="h-3 w-3" />
                        Repository Linked
                      </a>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/60 font-mono">
                        No GitHub linked
                      </span>
                    )}
                  </div>

                  <Link href={`/dashboard/applications/${app.id}`}>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      Inspect Details →
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ADD APPLICATION MODAL */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <form onSubmit={handleCreate}>
          <DialogHeader>
            <DialogTitle>Add Monitored Application</DialogTitle>
            <DialogDescription>
              Pulse will validate the target against SSRF vulnerabilities, register the endpoint, and begin synthetic uptime probes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {formError && (
              <div className="flex items-start gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{formSuccess}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Application Name *
              </label>
              <Input
                required
                placeholder="e.g. Acme Production API"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Public Application URL *
              </label>
              <Input
                required
                placeholder="https://api.acmepay.io/health"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Must be a publicly accessible domain. Localhost, private RFC1918 IPs, and cloud metadata endpoints are strictly blocked.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Description (Optional)
              </label>
              <Input
                placeholder="Brief description of the service's role..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                GitHub Repository URL (Optional)
              </label>
              <Input
                placeholder="https://github.com/organization/repository"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={formLoading}>
              {formLoading ? "Validating & Adding..." : "Add Application"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* EDIT APPLICATION MODAL */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <form onSubmit={handleUpdate}>
          <DialogHeader>
            <DialogTitle>Edit Application Details</DialogTitle>
            <DialogDescription>
              Update application name, endpoint target URL, or repository link.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {formError && (
              <div className="flex items-start gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{formSuccess}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Application Name
              </label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Public Application URL
              </label>
              <Input
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                URL changes are re-verified against SSRF rules and reachable DNS.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Description
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                GitHub Repository URL
              </label>
              <Input
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowEditModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={formLoading}>
              {formLoading ? "Saving Changes..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* DELETE CONFIRMATION MODAL */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogHeader>
          <DialogTitle>Delete Application</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong className="text-foreground">{selectedApp?.name}</strong>? All associated monitoring logs, security findings, and alerts will be permanently removed.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowDeleteModal(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={formLoading}
          >
            {formLoading ? "Deleting..." : "Permanently Delete"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Bulk Import Dialog */}
      <BulkImportDialog
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={fetchApps}
      />
    </div>
  );
}
