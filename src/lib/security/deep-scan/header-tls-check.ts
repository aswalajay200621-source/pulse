import { checkSecurityHeaders } from "@/lib/security/header-checker";
import { inspectTlsCertificate } from "@/lib/expiry/checker";
import type { DeepScanFinding } from "./types";

export async function checkHeadersAndTls(appUrl: string): Promise<DeepScanFinding[]> {
  const findings: DeepScanFinding[] = [];

  const [headerRes, tlsRes] = await Promise.all([
    checkSecurityHeaders(appUrl),
    inspectTlsCertificate(appUrl),
  ]);

  for (const hf of headerRes.findings) {
    findings.push({
      ruleId: hf.ruleId,
      severity: hf.severity,
      title: hf.title,
      evidence: hf.description,
      affectedUrl: appUrl,
      findingKey: `deep:${hf.findingKey}`,
    });
  }

  if (tlsRes.status === "expired") {
    findings.push({
      ruleId: "ssl-expired",
      severity: "critical",
      title: "SSL Certificate Expired",
      evidence: `TLS certificate expired on ${tlsRes.expiryDate || "unknown date"}.`,
      affectedUrl: appUrl,
      findingKey: "deep:tls:expired",
    });
  } else if (tlsRes.status === "error" && tlsRes.errorMessage) {
    findings.push({
      ruleId: "ssl-untrusted-chain",
      severity: "high",
      title: "TLS Certificate Verification Issue",
      evidence: tlsRes.errorMessage,
      affectedUrl: appUrl,
      findingKey: "deep:tls:untrusted",
    });
  }

  return findings;
}
