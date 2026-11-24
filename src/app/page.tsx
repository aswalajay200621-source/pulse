import Link from "next/link";
import { LogoLink } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  ShieldCheck,
  Activity,
  BellRing,
  Lock,
  ArrowRight,
  CheckCircle,
  Clock,
  Sparkles,
  Server,
  Zap,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background selection:bg-neutral-800 selection:text-white dark:selection:bg-neutral-200 dark:selection:text-black">
      {/* Navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <LogoLink href="/" />

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              How it Works
            </a>
            <a href="#audience" className="transition-colors hover:text-foreground">
              Who It's For
            </a>
            <Link href="/dashboard" className="transition-colors hover:text-foreground">
              Dashboard Demo
            </Link>
          </nav>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Log In
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="hidden xs:inline-flex">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-20 pb-16 md:pt-28 md:pb-24 border-b border-border/40">
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:32px_32px]" />
          
          <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/60 px-3 py-1 text-xs text-muted-foreground mb-6">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Next-gen application health monitoring</span>
              <span className="text-border">|</span>
              <span className="font-medium text-foreground">v1.0 Now Live</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.12]">
              Your apps deserve <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-neutral-900 via-neutral-600 to-neutral-400 dark:from-neutral-100 dark:via-neutral-300 dark:to-neutral-500 bg-clip-text text-transparent">
                someone watching.
              </span>
            </h1>

            <p className="mt-6 text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-normal">
              Monitor uptime, detect security problems and keep your applications healthy from one simple dashboard.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto gap-2">
                  Start Monitoring Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Explore Live Dashboard
                </Button>
              </Link>
            </div>

            <p className="mt-4 text-xs text-muted-foreground/80">
              No credit card required • 3-minute setup • Instant health diagnostics
            </p>

            {/* Dashboard Mock Preview Preview Card */}
            <div className="mt-12 rounded-xl border border-border/80 bg-card p-2 sm:p-3 shadow-2xl shadow-neutral-900/5 dark:shadow-none">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4 sm:p-6 text-left">
                <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                    <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                    <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 text-xs font-mono text-muted-foreground">app.pulsehealth.io/dashboard</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      5 Services Active
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="rounded-md border border-border/60 bg-card/70 p-3">
                    <p className="text-[11px] text-muted-foreground uppercase font-mono">Global Uptime</p>
                    <p className="text-xl font-bold font-mono text-foreground mt-1">99.96%</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-card/70 p-3">
                    <p className="text-[11px] text-muted-foreground uppercase font-mono">Avg Latency</p>
                    <p className="text-xl font-bold font-mono text-foreground mt-1">84 ms</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-card/70 p-3">
                    <p className="text-[11px] text-muted-foreground uppercase font-mono">Security Grade</p>
                    <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">A+</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-card/70 p-3">
                    <p className="text-[11px] text-muted-foreground uppercase font-mono">Cert Status</p>
                    <p className="text-xl font-bold font-mono text-foreground mt-1">Secure</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/60 pt-3">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> All core nodes responsive across 6 continents
                  </span>
                  <span className="font-mono text-[11px]">Updated 30s ago</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 md:py-24 border-b border-border/50">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Engineered for Reliability
              </h2>
              <p className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                Everything you need to keep production calm.
              </p>
              <p className="mt-3 text-sm sm:text-base text-muted-foreground">
                No jargon. No complex multi-hour setup. Just straightforward health metrics and automated security vigilance.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-xl border border-border/70 bg-card p-6 transition-all hover:border-border">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/80 bg-muted/50 text-foreground mb-4">
                  <Activity className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Real-time Uptime Probes</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  High-frequency synthetic health checks dispatched from multi-region data centers. Get alerted before your customers notice.
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-card p-6 transition-all hover:border-border">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/80 bg-muted/50 text-foreground mb-4">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Automated Security Audits</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Continuous scanning for missing HTTP security headers, CORS misconfigurations, outdated SSL handshakes, and open vulnerabilities.
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-card p-6 transition-all hover:border-border">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/80 bg-muted/50 text-foreground mb-4">
                  <Lock className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Certificate & Domain Tracking</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Never suffer a silent outage caused by an expired TLS certificate or lapsed domain registration. Timely notifications with proactive grace periods.
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-card p-6 transition-all hover:border-border">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/80 bg-muted/50 text-foreground mb-4">
                  <BellRing className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Actionable Alerts</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Clear explanations of what went wrong and how to fix it in plain language—eliminating alert fatigue.
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-card p-6 transition-all hover:border-border">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/80 bg-muted/50 text-foreground mb-4">
                  <Clock className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Latency & SLA Benchmarks</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Track p50, p95, and p99 response times over hours, days, or months to spot degradation before it causes cascading failures.
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-card p-6 transition-all hover:border-border">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/80 bg-muted/50 text-foreground mb-4">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Weekly Executive Digest</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Clean, concise weekly PDF and email digests ready to share with your team, stakeholders, or clients.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-20 md:py-24 border-b border-border/50 bg-muted/20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="text-center max-w-xl mx-auto mb-16">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Streamlined Setup
              </h2>
              <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                Up and running in three simple steps.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card font-mono text-sm font-bold text-foreground mb-4 shadow-sm">
                  01
                </div>
                <h3 className="text-base font-semibold text-foreground">Add Your URL</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Simply paste your website or API endpoint. No agent installations or complex configs required.
                </p>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card font-mono text-sm font-bold text-foreground mb-4 shadow-sm">
                  02
                </div>
                <h3 className="text-base font-semibold text-foreground">Automated Discovery</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Pulse inspects SSL validity, response latencies, security headers, and DNS records instantly.
                </p>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card font-mono text-sm font-bold text-foreground mb-4 shadow-sm">
                  03
                </div>
                <h3 className="text-base font-semibold text-foreground">Rest Assured</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Get notified through Discord, Slack, SMS or email only when true incidents require your attention.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Target Audience */}
        <section id="audience" className="py-20 md:py-24 border-b border-border/50">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tailored Solutions
              </h2>
              <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                Designed for teams that ship fast.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-xl border border-border/80 bg-card p-6">
                <span className="text-xs font-mono font-medium text-muted-foreground uppercase">For Indie Founders</span>
                <h3 className="mt-2 text-lg font-semibold text-foreground">Keep products online effortlessly</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  You build products solo or in tiny teams. You don't have hours to configure complex enterprise monitoring suites. Pulse gives you peace of mind in 3 minutes.
                </p>
              </div>

              <div className="rounded-xl border border-border/80 bg-card p-6">
                <span className="text-xs font-mono font-medium text-muted-foreground uppercase">For SaaS Teams</span>
                <h3 className="mt-2 text-lg font-semibold text-foreground">Protect customer SLAs & security</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Consolidated visibility over production and staging services. Instant alerting on latency degradation and missing headers before enterprise audits.
                </p>
              </div>

              <div className="rounded-xl border border-border/80 bg-card p-6">
                <span className="text-xs font-mono font-medium text-muted-foreground uppercase">For Agencies & Dev Studios</span>
                <h3 className="mt-2 text-lg font-semibold text-foreground">Prove reliability to your clients</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Manage dozens of client apps under one unified umbrella. Share polished automated weekly health reports that demonstrate ongoing diligence.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Call to action */}
        <section className="py-20 md:py-24 bg-card/40">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Ready to safeguard your applications?
            </h2>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
              Join development teams monitoring uptime, TLS certificates, and critical vulnerabilities with Pulse.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/register">
                <Button size="lg" className="gap-2">
                  Get Started for Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline" size="lg">
                  View Demo Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/70 py-12 bg-background">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-2">
            <LogoLink href="/" />
            <p className="text-xs text-muted-foreground">
              Keep your app alive and safe after launch, in plain language.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <Link href="/login" className="hover:text-foreground transition-colors">
              Sign In
            </Link>
            <Link href="/register" className="hover:text-foreground transition-colors">
              Create Account
            </Link>
            <Link href="/dashboard" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Pulse Inc. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
