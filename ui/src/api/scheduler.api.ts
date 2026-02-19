import { apiUrl } from "@/lib/api";

export type JobType = "standup" | "sprint_digest" | "blocker_check" | "risk_detection" | "weekly_summary";

export interface ScheduledJob {
  id: string;
  projectId: string;
  userId: string;
  jobType: JobType;
  cronExpression: string;
  isActive: boolean;
  config: Record<string, unknown>;
  lastRunAt?: string | null;
  lastRunStatus?: string | null;
  createdAt: string;
  updatedAt: string;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchScheduledJobs(
  projectId: string,
  token: string,
): Promise<ScheduledJob[]> {
  const res = await fetch(apiUrl(`/api/scheduler/jobs?projectId=${projectId}`), {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to list jobs: ${res.status}`);
  return res.json();
}

export async function createScheduledJob(
  token: string,
  data: {
    projectId: string;
    jobType: JobType;
    cronExpression: string;
    config?: Record<string, unknown>;
  },
): Promise<ScheduledJob> {
  const res = await fetch(apiUrl("/api/scheduler/jobs"), {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create job: ${res.status}`);
  return res.json();
}

export async function updateScheduledJob(
  jobId: string,
  token: string,
  data: Partial<{ cronExpression: string; isActive: boolean; config: Record<string, unknown> }>,
): Promise<ScheduledJob> {
  const res = await fetch(apiUrl(`/api/scheduler/jobs/${jobId}`), {
    method: "PATCH",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update job: ${res.status}`);
  return res.json();
}

export async function deleteScheduledJob(
  jobId: string,
  token: string,
): Promise<void> {
  const res = await fetch(apiUrl(`/api/scheduler/jobs/${jobId}`), {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to delete job: ${res.status}`);
}

export async function triggerJob(
  jobId: string,
  token: string,
): Promise<void> {
  const res = await fetch(apiUrl(`/api/scheduler/jobs/${jobId}/trigger`), {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to trigger job: ${res.status}`);
}
