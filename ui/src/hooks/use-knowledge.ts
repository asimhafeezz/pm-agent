import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import { useProjectStore } from "@/store/project-store";
import {
  fetchKnowledgeEntities,
  fetchKnowledgeGraph,
  fetchKnowledgeSummary,
  triggerKnowledgeExtraction,
  type KnowledgeEntityItem,
  type KnowledgeGraph,
  type KnowledgeSummary,
} from "@/api/knowledge.api";

export function useKnowledgeEntities(type?: string) {
  const { token } = useAuth();
  const activeProject = useProjectStore((s) => s.activeProject);
  const projectId = activeProject?.id;

  return useQuery<KnowledgeEntityItem[]>({
    queryKey: ["knowledge-entities", projectId, type],
    queryFn: () => fetchKnowledgeEntities(projectId!, token!, type),
    enabled: !!projectId && !!token,
  });
}

export function useKnowledgeGraph() {
  const { token } = useAuth();
  const activeProject = useProjectStore((s) => s.activeProject);
  const projectId = activeProject?.id;

  return useQuery<KnowledgeGraph>({
    queryKey: ["knowledge-graph", projectId],
    queryFn: () => fetchKnowledgeGraph(projectId!, token!),
    enabled: !!projectId && !!token,
  });
}

export function useKnowledgeSummary() {
  const { token } = useAuth();
  const activeProject = useProjectStore((s) => s.activeProject);
  const projectId = activeProject?.id;

  return useQuery<KnowledgeSummary>({
    queryKey: ["knowledge-summary", projectId],
    queryFn: () => fetchKnowledgeSummary(projectId!, token!),
    enabled: !!projectId && !!token,
  });
}

export function useExtractKnowledge() {
  const { token } = useAuth();
  const activeProject = useProjectStore((s) => s.activeProject);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (documentIds: string[]) =>
      triggerKnowledgeExtraction(activeProject!.id, documentIds, token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge-entities", activeProject?.id] });
      qc.invalidateQueries({ queryKey: ["knowledge-graph", activeProject?.id] });
      qc.invalidateQueries({ queryKey: ["knowledge-summary", activeProject?.id] });
    },
  });
}
