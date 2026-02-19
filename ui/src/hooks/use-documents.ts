import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import { useProjectStore } from "@/store/project-store";
import {
  fetchDocuments,
  uploadDocument,
  deleteDocument,
  reprocessDocument,
  importNotionDocument,
  importGoogleDocument,
  searchGoogleDocs,
  searchNotionPages,
  fetchDocumentSourceHealth,
  type DocumentItem,
  type ExternalGoogleDocItem,
  type ExternalNotionPageItem,
} from "@/api/documents.api";

export function useDocuments() {
  const { token } = useAuth();
  const activeProject = useProjectStore((s) => s.activeProject);
  const projectId = activeProject?.id;

  return useQuery<DocumentItem[]>({
    queryKey: ["documents", projectId],
    queryFn: () => fetchDocuments(projectId!, token!),
    enabled: !!projectId && !!token,
  });
}

export function useUploadDocument() {
  const { token } = useAuth();
  const activeProject = useProjectStore((s) => s.activeProject);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ file, title }: { file: File; title: string }) =>
      uploadDocument(activeProject!.id, file, title, token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", activeProject?.id] });
    },
  });
}

export function useDeleteDocument() {
  const { token } = useAuth();
  const activeProject = useProjectStore((s) => s.activeProject);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteDocument(id, token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", activeProject?.id] });
    },
  });
}

export function useReprocessDocument() {
  const { token } = useAuth();
  const activeProject = useProjectStore((s) => s.activeProject);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => reprocessDocument(id, token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", activeProject?.id] });
    },
  });
}

export function useImportNotionDocument() {
  const { token } = useAuth();
  const activeProject = useProjectStore((s) => s.activeProject);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ page, title }: { page: string; title?: string }) =>
      importNotionDocument(activeProject!.id, page, token!, title),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", activeProject?.id] });
    },
  });
}

export function useImportGoogleDocument() {
  const { token } = useAuth();
  const activeProject = useProjectStore((s) => s.activeProject);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ document, title }: { document: string; title?: string }) =>
      importGoogleDocument(activeProject!.id, document, token!, title),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", activeProject?.id] });
    },
  });
}

export function useSearchGoogleDocs() {
  const { token } = useAuth();

  return useMutation<ExternalGoogleDocItem[], Error, { query: string; limit?: number }>({
    mutationFn: ({ query, limit }) => searchGoogleDocs(query, token!, limit),
  });
}

export function useSearchNotionPages() {
  const { token } = useAuth();

  return useMutation<ExternalNotionPageItem[], Error, { query: string; limit?: number }>({
    mutationFn: ({ query, limit }) => searchNotionPages(query, token!, limit),
  });
}

export function useDocumentSourceHealth(provider: "notion" | "google-docs") {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["document-source-health", provider],
    queryFn: () => fetchDocumentSourceHealth(provider, token!),
    enabled: !!token,
    retry: false,
  });
}
