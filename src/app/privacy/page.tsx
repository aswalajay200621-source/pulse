import Link from "next/link";
import { LogoLink } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <LogoLink href="/" />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" /> Back
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 py-12 md:py-16">
        <article className="mx-auto max-w-3xl px-4 sm:px-6 prose dark:prose-invert">
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
            Privacy Policy
          </h1>
          <p className="text-xs text-muted-foreground mb-8">
            Last modified: November 24, 2026
          </p>

          <section className="space-y-6 text-sm text-muted-foreground leading-relaxed">
            <div>
              <h2 className="text-base font-semibold text-foreground mb-2">
                1. Overview & Core Commitments
              </h2>
              <p>
                Pulse ("we", "our", or "us") provides application uptime verification, SSL certificate monitoring, and security header scanning. We respect your privacy and only process the minimal telemetry required to perform external synthetic health checks.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold text-foreground mb-2">
                2. Information We Collect
              </h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Account details:</strong> Name, work email address, and authentication tokens.</li>
                <li><strong>Monitored targets:</strong> Hostnames, URL endpoints, and probe configuration frequencies.</li>
                <li><strong>Diagnostic telemetry:</strong> HTTP status codes, latency timings, TLS handshake attributes, and public security headers returned by your servers.</li>
                <li><strong>Public status pages (opt-in):</strong> If you choose to enable a public status page for an application, we store a randomly generated unguessable slug and your chosen display title. Only uptime history, incident durations, and overall status are exposed publicly — no internal URLs, error details, security findings, or account data are ever shown. You can disable or rotate the slug at any time from your application settings.</li>
                <li><strong>Error reports (optional):</strong> When you install the Pulse error reporting snippet, we store the error message, the route path (with query strings and fragments removed), a short scrubbed stack excerpt, browser family name (e.g. Chrome), optional release version, and timestamp.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-base font-semibold text-foreground mb-2">
                3. Secret &amp; Personal Data Scrubbing
              </h2>
              <p>
                Pulse probes are designed for synthetic reachability and security header compliance. For error reports, emails, JWTs, bearer tokens, API keys, and credit-card-like numbers are automatically scrubbed and replaced with <span className="font-mono text-foreground">[REDACTED]</span> before storage. We never store IP addresses, cookies, request bodies, headers, or user IDs from error reports. You can revoke or rotate your ingest key at any time from your application settings.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold text-foreground mb-2">
                4. Data Retention &amp; Deletion
              </h2>
              <p>
                High-frequency probe results are retained for 90 days before automated roll-up. Individual error events are automatically deleted after 30 days. Daily health score snapshots per application are retained for 90 days and then automatically deleted. You can request complete account and metric purging at any time through Settings.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold text-foreground mb-2">
                5. Contact Information
              </h2>
              <p>
                For privacy compliance inquiries or data subject access requests, reach <span className="font-mono text-foreground">PULSE</span> at <span className="font-mono text-foreground">[CONTACT_EMAIL]</span>.
              </p>
            </div>
          </section>
        </article>
      </main>

      <footer className="border-t border-border/70 py-8 bg-card/20 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Pulse Inc. Built with privacy-first architecture.
      </footer>
    </div>
  );
}
