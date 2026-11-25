import dns from "node:dns/promises";
import crypto from "node:crypto";
import { validateApplicationUrl } from "@/lib/security/url-validator";

export function generateVerificationToken(): string {
  return `pulse-verify=${crypto.randomBytes(16).toString("hex")}`;
}

export async function verifyDomainOwnership(
  appUrl: string,
  expectedToken: string,
  method: "well_known" | "dns_txt"
): Promise<{ verified: boolean; error?: string }> {
  const validation = await validateApplicationUrl(appUrl);
  if (!validation.valid || !validation.normalizedUrl) {
    return { verified: false, error: validation.error || "Invalid application URL." };
  }

  const parsed = new URL(validation.normalizedUrl);

  if (method === "well_known") {
    const verifyUrl = `${parsed.origin}/.well-known/pulse-verify.txt`;
    const checkValidation = await validateApplicationUrl(verifyUrl);
    if (!checkValidation.valid) {
      return { verified: false, error: "SSRF validation failed for verification URL." };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(verifyUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "PulseScanner/1.0" },
      });
      clearTimeout(timer);
      if (!res.ok) {
        return { verified: false, error: `Verification file returned HTTP ${res.status}.` };
      }
      const text = (await res.text()).trim();
      if (text.includes(expectedToken)) {
        return { verified: true };
      }
      return { verified: false, error: "Verification token not found in /.well-known/pulse-verify.txt." };
    } catch {
      clearTimeout(timer);
      return { verified: false, error: "Could not fetch /.well-known/pulse-verify.txt." };
    }
  }

  // DNS TXT verification at _pulse-verify.<domain>
  try {
    const txtHost = `_pulse-verify.${parsed.hostname}`;
    const records = await dns.resolveTxt(txtHost);
    const flat = records.map((r) => r.join("")).join("\n");
    if (flat.includes(expectedToken)) {
      return { verified: true };
    }
    return { verified: false, error: `Token not found in DNS TXT record for ${txtHost}.` };
  } catch {
    return { verified: false, error: `No DNS TXT record found at _pulse-verify.${parsed.hostname}.` };
  }
}
