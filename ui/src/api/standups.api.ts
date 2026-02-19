import { apiUrl } from "@/lib/api";

export interface StandupResponse {
  id: string;
  projectId: string;
  respondent: string;
  respondentUserId?: string;
  rawText: string;
  yesterday?: string;
  today?: string;
  blockers?: string;
  respondedAt: string;
  source: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface StandupSummary {
  summary: string;
  memberSummaries?: {
    respondent: string;
    yesterday: string;
    today: string;
    blockers: string | null;
    status: "on_track" | "at_risk" | "blocked";
  }[];
  teamBlockers?: {
    description: string;
    severity: string;
    reporter: string;
    suggestedAction: string;
  }[];
  discrepancies?: {
    description: string;
    reporter: string;
  }[];
  actionItems?: string[];
  responses?: StandupResponse[];
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchStandupResponses(
  projectId: string,
  token: string,
  options?: { since?: string; limit?: number },
): Promise<StandupResponse[]> {
  const params = new URLSearchParams();
  if (options?.since) params.set("since", options.since);
  if (options?.limit) params.set("limit", String(options.limit));
  const query = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(
    apiUrl(`/api/projects/${projectId}/standups/responses${query}`),
    { headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(`Failed to fetch standup responses: ${res.status}`);
  return res.json();
}

export async function fetchTodayStandups(
  projectId: string,
  token: string,
): Promise<StandupResponse[]> {
  const res = await fetch(
    apiUrl(`/api/projects/${projectId}/standups/today`),
    { headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(`Failed to fetch today's standups: ${res.status}`);
  return res.json();
}

export async function fetchStandupSummary(
  projectId: string,
  token: string,
): Promise<StandupSummary> {
  const res = await fetch(
    apiUrl(`/api/projects/${projectId}/standups/summary`),
    { headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(`Failed to fetch standup summary: ${res.status}`);
  return res.json();
}
