import { apiUrl } from "@/lib/api";

export interface KnowledgeEntityItem {
  id: string;
  projectId: string;
  name: string;
  type: string;
  description?: string;
  properties?: Record<string, unknown>;
  sourceDocumentIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeRelationItem {
  id: string;
  projectId: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationType: string;
  strength: number;
  evidence?: string;
  createdAt: string;
}

export interface KnowledgeGraph {
  entities: KnowledgeEntityItem[];
  relations: KnowledgeRelationItem[];
}

export interface KnowledgeSummary {
  entityCount: number;
  relationCount: number;
  byType: Record<string, number>;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

function unwrap(data: unknown): unknown {
  if (data && typeof data === "object" && "data" in data) {
    return (data as Record<string, unknown>).data;
  }
  return data;
}

export async function fetchKnowledgeEntities(
  projectId: string,
  token: string,
  type?: string
): Promise<KnowledgeEntityItem[]> {
  const params = type ? `?type=${type}` : "";
  const res = await fetch(
    apiUrl(`/api/projects/${projectId}/knowledge/entities${params}`),
    { headers: authHeaders(token) }
  );
  if (!res.ok) throw new Error(`Failed to fetch entities: ${res.status}`);
  const json = await res.json();
  const data = unwrap(json);
  return (Array.isArray(data) ? data : []) as KnowledgeEntityItem[];
}

export async function fetchKnowledgeGraph(
  projectId: string,
  token: string
): Promise<KnowledgeGraph> {
  const res = await fetch(
    apiUrl(`/api/projects/${projectId}/knowledge/graph`),
    { headers: authHeaders(token) }
  );
  if (!res.ok) throw new Error(`Failed to fetch graph: ${res.status}`);
  const json = await res.json();
  const data = (unwrap(json) ?? json) as KnowledgeGraph;
  return data;
}

export async function fetchKnowledgeSummary(
  projectId: string,
  token: string
): Promise<KnowledgeSummary> {
  const res = await fetch(
    apiUrl(`/api/projects/${projectId}/knowledge/summary`),
    { headers: authHeaders(token) }
  );
  if (!res.ok) throw new Error(`Failed to fetch summary: ${res.status}`);
  const json = await res.json();
  return (unwrap(json) ?? json) as KnowledgeSummary;
}

export async function triggerKnowledgeExtraction(
  projectId: string,
  documentIds: string[],
  token: string
): Promise<{ status: string }> {
  const res = await fetch(
    apiUrl(`/api/projects/${projectId}/knowledge/extract`),
    {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ documentIds }),
    }
  );
  if (!res.ok) throw new Error(`Extraction failed: ${res.status}`);
  const json = await res.json();
  return (unwrap(json) ?? json) as { status: string };
}
