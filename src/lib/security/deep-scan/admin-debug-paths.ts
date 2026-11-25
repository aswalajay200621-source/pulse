import type { DeepScanClient } from "./scanner-client";
import type { DeepScanFinding } from "./types";

interface AdminDebugTarget {
  path: string;
  severity: "high" | "medium";
  title: string;
  signature: (body: string, ct: string) => boolean;
}

const TARGETS: AdminDebugTarget[] = [
  {
    path: "/admin",
    severity: "high",
    title: "Admin Interface Reachable Without Login",
    signature: (b) => /(admin dashboard|user management|site administration)/i.test(b) && !/(login|sign in|password)/i.test(b),
  },
  {
    path: "/debug",
    severity: "high",
    title: "Debug Endpoint Exposed",
    signature: (b) => /(stack trace|debug mode|environment variables|pprof)/i.test(b),
  },
  {
    path: "/swagger",
    severity: "medium",
    title: "Swagger API Documentation Exposed",
    signature: (b) => b.includes("swagger-ui") || b.includes("SwaggerUIBundle"),
  },
  {
    path: "/api-docs",
    severity: "medium",
    title: "OpenAPI / Swagger Docs Exposed",
    signature: (b, ct) =>
      b.includes("swagger-ui") || (ct.includes("json") && (b.includes('"openapi"') || b.includes('"swagger"'))),
  },
  {
    path: "/graphql?query=%7B__schema%7Btypes%7Bname%7D%7D%7D",
    severity: "medium",
    title: "GraphQL Introspection Enabled",
    signature: (b) => b.includes('"__schema"') && b.includes('"types"'),
  },
  {
    path: "/actuator",
    severity: "high",
    title: "Spring Boot Actuator Endpoint Exposed",
    signature: (b, ct) => ct.includes("json") && b.includes('"_links"') && b.includes("health"),
  },
];

export async function checkAdminDebugPaths(client: DeepScanClient): Promise<DeepScanFinding[]> {
  const findings: DeepScanFinding[] = [];

  for (const target of TARGETS) {
    if (client.isBudgetExhausted()) break;
    const res = await client.request(target.path, { method: "GET", followRedirects: false });
    if (!res || res.status !== 200) continue;

    const ct = res.headers["content-type"] || "";
    if (target.signature(res.body, ct)) {
      findings.push({
        ruleId: "deep-admin-debug-exposed",
        severity: target.severity,
        title: target.title,
        evidence: `Confirmed signature at ${target.path} (HTTP 200).`,
        affectedUrl: res.finalUrl,
        findingKey: `deep:admin-debug:${target.path.split("?")[0]}`,
      });
    }
  }

  return findings;
}
