/**
 * OSV (Open Source Vulnerabilities) Dependency Scanner
 *
 * Fetches vulnerability data from the OSV API for parsed package dependencies.
 * Never invents severity or fixed versions — marks missing fields as null.
 * https://osv.dev/docs/
 */

export type Ecosystem =
  | "npm"
  | "PyPI"
  | "Go"
  | "crates.io"
  | "RubyGems"
  | "Maven"
  | "NuGet";

export interface ParsedPackage {
  name: string;
  version: string;
  ecosystem: Ecosystem;
  manifestFile: string;
}

export interface OsvVulnerability {
  id: string;
  summary: string | null;
  severity: "critical" | "high" | "medium" | "low" | null;
  affectedVersionRange: string | null;
  fixedVersion: string | null;
  reference: string | null;
}

export interface DependencyFinding {
  packageName: string;
  installedVersion: string;
  ecosystem: Ecosystem;
  manifestFile: string;
  vulnerability: OsvVulnerability;
  findingKey: string;
}

/** Parse package.json for direct dependencies */
function parsePackageJson(content: string): ParsedPackage[] {
  try {
    const pkg = JSON.parse(content);
    const deps: ParsedPackage[] = [];
    for (const [name, version] of Object.entries({
      ...pkg.dependencies,
      ...pkg.devDependencies,
    })) {
      const v = String(version).replace(/^[\^~>=<]/, "").split(" ")[0];
      if (v && v !== "*") {
        deps.push({ name, version: v, ecosystem: "npm", manifestFile: "package.json" });
      }
    }
    return deps;
  } catch {
    return [];
  }
}

/** Parse requirements.txt (simple name==version lines) */
function parseRequirementsTxt(content: string): ParsedPackage[] {
  const packages: ParsedPackage[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) continue;
    const match = trimmed.match(/^([A-Za-z0-9_.\-]+)==([A-Za-z0-9._\-+]+)/);
    if (match) {
      packages.push({
        name: match[1],
        version: match[2],
        ecosystem: "PyPI",
        manifestFile: "requirements.txt",
      });
    }
  }
  return packages;
}

/** Parse go.mod for direct module requirements */
function parseGoMod(content: string): ParsedPackage[] {
  const packages: ParsedPackage[] = [];
  let inRequire = false;
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "require (") { inRequire = true; continue; }
    if (inRequire && trimmed === ")") { inRequire = false; continue; }
    const src = inRequire ? trimmed : (trimmed.startsWith("require ") ? trimmed.slice(8) : null);
    if (!src) continue;
    const parts = src.split(/\s+/);
    if (parts.length >= 2 && parts[1].startsWith("v")) {
      packages.push({
        name: parts[0],
        version: parts[1].replace(/^v/, ""),
        ecosystem: "Go",
        manifestFile: "go.mod",
      });
    }
  }
  return packages;
}

/** Parse Cargo.toml [dependencies] section */
function parseCargo(content: string): ParsedPackage[] {
  const packages: ParsedPackage[] = [];
  let inDeps = false;
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "[dependencies]" || trimmed === "[dev-dependencies]") {
      inDeps = true; continue;
    }
    if (trimmed.startsWith("[") && inDeps) { inDeps = false; continue; }
    if (!inDeps) continue;
    const match = trimmed.match(/^([a-z0-9_\-]+)\s*=\s*"([^"]+)"/);
    if (match) {
      packages.push({
        name: match[1],
        version: match[2].replace(/^[\^~>=]/, ""),
        ecosystem: "crates.io",
        manifestFile: "Cargo.toml",
      });
    }
  }
  return packages;
}

export function parseManifest(
  filePath: string,
  content: string
): ParsedPackage[] {
  const name = filePath.split("/").pop() || filePath;
  if (name === "package.json") return parsePackageJson(content);
  if (name === "requirements.txt") return parseRequirementsTxt(content);
  if (name === "go.mod") return parseGoMod(content);
  if (name === "Cargo.toml") return parseCargo(content);
  return [];
}

export const SUPPORTED_MANIFEST_FILES = [
  "package.json",
  "requirements.txt",
  "go.mod",
  "Cargo.toml",
];

/** Map CVSS score to severity label */
function cvssToSeverity(score: number | null): "critical" | "high" | "medium" | "low" | null {
  if (score === null) return null;
  if (score >= 9.0) return "critical";
  if (score >= 7.0) return "high";
  if (score >= 4.0) return "medium";
  return "low";
}

/** Query the OSV batch API for a list of packages */
export async function queryOsvBatch(
  packages: ParsedPackage[],
  timeoutMs = 15000
): Promise<DependencyFinding[]> {
  if (packages.length === 0) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const queries = packages.map((p) => ({
      package: { name: p.name, ecosystem: p.ecosystem },
      version: p.version,
    }));

    const res = await fetch("https://api.osv.dev/v1/querybatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queries }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      console.error(`[OSV] API returned ${res.status}`);
      return [];
    }

    const data = (await res.json()) as {
      results: Array<{ vulns?: Array<{
        id: string;
        summary?: string;
        database_specific?: { severity?: string };
        severity?: Array<{ type: string; score: string }>;
        affected?: Array<{
          ranges?: Array<{ events?: Array<{ fixed?: string }> }>;
        }>;
        references?: Array<{ url: string }>;
      }> }>;
    };

    const findings: DependencyFinding[] = [];
    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i];
      const result = data.results[i];
      if (!result?.vulns) continue;

      for (const vuln of result.vulns) {
        // Extract CVSS score for severity
        const cvssEntry = vuln.severity?.find((s) => s.type === "CVSS_V3" || s.type === "CVSS_V2");
        const cvssScore = cvssEntry ? parseFloat(cvssEntry.score) : null;
        const dbSeverity = vuln.database_specific?.severity?.toLowerCase();

        let severity: "critical" | "high" | "medium" | "low" | null = null;
        if (dbSeverity === "critical") severity = "critical";
        else if (dbSeverity === "high") severity = "high";
        else if (dbSeverity === "moderate" || dbSeverity === "medium") severity = "medium";
        else if (dbSeverity === "low") severity = "low";
        else severity = cvssToSeverity(isNaN(cvssScore!) ? null : cvssScore);

        // Extract fixed version (first fix event found)
        let fixedVersion: string | null = null;
        outer: for (const affected of vuln.affected ?? []) {
          for (const range of affected.ranges ?? []) {
            for (const event of range.events ?? []) {
              if (event.fixed) {
                fixedVersion = event.fixed;
                break outer;
              }
            }
          }
        }

        const reference = vuln.references?.[0]?.url ?? null;
        const findingKey = `dep:${pkg.ecosystem}:${pkg.name}:${pkg.version}:${vuln.id}`;

        findings.push({
          packageName: pkg.name,
          installedVersion: pkg.version,
          ecosystem: pkg.ecosystem,
          manifestFile: pkg.manifestFile,
          vulnerability: {
            id: vuln.id,
            summary: vuln.summary ?? null,
            severity,
            affectedVersionRange: null, // OSV ranges are complex; keep it null
            fixedVersion,
            reference,
          },
          findingKey,
        });
      }
    }

    return findings;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[OSV] Query timed out");
    } else {
      console.error("[OSV] Query failed:", err);
    }
    return [];
  }
}
