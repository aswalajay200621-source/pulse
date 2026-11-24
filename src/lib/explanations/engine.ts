import {
  EXPLANATION_RULES,
  type ExplanationCategory,
  type ExplanationRule,
  type ExplanationSeverity,
} from "./rules";

export interface FindingInput {
  ruleId?: string | null;
  category?: string | null;
  source?: string | null;
  severity?: string | null;
  title?: string | null;
  description?: string | null;
  remediation?: string | null;
  affectedResource?: string | null;
  filePath?: string | null;
  packageName?: string | null;
  fixedVersion?: string | null;
  timestamp?: string | null;
}

export interface ExplainedFinding {
  ruleId: string;
  category: ExplanationCategory | "general";
  title: string;
  /** Preserves scanner-provided severity when available; never exaggerates. */
  severity: ExplanationSeverity;
  whatHappened: string;
  whyItMatters: string;
  whatCouldHappen: string;
  howToFix: string;
  technicalDetails: string;
  detectionSource: string;
  affectedTarget: string | null;
  timestamp: string | null;
  documentationUrl: string | null;
  isFallback: boolean;
}

const VALID_SEVERITIES = new Set<ExplanationSeverity>([
  "critical",
  "high",
  "medium",
  "low",
  "informational",
]);

function normalizeSeverity(
  scannerSeverity?: string | null,
  ruleSeverity?: ExplanationSeverity
): ExplanationSeverity {
  if (scannerSeverity) {
    const lower = scannerSeverity.toLowerCase() as ExplanationSeverity;
    if (VALID_SEVERITIES.has(lower)) return lower;
  }
  return ruleSeverity ?? "informational";
}

function findMatchingRule(input: FindingInput): ExplanationRule | null {
  // 1. Exact ruleId match
  if (input.ruleId) {
    const byId = EXPLANATION_RULES.find((r) => r.ruleId === input.ruleId);
    if (byId) return byId;
  }

  // 2. Heuristic match for dependency findings
  if (input.source === "dependency_scan" || input.category === "vulnerable_dependency") {
    return (
      EXPLANATION_RULES.find((r) =>
        input.fixedVersion ? r.ruleId === "dep-vuln-with-fix" : r.ruleId === "dep-vuln-no-fix"
      ) ?? null
    );
  }

  // 3. Heuristic match by category
  if (input.category) {
    const byCat = EXPLANATION_RULES.find((r) => r.category === input.category);
    if (byCat) return byCat;
  }

  return null;
}

/**
 * Deterministic, rule-based explanation engine.
 * Translates technical monitoring/security findings into beginner-friendly
 * explanations while preserving original scanner severity and technical details.
 */
export function explainFinding(input: FindingInput): ExplainedFinding {
  const rule = findMatchingRule(input);
  const affectedTarget =
    input.affectedResource ||
    input.filePath ||
    (input.packageName ? `${input.packageName}` : null);

  if (rule) {
    return {
      ruleId: rule.ruleId,
      category: rule.category,
      title: input.title || rule.title,
      severity: normalizeSeverity(input.severity, rule.severity),
      whatHappened: rule.plainExplanation,
      whyItMatters: rule.whyItMatters,
      whatCouldHappen: rule.possibleConsequences,
      howToFix: input.remediation || rule.recommendedFix,
      technicalDetails: input.description || rule.technicalDescription,
      detectionSource: input.source || rule.detectionSource,
      affectedTarget,
      timestamp: input.timestamp ?? null,
      documentationUrl: rule.documentationUrl ?? null,
      isFallback: false,
    };
  }

  // Safe fallback for unsupported/unknown findings
  return {
    ruleId: input.ruleId || "pulse-generic-finding",
    category: "general",
    title: input.title || "Security or Monitoring Finding",
    severity: normalizeSeverity(input.severity, "informational"),
    whatHappened:
      "Pulse detected a potential issue that does not have a specialized plain-language guide yet.",
    whyItMatters:
      "Reviewing reported issues helps keep your application reliable and secure.",
    whatCouldHappen:
      "Impact depends on the specific configuration or component affected; see the technical details below.",
    howToFix:
      input.remediation ||
      "Review the technical details and affected resource, and consult your platform or package documentation.",
    technicalDetails:
      input.description || "No additional technical details were provided by the scanner.",
    detectionSource: input.source || "Pulse Scanner",
    affectedTarget,
    timestamp: input.timestamp ?? null,
    documentationUrl: null,
    isFallback: true,
  };
}
