export interface DeepScanFinding {
  ruleId: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  evidence: string;
  affectedUrl: string;
  findingKey: string;
}

export interface DeepScanResponse {
  status: number;
  headers: Record<string, string>;
  setCookies: string[];
  body: string;
  finalUrl: string;
}
