import Link from "next/link";
import { LogoLink } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p className="text-xs text-muted-foreground mb-8">
            Effective Date: November 24, 2026
          </p>

          <section className="space-y-6 text-sm text-muted-foreground leading-relaxed">
            <div>
              <h2 className="text-base font-semibold text-foreground mb-2">
                1. Acceptance of Terms
              </h2>
              <p>
                By accessing or utilizing the Pulse platform, synthetic probe infrastructure, and APIs, you agree to be bound by these Terms of Service.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold text-foreground mb-2">
                2. Authorized Target Verification
              </h2>
              <p>
                You represent and warrant that you own, operate, or maintain explicit authorization to probe and scan all hostnames, domain names, and URLs configured in your Pulse dashboard. Probing unauthorized third-party targets is strictly prohibited.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold text-foreground mb-2">
                3. Service Level & Probing Availability
              </h2>
              <p>
                Pulse strives for 99.9% uptime of its external global probe network. However, network conditions beyond our control may occasionally delay alerts. Pulse is an observational assistant and does not guarantee that your application will be immune from zero-day vulnerabilities.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold text-foreground mb-2">
                4. Account Responsibilities
              </h2>
              <p>
                You are responsible for securing account credentials, webhook endpoints, and API secret keys. Notify security@pulsehealth.io immediately if you suspect unauthorized access.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold text-foreground mb-2">
                5. Modifications & Cancellation
              </h2>
              <p>
                You may cancel your subscription or delete individual targets at any time via the Settings panel without penalty.
              </p>
            </div>
          </section>
        </article>
      </main>

      <footer className="border-t border-border/70 py-8 bg-card/20 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Pulse Inc. Terms governed under international SaaS standards.
      </footer>
    </div>
  );
}
