"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LayoutDashboard,
  Layers,
  Activity,
  ShieldCheck,
  Bell,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  User,
  Sliders,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mockAlerts, mockApplications } from "@/data/mock-data";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

const navItems: NavItem[] = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { title: "My Applications", href: "/dashboard/applications", icon: Layers, badge: 5 },
  { title: "Monitoring", href: "/dashboard/monitoring", icon: Activity },
  { title: "Security Scans", href: "/dashboard/security", icon: ShieldCheck, badge: "2" },
  { title: "Alerts", href: "/dashboard/alerts", icon: Bell, badge: 2 },
  { title: "Reports", href: "/dashboard/reports", icon: FileText },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Authenticated user state
  const [userEmail, setUserEmail] = React.useState<string>("alex@acmepay.io");
  const [userName, setUserName] = React.useState<string>("Alex Rivera");
  const [appCount, setAppCount] = React.useState<number>(0);
  const [signingOut, setSigningOut] = React.useState(false);

  const supabase = createClient();

  React.useEffect(() => {
    async function loadUserSession() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          if (user.email) setUserEmail(user.email);
          const metaName = user.user_metadata?.full_name;
          if (metaName) {
            setUserName(metaName);
          } else {
            // Check profiles table
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", user.id)
              .single();

            if (profile?.full_name) {
              setUserName(profile.full_name);
            } else if (user.email) {
              setUserName(user.email.split("@")[0]);
            }
          }

          // Fetch real application count
          const { count } = await supabase
            .from("applications")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id);

          if (count !== null) {
            setAppCount(count);
          }
        }
      } catch {
        // Fallback to default demo name if unconfigured
      }
    }

    loadUserSession();
  }, [supabase]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore network errors
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  // Close mobile sidebar and dropdowns on route change
  React.useEffect(() => {
    setMobileOpen(false);
    setNotificationsOpen(false);
    setUserMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  // Keyboard shortcut Ctrl+K / Cmd+K for search
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setUserMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Compute breadcrumbs
  const pathSegments = pathname.split("/").filter(Boolean);
  const breadcrumbList = pathSegments.map((seg, i) => {
    const href = "/" + pathSegments.slice(0, i + 1).join("/");
    let label = seg.charAt(0).toUpperCase() + seg.slice(1);
    if (seg === "dashboard") label = "Home";
    if (seg === "security") label = "Security Scans";
    if (seg === "applications") label = "Applications";
    return { href, label };
  });

  const filteredApps = searchQuery
    ? mockApplications.filter((a) =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.url.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : mockApplications;

  const initials = userName
    ? userName
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "AR";

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-40 flex flex-col border-r border-border/70 bg-card transition-all duration-200 ease-in-out lg:static",
          collapsed ? "w-16" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Brand header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-border/70">
          <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
            <Logo size="default" withText={!collapsed} />
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex h-7 w-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden flex h-7 w-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick status pill */}
        {!collapsed && (
          <div className="px-4 py-3 border-b border-border/50">
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-2.5 py-1.5 text-xs">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Network Probes
              </span>
              <span className="font-mono text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                Operational
              </span>
            </div>
          </div>
        )}

        {/* Navigation links */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            const Icon = item.icon;
            const badgeValue = item.href === "/dashboard/applications" ? `${appCount}/3` : item.badge;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.title : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-xs sm:text-sm font-medium transition-colors relative group",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform group-hover:scale-105",
                    isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                {!collapsed && (
                  <span className="truncate flex-1">{item.title}</span>
                )}
                {!collapsed && badgeValue && (
                  <span
                    className={cn(
                      "ml-auto text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full",
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {badgeValue}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Bottom environment indicator */}
        <div className="p-3 border-t border-border/70">
          {!collapsed ? (
            <div className="rounded-md border border-border/60 bg-muted/30 p-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground truncate max-w-[120px]">
                  {userName}
                </span>
                <span className="text-[10px] uppercase font-mono px-1 rounded bg-secondary text-secondary-foreground">
                  Pro
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground truncate font-mono">
                {userEmail}
              </p>
            </div>
          ) : (
            <div className="flex justify-center text-xs font-mono text-muted-foreground py-1">
              PRO
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-background/80 px-4 sm:px-6 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex lg:hidden h-8 w-8 items-center justify-center rounded-md border border-border/70 text-muted-foreground hover:text-foreground"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Breadcrumbs */}
            <nav className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
              {breadcrumbList.map((crumb, idx) => (
                <React.Fragment key={crumb.href}>
                  {idx > 0 && <span className="text-muted-foreground/40">/</span>}
                  {idx === breadcrumbList.length - 1 ? (
                    <span className="font-semibold text-foreground truncate max-w-[150px] sm:max-w-none">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className="hover:text-foreground transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </React.Fragment>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Search Trigger */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 h-8 rounded-md border border-border/80 bg-card px-2.5 sm:px-3 text-xs text-muted-foreground hover:border-border transition-colors focus:outline-none"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Search monitors...</span>
              <kbd className="hidden sm:inline-flex rounded border border-border/60 bg-muted px-1.5 font-mono text-[10px]">
                ⌘K
              </kbd>
            </button>

            {/* Notifications Menu */}
            <div className="relative">
              <button
                onClick={() => {
                  setNotificationsOpen(!notificationsOpen);
                  setUserMenuOpen(false);
                }}
                className="relative flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Notifications"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-background" />
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-border/80 bg-card shadow-xl z-50 p-3 animate-in fade-in-0 zoom-in-95">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-2 px-1">
                    <span className="text-xs font-semibold text-foreground">
                      Recent Incident Notifications
                    </span>
                    <Link
                      href="/dashboard/alerts"
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      View all (4)
                    </Link>
                  </div>
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {mockAlerts.slice(0, 3).map((a) => (
                      <Link
                        key={a.id}
                        href="/dashboard/alerts"
                        className="block rounded-lg p-2 hover:bg-muted/50 transition-colors border border-transparent hover:border-border/60 text-left"
                      >
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-semibold text-foreground truncate max-w-[180px]">
                            {a.appName}
                          </span>
                          <span className="text-muted-foreground font-mono">{a.timestamp}</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{a.title}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* User Profile Menu */}
            <div className="relative">
              <button
                onClick={() => {
                  setUserMenuOpen(!userMenuOpen);
                  setNotificationsOpen(false);
                }}
                className="flex items-center gap-2 rounded-md border border-border/70 bg-card p-1 sm:px-2 sm:py-1 text-xs hover:bg-accent transition-colors"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                  {initials}
                </div>
                <span className="hidden md:inline font-medium text-foreground max-w-[120px] truncate">
                  {userName}
                </span>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border/80 bg-card shadow-xl z-50 p-2 animate-in fade-in-0 zoom-in-95">
                  <div className="px-2 py-1.5 border-b border-border/60 mb-1">
                    <p className="text-xs font-semibold text-foreground truncate">{userName}</p>
                    <p className="text-[11px] text-muted-foreground truncate font-mono">
                      {userEmail}
                    </p>
                  </div>
                  <Link
                    href="/dashboard/settings"
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <User className="h-3.5 w-3.5" /> Profile & Account
                  </Link>
                  <Link
                    href="/dashboard/settings"
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <Sliders className="h-3.5 w-3.5" /> Preferences
                  </Link>
                  <div className="my-1 border-t border-border/60" />
                  <button
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-rose-500 hover:bg-rose-500/10 transition-colors text-left"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    {signingOut ? "Signing Out..." : "Sign Out"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Quick Search Dialog Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setSearchOpen(false)}
          />
          <div className="relative z-50 w-full max-w-xl rounded-xl border border-border/80 bg-card p-4 shadow-2xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center gap-2 border-b border-border/60 pb-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Type an application name, URL or page..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-sm"
              />
              <kbd
                onClick={() => setSearchOpen(false)}
                className="cursor-pointer text-xs rounded border border-border/60 bg-muted px-1.5 py-0.5 text-muted-foreground"
              >
                ESC
              </kbd>
            </div>

            <div className="mt-3 space-y-1 max-h-80 overflow-y-auto">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase px-2 py-1">
                Applications
              </p>
              {filteredApps.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No applications matched "{searchQuery}"
                </div>
              ) : (
                filteredApps.map((app) => (
                  <Link
                    key={app.id}
                    href={`/dashboard/applications/${app.id}`}
                    onClick={() => setSearchOpen(false)}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-xs hover:bg-muted/60 transition-colors group"
                  >
                    <div>
                      <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {app.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {app.url}
                      </p>
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {app.uptimePercent}%
                    </span>
                  </Link>
                ))
              )}

              <p className="text-[11px] font-semibold text-muted-foreground uppercase px-2 pt-3 pb-1">
                Quick Navigation
              </p>
              {navItems.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setSearchOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <n.icon className="h-3.5 w-3.5" />
                  <span>Go to {n.title}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
