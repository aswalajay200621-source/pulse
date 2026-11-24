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
                <li><strong>Account details:</strong> Name, work email address, and billing authentication tokens.</li>
                <li><strong>Monitored targets:</strong> Hostnames, URL endpoints, and probe configuration frequencies.</li>
                <li><strong>Diagnostic telemetry:</strong> HTTP status codes, latency timings, TLS handshake attributes, and public security headers returned by your servers.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-base font-semibold text-foreground mb-2">
                3. We Do Not Inspect Application Payloads
              </h2>
              <p>
                Pulse probes are designed for synthetic reachability and security header compliance. We do not store, scrape, or resell internal database data, customer transaction records, or proprietary request payloads.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold text-foreground mb-2">
                4. Data Retention & Deletion
              </h2>
              <p>
                High-frequency probe results are retained for 90 days for SLA chart rendering before automated roll-up into daily aggregates. You can request complete account and metric purging at any time through Settings.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold text-foreground mb-2">
                5. Contact Information
              </h2>
              <p>
                For privacy compliance inquiries or data subject access requests, reach our Data Protection Officer at <span className="font-mono text-foreground">privacy@pulsehealth.io</span>.
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
