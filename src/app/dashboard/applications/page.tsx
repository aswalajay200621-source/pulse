"use client";

import * as React from "react";
import Link from "next/link";
import { mockApplications, Application } from "@/data/mock-data";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
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
import {
  Plus,
  Search,
  ExternalLink,
  ShieldAlert,
  Server,
  Layers,
  CheckCircle2,
  Filter,
} from "lucide-react";

export default function MyApplicationsPage() {
  const [apps, setApps] = React.useState<Application[]>(mockApplications);
  const [search, setSearch] = React.useState("");
  const [environmentFilter, setEnvironmentFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [emptyViewToggle, setEmptyViewToggle] = React.useState(false);

  // Form state for adding an application
  const [newName, setNewName] = React.useState("");
  const [newUrl, setNewUrl] = React.useState("");
  const [newEnv, setNewEnv] = React.useState<"Production" | "Staging" | "Preview">("Production");

  const handleAddApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newUrl) return;

    const newApp: Application = {
      id: `app-${Date.now()}`,
      name: newName,
      url: newUrl.startsWith("http") ? newUrl : `https://${newUrl}`,
      environment: newEnv,
      status: "online",
      uptimePercent: 100.0,
      avgLatencyMs: 95,
      lastChecked: "Just now",
      securityIssuesCount: { critical: 0, high: 0, medium: 0, low: 0 },
      sslCertificate: {
        issuer: "Let's Encrypt Authority",
        validUntil: "2027-06-01",
        daysRemaining: 90,
        status: "valid",
      },
      domainExpiry: {
        registrar: "DNS Provider",
        validUntil: "2028-01-01",
        daysRemaining: 365,
      },
      healthScore: 100,
      location: "US-East (N. Virginia)",
    };

    setApps([newApp, ...apps]);
    setShowAddModal(false);
    setNewName("");
    setNewUrl("");
  };

  const filteredApps = emptyViewToggle
    ? []
    : apps.filter((app) => {
        const matchesSearch =
          app.name.toLowerCase().includes(search.toLowerCase()) ||
          app.url.toLowerCase().includes(search.toLowerCase());

        const matchesEnv =
          environmentFilter === "all" || app.environment === environmentFilter;

        const matchesStatus =
          statusFilter === "all" || app.status === statusFilter;

        return matchesSearch && matchesEnv && matchesStatus;
      });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            My Applications
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Configure target URLs, synthetic check parameters, and active monitors.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEmptyViewToggle(!emptyViewToggle)}
            className="text-xs text-muted-foreground"
          >
            {emptyViewToggle ? "Show Data View" : "Simulate Empty State"}
          </Button>

          <Button
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add Application
          </Button>
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs sm:text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Environment filter */}
          <select
            value={environmentFilter}
            onChange={(e) => setEnvironmentFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="all">All Environments</option>
            <option value="Production">Production</option>
            <option value="Staging">Staging</option>
            <option value="Preview">Preview</option>
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="all">All Statuses</option>
            <option value="online">Online</option>
            <option value="degraded">Degraded</option>
            <option value="down">Down</option>
          </select>
        </div>
      </div>

      {/* Applications list or Empty state */}
      {filteredApps.length === 0 ? (
        <EmptyState
          icon={<Server className="h-6 w-6" />}
          title="No applications found"
          description={
            emptyViewToggle
              ? "This demonstrates the zero-state when a user hasn't added any applications yet."
              : "No applications matched your search or active filter criteria."
          }
          actionLabel={emptyViewToggle ? "Add First Application" : "Clear Filters"}
          onAction={() => {
            if (emptyViewToggle) {
              setEmptyViewToggle(false);
              setShowAddModal(true);
            } else {
              setSearch("");
              setEnvironmentFilter("all");
              setStatusFilter("all");
            }
          }}
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
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground uppercase">
                        {app.environment}
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
                  </div>

                  <StatusBadge status={app.status} />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-xs">
                  <div>
                    <span className="text-[11px] text-muted-foreground uppercase font-mono">
                      Uptime
                    </span>
                    <p className="font-mono font-medium text-foreground mt-0.5">
                      {app.uptimePercent}%
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground uppercase font-mono">
                      Latency
                    </span>
                    <p className="font-mono font-medium text-foreground mt-0.5">
                      {app.avgLatencyMs > 0 ? `${app.avgLatencyMs} ms` : "0 ms"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground uppercase font-mono">
                      SSL Cert
                    </span>
                    <p className="font-mono font-medium text-foreground mt-0.5">
                      {app.sslCertificate.daysRemaining}d left
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-xs">
                  <span className="text-muted-foreground">
                    Checked {app.lastChecked} • {app.location}
                  </span>
                  <Link href={`/dashboard/applications/${app.id}`}>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      Inspect Application →
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Application Dialog Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <form onSubmit={handleAddApp}>
          <DialogHeader>
            <DialogTitle>Add Monitored Application</DialogTitle>
            <DialogDescription>
              Pulse will automatically initiate synthetic health probes and analyze TLS & security configurations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Application Name
              </label>
              <Input
                required
                placeholder="e.g. Core Authentication API"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Endpoint URL
              </label>
              <Input
                required
                placeholder="https://api.mycompany.com/healthz"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                We support HTTP/HTTPS endpoints with GET/HEAD verification.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Environment
              </label>
              <select
                value={newEnv}
                onChange={(e) =>
                  setNewEnv(e.target.value as "Production" | "Staging" | "Preview")
                }
                className="h-9 w-full rounded-md border border-input bg-card px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="Production">Production</option>
                <option value="Staging">Staging</option>
                <option value="Preview">Preview</option>
              </select>
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
            <Button type="submit">Create Application</Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
