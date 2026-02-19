import { apiUrl } from "@/lib/api";

export type RiskSeverity = "critical" | "high" | "medium" | "low";
export type RiskStatus = "open" | "acknowledged" | "mitigated" | "resolved";
export type RiskType =
  | "blocker_aging"
  | "velocity_decline"
  | "scope_creep"
  | "dependency_risk"
  | "unresolved_action";

export interface RiskAssessment {
  id: string;
  projectId: string;
  riskType: RiskType;
  severity: RiskSeverity;
  description: string;
  mitigation?: string;
  evidence?: Record<string, unknown>;
  status: RiskStatus;
  linkedIssueId?: string;
  detectedAt: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklySummary {
  id: string;
  projectId: string;
  executiveSummary: string;
  metrics?: Record<string, unknown>;
  highlights?: Array<{ title: string; description: string }>;
  risks?: Array<{ description: string; severity: string; mitigation: string }>;
  recommendations?: Array<{ action: string; priority: string; reason: string }>;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

export interface IntelligenceDashboard {
  risks: RiskAssessment[];
  criticalCount: number;
  highCount: number;
  latestSummary: WeeklySummary | null;
}

export interface StakeholderUpdate {
  subject: string;
  body: string;
  audience: string;
  keyPoints: string[];
}

export interface PrioritizationResult {
  items: Array<{
    id: string;
    title: string;
    riceScore: number;
    reach: number;
    impact: number;
    confidence: number;
    effort: number;
    wsjfScore?: number;
    rationale: string;
    recommendation: string;
  }>;
  summary: string;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

function unwrap<T>(payload: unknown): T {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    (payload as { data?: T }).data !== undefined
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

// Risks

export async function fetchRisks(
  projectId: string,
  token: string,
  params?: { status?: RiskStatus; severity?: RiskSeverity },
): Promise<RiskAssessment[]> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.severity) sp.set("severity", params.severity);
  const qs = sp.toString() ? `?${sp.toString()}` : "";
  const res = await fetch(
    apiUrl(`/api/projects/${projectId}/intelligence/risks${qs}`),
    { headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(`Failed to fetch risks: ${res.status}`);
  const json = await res.json();
  return unwrap<RiskAssessment[]>(json);
}

export async function updateRiskStatus(
  riskId: string,
  token: string,
  data: { status: RiskStatus; resolvedAt?: string },
): Promise<RiskAssessment> {
  const res = await fetch(apiUrl(`/api/intelligence/risks/${riskId}`), {
    method: "PATCH",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update risk: ${res.status}`);
  const json = await res.json();
  return unwrap<RiskAssessment>(json);
}

export async function triggerRiskDetection(
  projectId: string,
  token: string,
): Promise<void> {
  const res = await fetch(
    apiUrl(`/api/projects/${projectId}/intelligence/detect-risks`),
    { method: "POST", headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(`Failed to trigger risk detection: ${res.status}`);
}

// Summaries

export async function fetchSummaries(
  projectId: string,
  token: string,
): Promise<WeeklySummary[]> {
  const res = await fetch(
    apiUrl(`/api/projects/${projectId}/intelligence/summaries`),
    { headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(`Failed to fetch summaries: ${res.status}`);
  const json = await res.json();
  return unwrap<WeeklySummary[]>(json);
}

export async function triggerSummaryGeneration(
  projectId: string,
  token: string,
): Promise<void> {
  const res = await fetch(
    apiUrl(`/api/projects/${projectId}/intelligence/generate-summary`),
    { method: "POST", headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(`Failed to trigger summary generation: ${res.status}`);
}

// Dashboard

export async function fetchIntelligenceDashboard(
  projectId: string,
  token: string,
): Promise<IntelligenceDashboard> {
  const res = await fetch(
    apiUrl(`/api/projects/${projectId}/intelligence/dashboard`),
    { headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(`Failed to fetch dashboard: ${res.status}`);
  const json = await res.json();
  return unwrap<IntelligenceDashboard>(json);
}

// Stakeholder Updates (via agent)

export async function generateStakeholderUpdate(
  projectId: string,
  token: string,
  audience: "executive" | "engineering" | "stakeholder",
): Promise<StakeholderUpdate> {
  const res = await fetch(apiUrl("/agent/intelligence/stakeholder-update"), {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, audience, auth_token: token }),
  });
  if (!res.ok) throw new Error(`Failed to generate stakeholder update: ${res.status}`);
  const json = await res.json();
  return unwrap<StakeholderUpdate>(json);
}

// Prioritization (via agent)

export async function runPrioritization(
  projectId: string,
  token: string,
): Promise<PrioritizationResult> {
  const res = await fetch(apiUrl("/agent/intelligence/prioritize"), {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, auth_token: token }),
  });
  if (!res.ok) throw new Error(`Failed to run prioritization: ${res.status}`);
  const json = await res.json();
  return unwrap<PrioritizationResult>(json);
}
