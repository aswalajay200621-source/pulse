import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TestingTermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-12 max-w-3xl mx-auto space-y-6">
      <Link href="/dashboard/experts" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Experts
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">Safe Harbor & Human Security Testing Terms</h1>
      <p className="text-xs text-muted-foreground">
        [PLACEHOLDER: Legal counsel must review this document before production launch. Company: [COMPANY_NAME], Contact: [LEGAL_CONTACT_EMAIL]]
      </p>

      <div className="space-y-4 text-sm text-muted-foreground leading-relaxed border border-border/70 rounded-lg p-5 bg-card">
        <h2 className="text-base font-semibold text-foreground">1. Safe Harbor Authorization</h2>
        <p>
          When an Application Owner opens a Test Request on [COMPANY_NAME] (&ldquo;Pulse&rdquo;) and accepts
          these Safe Harbor terms, the Owner authorizes invited Testers to perform good-faith,
          non-destructive security testing strictly within the defined in-scope URLs and rules.
        </p>

        <h2 className="text-base font-semibold text-foreground">2. Mandatory Tester Rules</h2>
        <ul className="list-disc pl-5 space-y-1 text-xs">
          <li>Test only in-scope URLs using dedicated test accounts.</li>
          <li>No denial of service (DoS), automated flooding, or service disruption.</li>
          <li>No accessing, modifying, or exfiltrating other real users&apos; data.</li>
          <li>No social engineering, phishing, or physical attacks.</li>
          <li>No public disclosure without the Owner&apos;s written permission.</li>
          <li>Stop testing and report immediately if you accidentally reach sensitive data.</li>
        </ul>

        <h2 className="text-base font-semibold text-foreground">3. Rewards & Payments</h2>
        <p className="text-xs">
          [PLACEHOLDER: Rewards are agreed between Owner and Tester and settled outside Pulse.
          Pulse records reward amounts and status for tracking only and does not process payments.]
        </p>
      </div>
    </div>
  );
}
