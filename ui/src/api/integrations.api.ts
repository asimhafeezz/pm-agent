import { apiUrl } from "@/lib/api";

export type IntegrationProvider = "linear" | "notion" | "google-docs" | "gmail" | "slack";

export interface IntegrationStatus {
  provider: IntegrationProvider;
  connected: boolean;
  metadata?: Record<string, unknown> | null;
  updatedAt?: string | null;
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

export async function fetchIntegrationStatuses(token: string): Promise<IntegrationStatus[]> {
  const res = await fetch(apiUrl("/api/integrations"), {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to list integrations: ${res.status}`);
  const json = await res.json();
  return unwrap<IntegrationStatus[]>(json);
}

export async function fetchIntegrationStatus(
  provider: IntegrationProvider,
  token: string,
): Promise<IntegrationStatus> {
  const res = await fetch(apiUrl(`/api/integrations/${provider}/status`), {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to fetch ${provider} status: ${res.status}`);
  const json = await res.json();
  return unwrap<IntegrationStatus>(json);
}

export async function connectIntegrationToken(
  provider: IntegrationProvider,
  accessToken: string,
  token: string,
  metadata?: Record<string, unknown>,
): Promise<IntegrationStatus> {
  const res = await fetch(apiUrl(`/api/integrations/${provider}/connect-token`), {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ accessToken, metadata }),
  });
  if (!res.ok) throw new Error(`Failed to connect ${provider}: ${res.status}`);
  const json = await res.json();
  return unwrap<IntegrationStatus>(json);
}

export async function startIntegrationOAuth(
  provider: IntegrationProvider,
  token: string,
  redirectUri: string,
): Promise<{ provider: IntegrationProvider; authorizationUrl: string }> {
  const search = new URLSearchParams({ redirectUri });
  const res = await fetch(apiUrl(`/api/integrations/${provider}/oauth/start?${search.toString()}`), {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to start ${provider} OAuth: ${res.status}`);
  const json = await res.json();
  return unwrap<{ provider: IntegrationProvider; authorizationUrl: string }>(json);
}

export async function completeIntegrationOAuth(
  token: string,
  payload: {
    code: string;
    state: string;
    redirectUri: string;
    provider?: IntegrationProvider;
  },
): Promise<IntegrationStatus> {
  const res = await fetch(apiUrl('/api/integrations/oauth/callback'), {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to complete OAuth callback: ${res.status}`);
  const json = await res.json();
  return unwrap<IntegrationStatus>(json);
}

export async function disconnectIntegration(
  provider: IntegrationProvider,
  token: string,
): Promise<{ disconnected: boolean }> {
  const res = await fetch(apiUrl(`/api/integrations/${provider}`), {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to disconnect ${provider}: ${res.status}`);
  const json = await res.json();
  return unwrap<{ disconnected: boolean }>(json);
}
