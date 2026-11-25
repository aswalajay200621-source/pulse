import type { DeepScanClient } from "./scanner-client";
import type { DeepScanFinding } from "./types";

interface SensitiveFileTarget {
  path: string;
  severity: "critical" | "high" | "medium";
  title: string;
  signature: (body: string, contentType: string) => boolean;
}

function maskLineSecrets(text: string): string {
  return text.replace(
    /(password|secret|key|token|pwd|api_key|auth)\s*[:=]\s*([^\s'"]+)/gi,
    (_, k, v) => `${k}=${v.slice(0, 2)}****`
  );
}

const TARGETS: SensitiveFileTarget[] = [
  {
    path: "/.env",
    severity: "critical",
    title: "Exposed .env Environment File",
    signature: (b) => /^[A-Z0-9_]+=.+/m.test(b) && !b.trimStart().startsWith("<"),
  },
  {
    path: "/.git/config",
    severity: "critical",
    title: "Exposed .git/config Repository File",
    signature: (b) => b.includes("[core]") && b.includes("repositoryformatversion"),
  },
  {
    path: "/.git/HEAD",
    severity: "high",
    title: "Exposed .git/HEAD Repository File",
    signature: (b) => /^ref:\s+refs\//m.test(b.trim()) || /^[0-9a-f]{40}$/i.test(b.trim()),
  },
  {
    path: "/.env.bak",
    severity: "critical",
    title: "Exposed .env.bak Backup File",
    signature: (b) => /^[A-Z0-9_]+=.+/m.test(b) && !b.trimStart().startsWith("<"),
  },
  {
    path: "/backup.sql",
    severity: "critical",
    title: "Exposed SQL Backup File",
    signature: (b) => /(CREATE TABLE|INSERT INTO|DROP TABLE|-- MySQL dump|-- PostgreSQL)/i.test(b),
  },
  {
    path: "/backup.zip",
    severity: "high",
    title: "Exposed Archive Backup File",
    signature: (b, ct) => ct.includes("application/zip") || b.startsWith("PK\x03\x04"),
  },
  {
    path: "/config.json",
    severity: "high",
    title: "Exposed config.json File",
    signature: (b, ct) =>
      (ct.includes("json") || b.trimStart().startsWith("{")) &&
      /(apiKey|secret|password|database|connectionString)/i.test(b),
  },
  {
    path: "/phpinfo.php",
    severity: "medium",
    title: "Exposed phpinfo() Diagnostic Page",
    signature: (b) => b.includes("PHP Version") && b.includes("phpinfo()"),
  },
  {
    path: "/server-status",
    severity: "medium",
    title: "Exposed Apache Server Status Page",
    signature: (b) => b.includes("Apache Server Status") || b.includes("Total accesses:"),
  },
  {
    path: "/package.json",
    severity: "medium",
    title: "Exposed package.json Manifest",
    signature: (b) => {
      try {
        const j = JSON.parse(b);
        return typeof j.name === "string" && (!!j.dependencies || !!j.devDependencies || !!j.scripts);
      } catch {
        return false;
      }
    },
  },
];

export async function checkSensitiveFiles(client: DeepScanClient): Promise<DeepScanFinding[]> {
  const findings: DeepScanFinding[] = [];

  for (const target of TARGETS) {
    if (client.isBudgetExhausted()) break;
    const res = await client.request(target.path, { method: "GET", followRedirects: false });
    if (!res || res.status !== 200) continue;

    const ct = res.headers["content-type"] || "";
    if (target.signature(res.body, ct)) {
      const snippet = maskLineSecrets(res.body.slice(0, 140).replace(/\s+/g, " ").trim());
      findings.push({
        ruleId: "deep-exposed-sensitive-file",
        severity: target.severity,
        title: target.title,
        evidence: `Confirmed content signature at ${target.path} (snippet: "${snippet}...")`,
        affectedUrl: res.finalUrl,
        findingKey: `deep:sensitive-file:${target.path}`,
      });
    }
  }

  return findings;
}
