import { apiUrl } from "@/lib/api";

type Wrapped<T> = { success?: boolean; data?: T } | T;

function unwrap<T>(payload: Wrapped<T>): T {
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

export interface LinearViewer {
  id: string;
  name: string;
  email: string;
}

export interface LinearTeam {
  id: string;
  key: string;
  name: string;
}

export interface LinearProject {
  id: string;
  name: string;
  slugId?: string;
}

export interface LinearUser {
  id: string;
  name: string;
  email?: string;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchLinearViewer(token: string): Promise<LinearViewer | null> {
  const res = await fetch(apiUrl("/api/integrations/linear/viewer"), {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Linear viewer failed: ${res.status}`);
  const payload = await res.json();
  const data = unwrap<{ viewer?: LinearViewer }>(payload);
  return data?.viewer ?? null;
}

export async function fetchLinearTeams(token: string, first = 50): Promise<LinearTeam[]> {
  const res = await fetch(
    apiUrl(`/api/integrations/linear/teams?first=${first}`),
    { headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(`Linear teams failed: ${res.status}`);
  const payload = await res.json();
  const data = unwrap<{ teams?: { nodes?: LinearTeam[] } }>(payload);
  return data?.teams?.nodes ?? [];
}

export async function fetchLinearProjects(params: {
  token: string;
  teamId?: string;
  first?: number;
}): Promise<LinearProject[]> {
  const search = new URLSearchParams();
  search.set("first", String(params.first ?? 50));
  if (params.teamId) search.set("teamId", params.teamId);
  const res = await fetch(
    apiUrl(`/api/integrations/linear/projects?${search.toString()}`),
    { headers: authHeaders(params.token) },
  );
  if (!res.ok) throw new Error(`Linear projects failed: ${res.status}`);
  const payload = await res.json();
  const data = unwrap<{ projects?: { nodes?: LinearProject[] } }>(payload);
  return data?.projects?.nodes ?? [];
}

export async function fetchLinearUsers(params: {
  token: string;
  query?: string;
  first?: number;
}): Promise<LinearUser[]> {
  const search = new URLSearchParams();
  search.set("first", String(params.first ?? 50));
  if (params.query) search.set("query", params.query);
  const res = await fetch(
    apiUrl(`/api/integrations/linear/users?${search.toString()}`),
    { headers: authHeaders(params.token) },
  );
  if (!res.ok) throw new Error(`Linear users failed: ${res.status}`);
  const payload = await res.json();
  const data = unwrap<{ users?: { nodes?: LinearUser[] } }>(payload);
  return data?.users?.nodes ?? [];
}

export async function fetchLinearSyncSummary(
  token: string,
  params: { teamId?: string; projectId?: string; staleHours?: number } = {},
): Promise<{
  total: number;
  blocked: number;
  overdue: number;
  stale: number;
  completionPct: number;
}> {
  const search = new URLSearchParams();
  if (params.teamId) search.set("teamId", params.teamId);
  if (params.projectId) search.set("projectId", params.projectId);
  if (params.staleHours !== undefined) {
    search.set("staleHours", String(params.staleHours));
  }
  const res = await fetch(
    apiUrl(`/api/integrations/linear/sync-summary${search.toString() ? `?${search.toString()}` : ""}`),
    { headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(`Linear sync summary failed: ${res.status}`);
  const payload = await res.json();
  return unwrap(payload) as {
    total: number;
    blocked: number;
    overdue: number;
    stale: number;
    completionPct: number;
  };
}
