import { apiUrl } from "@/lib/api";

export interface MeetingInsight {
  id: string;
  meetingId: string;
  insightType: "action_item" | "decision" | "blocker" | "follow_up" | "status_update";
  content: string;
  assignee?: string;
  linearIssueId?: string;
  priority?: string;
  dueDate?: string;
  status: "pending" | "linked" | "created" | "dismissed";
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Meeting {
  id: string;
  projectId: string;
  createdById: string;
  title: string;
  meetingDate?: string;
  rawTranscript: string;
  status: "pending" | "processing" | "processed" | "failed";
  source: string;
  durationMinutes?: number;
  processingError?: string;
  insightCount: number;
  metadata?: Record<string, unknown>;
  insights?: MeetingInsight[];
  createdAt: string;
  updatedAt: string;
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

export async function fetchMeetings(
  projectId: string,
  token: string,
): Promise<Meeting[]> {
  const res = await fetch(apiUrl(`/api/projects/${projectId}/meetings`), {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to list meetings: ${res.status}`);
  const json = await res.json();
  return unwrap<Meeting[]>(json);
}

export async function fetchMeeting(
  meetingId: string,
  token: string,
): Promise<Meeting> {
  const res = await fetch(apiUrl(`/api/meetings/${meetingId}`), {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to fetch meeting: ${res.status}`);
  const json = await res.json();
  return unwrap<Meeting>(json);
}

export async function createMeeting(
  projectId: string,
  token: string,
  data: {
    title: string;
    rawTranscript: string;
    meetingDate?: string;
    source?: string;
    durationMinutes?: number;
  },
): Promise<Meeting> {
  const res = await fetch(apiUrl(`/api/projects/${projectId}/meetings`), {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create meeting: ${res.status}`);
  const json = await res.json();
  return unwrap<Meeting>(json);
}

export async function deleteMeeting(
  meetingId: string,
  token: string,
): Promise<void> {
  const res = await fetch(apiUrl(`/api/meetings/${meetingId}`), {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to delete meeting: ${res.status}`);
}

export async function reprocessMeeting(
  meetingId: string,
  token: string,
): Promise<Meeting> {
  const res = await fetch(apiUrl(`/api/meetings/${meetingId}/reprocess`), {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to reprocess meeting: ${res.status}`);
  const json = await res.json();
  return unwrap<Meeting>(json);
}

export async function updateInsightStatus(
  meetingId: string,
  insightId: string,
  token: string,
  updates: { status?: string; linearIssueId?: string },
): Promise<MeetingInsight> {
  const res = await fetch(
    apiUrl(`/api/meetings/${meetingId}/insights/${insightId}`),
    {
      method: "PATCH",
      headers: {
        ...authHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    },
  );
  if (!res.ok) throw new Error(`Failed to update insight: ${res.status}`);
  const json = await res.json();
  return unwrap<MeetingInsight>(json);
}
