import { apiUrl } from "@/lib/api";

export interface DocumentItem {
  id: string;
  projectId: string;
  uploadedById: string;
  title: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  s3Key: string;
  status: "pending" | "processing" | "processed" | "failed";
  processingError?: string;
  chunkCount: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalGoogleDocItem {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
}

export interface ExternalNotionPageItem {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function unwrap(data: unknown): unknown {
  if (data && typeof data === "object" && "data" in data) {
    return (data as Record<string, unknown>).data;
  }
  return data;
}

async function toErrorMessage(res: Response, fallback: string): Promise<string> {
  const bodyText = await res.text().catch(() => "");
  if (!bodyText) return `${fallback}: ${res.status}`;
  try {
    const parsed = JSON.parse(bodyText) as Record<string, unknown>;
    const payload = (unwrap(parsed) ?? parsed) as Record<string, unknown>;
    const message = String(payload?.message || "").trim();
    return message || `${fallback}: ${res.status}`;
  } catch {
    return `${fallback}: ${res.status}`;
  }
}

export async function fetchDocuments(
  projectId: string,
  token: string
): Promise<DocumentItem[]> {
  const res = await fetch(
    apiUrl(`/api/projects/${projectId}/documents`),
    { headers: authHeaders(token) }
  );
  if (!res.ok) throw new Error(`Failed to fetch documents: ${res.status}`);
  const json = await res.json();
  const data = unwrap(json);
  return (Array.isArray(data) ? data : []) as DocumentItem[];
}

export async function uploadDocument(
  projectId: string,
  file: File,
  title: string,
  token: string
): Promise<DocumentItem> {
  const form = new FormData();
  form.append("file", file);
  form.append("title", title || file.name);

  const res = await fetch(
    apiUrl(`/api/projects/${projectId}/documents`),
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const json = await res.json();
  return (unwrap(json) ?? json) as DocumentItem;
}

export async function deleteDocument(
  id: string,
  token: string
): Promise<void> {
  const res = await fetch(apiUrl(`/api/documents/${id}`), {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

export async function reprocessDocument(
  id: string,
  token: string
): Promise<DocumentItem> {
  const res = await fetch(apiUrl(`/api/documents/${id}/reprocess`), {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Reprocess failed: ${res.status}`);
  const json = await res.json();
  return (unwrap(json) ?? json) as DocumentItem;
}

export async function importNotionDocument(
  projectId: string,
  page: string,
  token: string,
  title?: string
): Promise<DocumentItem> {
  const res = await fetch(apiUrl(`/api/projects/${projectId}/documents/import/notion`), {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ page, title }),
  });
  if (!res.ok) throw new Error(await toErrorMessage(res, "Notion import failed"));
  const json = await res.json();
  return (unwrap(json) ?? json) as DocumentItem;
}

export async function importGoogleDocument(
  projectId: string,
  document: string,
  token: string,
  title?: string
): Promise<DocumentItem> {
  const res = await fetch(apiUrl(`/api/projects/${projectId}/documents/import/google-doc`), {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ document, title }),
  });
  if (!res.ok) throw new Error(await toErrorMessage(res, "Google Doc import failed"));
  const json = await res.json();
  return (unwrap(json) ?? json) as DocumentItem;
}

export async function searchGoogleDocs(
  query: string,
  token: string,
  limit = 20
): Promise<ExternalGoogleDocItem[]> {
  const qs = new URLSearchParams();
  if (query.trim()) qs.set("q", query.trim());
  qs.set("limit", String(limit));
  const res = await fetch(
    apiUrl(`/api/integrations/document-sources/google-docs/search?${qs.toString()}`),
    { headers: authHeaders(token) }
  );
  if (!res.ok) throw new Error(await toErrorMessage(res, "Google Docs search failed"));
  const json = await res.json();
  const payload = (unwrap(json) ?? json) as { items?: ExternalGoogleDocItem[] };
  return Array.isArray(payload.items) ? payload.items : [];
}

export async function searchNotionPages(
  query: string,
  token: string,
  limit = 20
): Promise<ExternalNotionPageItem[]> {
  const qs = new URLSearchParams();
  if (query.trim()) qs.set("q", query.trim());
  qs.set("limit", String(limit));
  const res = await fetch(
    apiUrl(`/api/integrations/document-sources/notion/search?${qs.toString()}`),
    { headers: authHeaders(token) }
  );
  if (!res.ok) throw new Error(await toErrorMessage(res, "Notion search failed"));
  const json = await res.json();
  const payload = (unwrap(json) ?? json) as { items?: ExternalNotionPageItem[] };
  return Array.isArray(payload.items) ? payload.items : [];
}

export async function fetchDocumentSourceHealth(
  provider: "notion" | "google-docs",
  token: string,
): Promise<{ provider: string; configured: boolean; reason?: string }> {
  const res = await fetch(apiUrl(`/api/integrations/${provider}/status`), {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Source status failed: ${res.status}`);
  const json = await res.json();
  const status = (unwrap(json) ?? json) as {
    provider: string;
    connected: boolean;
  };
  return {
    provider: status.provider,
    configured: Boolean(status.connected),
    reason: status.connected ? undefined : "Integration is not connected",
  };
}
