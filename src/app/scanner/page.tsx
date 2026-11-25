import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";

export default function ScannerInfoPage() {
  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-12 max-w-3xl mx-auto space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Pulse
      </Link>

      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">PulseScanner/1.0</h1>
          <p className="text-xs text-muted-foreground">
            Automated, non-destructive security & configuration scanner
          </p>
        </div>
      </div>

      <div className="space-y-4 text-sm text-muted-foreground leading-relaxed border border-border/70 rounded-lg p-5 bg-card">
        <h2 className="text-base font-semibold text-foreground">What PulseScanner Does</h2>
        <p>
          <code>PulseScanner/1.0</code> is only run against domains whose owners have explicitly
          verified domain ownership and provided consent inside Pulse. It performs strictly
          non-destructive <code>GET</code>, <code>HEAD</code>, and <code>OPTIONS</code> requests
          (rate-limited to at most 2 requests/second, capped at 300 requests and 2 minutes) to
          check for exposed sensitive files, misconfigured CORS/headers, cookie flags, and
          harmless reflection probes.
        </p>

        <h2 className="text-base font-semibold text-foreground pt-2">How to Block PulseScanner</h2>
        <p>
          If you wish to block <code>PulseScanner/1.0</code> at your web server or CDN, you can:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs">
          <li>Remove the verification token from <code>/.well-known/pulse-verify.txt</code> or DNS TXT <code>_pulse-verify</code>.</li>
          <li>Block requests matching User-Agent <code>PulseScanner/1.0</code> in Cloudflare, Nginx, or your WAF.</li>
        </ul>
      </div>
    </div>
  );
}
