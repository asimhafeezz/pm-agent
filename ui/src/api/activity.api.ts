import { apiUrl } from "@/lib/api";

export interface ActivityEvent {
  id: string;
  projectId?: string;
  userId?: string;
  source: string;
  eventType: string;
  externalId?: string;
  title?: string;
  summary?: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  occurredAt?: string;
}

export interface ActivityStreamResponse {
  events: ActivityEvent[];
  total: number;
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

export async function fetchActivityStream(
  token: string,
  params?: {
    projectId?: string;
    source?: string;
    eventType?: string;
    since?: string;
    limit?: number;
    offset?: number;
  },
): Promise<ActivityStreamResponse> {
  const qs = new URLSearchParams();
  if (params?.projectId) qs.set("projectId", params.projectId);
  if (params?.source) qs.set("source", params.source);
  if (params?.eventType) qs.set("eventType", params.eventType);
  if (params?.since) qs.set("since", params.since);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));

  const query = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetch(apiUrl(`/api/activity${query}`), {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to fetch activity: ${res.status}`);
  const json = await res.json();
  return unwrap<ActivityStreamResponse>(json);
}

export async function createActivityEvent(
  token: string,
  event: {
    source: string;
    eventType: string;
    title?: string;
    summary?: string;
    projectId?: string;
    externalId?: string;
    payload?: Record<string, unknown>;
  },
): Promise<ActivityEvent> {
  const res = await fetch(apiUrl("/api/activity"), {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(`Failed to create activity event: ${res.status}`);
  const json = await res.json();
  return unwrap<ActivityEvent>(json);
}
