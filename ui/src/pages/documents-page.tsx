import { useCallback, useRef, useState } from "react";
import { Cockpit } from "@/components/layout/cockpit";
import {
  FileText,
  Upload,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import {
  useDocuments,
  useUploadDocument,
  useDeleteDocument,
  useReprocessDocument,
  useImportNotionDocument,
  useImportGoogleDocument,
  useSearchNotionPages,
  useSearchGoogleDocs,
  useDocumentSourceHealth,
} from "@/hooks/use-documents";
import { useProjectStore } from "@/store/project-store";
import type {
  DocumentItem,
  ExternalGoogleDocItem,
  ExternalNotionPageItem,
} from "@/api/documents.api";

const STATUS_CONFIG: Record<
  DocumentItem["status"],
  { icon: React.ElementType; label: string; className: string }
> = {
  pending: {
    icon: Clock,
    label: "Pending",
    className: "text-yellow-400 bg-yellow-400/10",
  },
  processing: {
    icon: Loader2,
    label: "Processing",
    className: "text-blue-400 bg-blue-400/10",
  },
  processed: {
    icon: CheckCircle2,
    label: "Processed",
    className: "text-emerald-400 bg-emerald-400/10",
  },
  failed: {
    icon: AlertCircle,
    label: "Failed",
    className: "text-red-400 bg-red-400/10",
  },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: DocumentItem["status"] }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.className}`}
    >
      <Icon
        className={`h-3.5 w-3.5 ${status === "processing" ? "animate-spin" : ""}`}
      />
      {config.label}
    </span>
  );
}

type ImportProvider = "notion" | "google-docs";

const IMPORT_MODAL_CONTENT: Record<
  ImportProvider,
  { title: string; label: string; placeholder: string; button: string }
> = {
  notion: {
    title: "Import Notion Page",
    label: "Notion page URL or page ID",
    placeholder: "https://www.notion.so/... or page id",
    button: "Import Notion",
  },
  "google-docs": {
    title: "Import Google Doc",
    label: "Google Doc URL or document ID",
    placeholder: "https://docs.google.com/... or document id",
    button: "Import Google Doc",
  },
};

export function DocumentsPage() {
  const activeProject = useProjectStore((s) => s.activeProject);
  const { data: documents, isLoading } = useDocuments();
  const uploadMutation = useUploadDocument();
  const deleteMutation = useDeleteDocument();
  const reprocessMutation = useReprocessDocument();
  const importNotionMutation = useImportNotionDocument();
  const importGoogleMutation = useImportGoogleDocument();
  const searchNotionPagesMutation = useSearchNotionPages();
  const searchGoogleDocsMutation = useSearchGoogleDocs();
  const notionHealthQuery = useDocumentSourceHealth("notion");
  const googleHealthQuery = useDocumentSourceHealth("google-docs");

  const [dragOver, setDragOver] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [importProvider, setImportProvider] = useState<ImportProvider | null>(
    null
  );
  const [importValue, setImportValue] = useState("");
  const [googleSearchQuery, setGoogleSearchQuery] = useState("");
  const [googleSearchResults, setGoogleSearchResults] = useState<
    ExternalGoogleDocItem[]
  >([]);
  const [googleSearchError, setGoogleSearchError] = useState<string | null>(
    null
  );
  const [notionSearchQuery, setNotionSearchQuery] = useState("");
  const [notionSearchResults, setNotionSearchResults] = useState<
    ExternalNotionPageItem[]
  >([]);
  const [notionSearchError, setNotionSearchError] = useState<string | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || !activeProject) return;
      Array.from(files).forEach((file) => {
        uploadMutation.mutate({ file, title: file.name });
      });
      setShowUpload(false);
    },
    [activeProject, uploadMutation]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const closeImportModal = useCallback(() => {
    setImportProvider(null);
    setImportValue("");
    setGoogleSearchQuery("");
    setGoogleSearchResults([]);
    setGoogleSearchError(null);
    setNotionSearchQuery("");
    setNotionSearchResults([]);
    setNotionSearchError(null);
  }, []);

  const handleImportNotion = useCallback(() => {
    setImportProvider("notion");
    setNotionSearchResults([]);
    setNotionSearchError(null);
  }, []);

  const handleImportGoogleDoc = useCallback(() => {
    setImportProvider("google-docs");
    setGoogleSearchResults([]);
    setGoogleSearchError(null);
  }, []);

  const runGoogleSearch = useCallback(() => {
    const query = googleSearchQuery.trim();
    setGoogleSearchError(null);
    searchGoogleDocsMutation.mutate(
      { query, limit: 20 },
      {
        onSuccess: (items) => {
          setGoogleSearchResults(items);
        },
        onError: (error) => {
          setGoogleSearchResults([]);
          setGoogleSearchError(error.message || "Failed to search Google Docs");
        },
      }
    );
  }, [googleSearchQuery, searchGoogleDocsMutation]);

  const runNotionSearch = useCallback(() => {
    const query = notionSearchQuery.trim();
    setNotionSearchError(null);
    searchNotionPagesMutation.mutate(
      { query, limit: 20 },
      {
        onSuccess: (items) => {
          setNotionSearchResults(items);
        },
        onError: (error) => {
          setNotionSearchResults([]);
          setNotionSearchError(error.message || "Failed to search Notion pages");
        },
      }
    );
  }, [notionSearchQuery, searchNotionPagesMutation]);

  const submitImport = useCallback(() => {
    const value = importValue.trim();
    if (!value || !importProvider) return;

    if (importProvider === "notion") {
      importNotionMutation.mutate(
        { page: value },
        {
          onSuccess: closeImportModal,
        }
      );
      return;
    }

    importGoogleMutation.mutate(
      { document: value },
      {
        onSuccess: closeImportModal,
      }
    );
  }, [
    closeImportModal,
    importGoogleMutation,
    importNotionMutation,
    importProvider,
    importValue,
  ]);

  if (!activeProject) {
    return (
      <Cockpit>
        <div className="flex flex-col h-full items-center justify-center p-6">
          <FileText className="h-12 w-12 text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-slate-300 mb-2">
            No project selected
          </h3>
          <p className="text-sm text-slate-500">
            Select or create a project first to manage documents.
          </p>
        </div>
      </Cockpit>
    );
  }

  const docs = documents ?? [];
  const notionReady = Boolean(notionHealthQuery.data?.configured);
  const googleReady = Boolean(googleHealthQuery.data?.configured);

  return (
    <Cockpit>
      <div className="flex flex-col h-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Documents</h1>
            <p className="text-sm text-slate-400 mt-1">
              Upload and manage product documentation
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleImportNotion}
              disabled={importNotionMutation.isPending || !notionReady}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-40"
              title={!notionReady ? (notionHealthQuery.data?.reason || "Notion is not configured") : undefined}
            >
              {importNotionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Import Notion
            </button>
            <button
              onClick={handleImportGoogleDoc}
              disabled={importGoogleMutation.isPending || !googleReady}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-40"
              title={!googleReady ? (googleHealthQuery.data?.reason || "Google Docs is not configured") : undefined}
            >
              {importGoogleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Import Google Doc
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 rounded-xl text-sm font-medium text-white transition-colors"
            >
              <Upload className="h-4 w-4" />
              Upload
            </button>
          </div>
        </div>

        {(!notionReady || !googleReady) && (
          <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
            {!notionReady ? `Notion import unavailable: ${notionHealthQuery.data?.reason || "not configured"}. ` : ""}
            {!googleReady ? `Google Docs import unavailable: ${googleHealthQuery.data?.reason || "not configured"}.` : ""}
          </div>
        )}

        {/* Import modal */}
        {importProvider && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">
                  {IMPORT_MODAL_CONTENT[importProvider].title}
                </h2>
                <button
                  onClick={closeImportModal}
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-400"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <label className="block text-sm text-slate-300 mb-2">
                {IMPORT_MODAL_CONTENT[importProvider].label}
              </label>
              <input
                autoFocus
                type="text"
                value={importValue}
                onChange={(e) => setImportValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitImport();
                }}
                placeholder={IMPORT_MODAL_CONTENT[importProvider].placeholder}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-400/60 focus:bg-white/[0.05]"
              />
              {importProvider === "google-docs" && (
                <div className="mt-4 border border-white/10 rounded-xl p-3 bg-white/[0.02]">
                  <p className="text-xs text-slate-400 mb-2">
                    Or search from connected Google Docs
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={googleSearchQuery}
                      onChange={(e) => setGoogleSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") runGoogleSearch();
                      }}
                      placeholder="Search by file name"
                      className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-400/60"
                    />
                    <button
                      onClick={runGoogleSearch}
                      disabled={searchGoogleDocsMutation.isPending}
                      className="px-3 py-2 rounded-lg text-sm border border-white/10 text-slate-200 hover:bg-white/5 disabled:opacity-40"
                    >
                      {searchGoogleDocsMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Search"
                      )}
                    </button>
                  </div>

                  {googleSearchError && (
                    <p className="text-xs text-red-300 mt-2">{googleSearchError}</p>
                  )}

                  {!googleSearchError &&
                    !searchGoogleDocsMutation.isPending &&
                    googleSearchResults.length === 0 &&
                    searchGoogleDocsMutation.isSuccess && (
                      <p className="text-xs text-slate-500 mt-2">
                        No matching documents found.
                      </p>
                    )}

                  {googleSearchResults.length > 0 && (
                    <div className="mt-2 max-h-44 overflow-y-auto space-y-1 pr-1">
                      {googleSearchResults.map((item) => (
                        <button
                          key={item.id}
                          onClick={() =>
                            setImportValue(item.webViewLink || item.id)
                          }
                          className="w-full text-left rounded-lg border border-white/10 px-2.5 py-2 hover:bg-white/5 transition-colors"
                        >
                          <p className="text-sm text-white truncate">{item.name || item.id}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {item.webViewLink || item.id}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {importProvider === "notion" && (
                <div className="mt-4 border border-white/10 rounded-xl p-3 bg-white/[0.02]">
                  <p className="text-xs text-slate-400 mb-2">
                    Or search from connected Notion pages
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={notionSearchQuery}
                      onChange={(e) => setNotionSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") runNotionSearch();
                      }}
                      placeholder="Search page name"
                      className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-400/60"
                    />
                    <button
                      onClick={runNotionSearch}
                      disabled={searchNotionPagesMutation.isPending}
                      className="px-3 py-2 rounded-lg text-sm border border-white/10 text-slate-200 hover:bg-white/5 disabled:opacity-40"
                    >
                      {searchNotionPagesMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Search"
                      )}
                    </button>
                  </div>

                  {notionSearchError && (
                    <p className="text-xs text-red-300 mt-2">{notionSearchError}</p>
                  )}

                  {!notionSearchError &&
                    !searchNotionPagesMutation.isPending &&
                    notionSearchResults.length === 0 &&
                    searchNotionPagesMutation.isSuccess && (
                      <p className="text-xs text-slate-500 mt-2">
                        No matching pages found.
                      </p>
                    )}

                  {notionSearchResults.length > 0 && (
                    <div className="mt-2 max-h-44 overflow-y-auto space-y-1 pr-1">
                      {notionSearchResults.map((item) => (
                        <button
                          key={item.id}
                          onClick={() =>
                            setImportValue(item.webViewLink || item.id)
                          }
                          className="w-full text-left rounded-lg border border-white/10 px-2.5 py-2 hover:bg-white/5 transition-colors"
                        >
                          <p className="text-sm text-white truncate">{item.name || item.id}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {item.webViewLink || item.id}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {(importNotionMutation.error || importGoogleMutation.error) && (
                <p className="text-xs text-red-300 mt-2">
                  {importNotionMutation.error?.message ||
                    importGoogleMutation.error?.message}
                </p>
              )}

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  onClick={closeImportModal}
                  className="px-4 py-2 rounded-xl border border-white/10 text-sm text-slate-300 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitImport}
                  disabled={
                    !importValue.trim() ||
                    importNotionMutation.isPending ||
                    importGoogleMutation.isPending
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-blue-500/80 hover:bg-blue-500 disabled:opacity-40 transition-colors"
                >
                  {(importNotionMutation.isPending ||
                    importGoogleMutation.isPending) && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {IMPORT_MODAL_CONTENT[importProvider].button}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload modal */}
        {showUpload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">
                  Upload Documents
                </h2>
                <button
                  onClick={() => setShowUpload(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-400"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? "border-blue-400 bg-blue-400/5"
                    : "border-white/10 hover:border-white/20 bg-white/[0.02]"
                }`}
              >
                <Upload className="h-8 w-8 text-slate-500 mx-auto mb-3" />
                <p className="text-sm text-slate-300 mb-1">
                  Drop files here or click to browse
                </p>
                <p className="text-xs text-slate-500">
                  PDF, DOCX, MD, TXT — up to 50 MB
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.md,.txt,.doc"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />

              {uploadMutation.isPending && (
                <div className="flex items-center gap-2 mt-4 text-sm text-blue-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Document list */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-slate-500 animate-spin" />
          </div>
        ) : docs.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`text-center p-8 rounded-2xl border-2 border-dashed transition-colors ${
                dragOver
                  ? "border-blue-400 bg-blue-400/5"
                  : "border-white/5"
              }`}
            >
              <FileText className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-300 mb-2">
                No documents yet
              </h3>
              <p className="text-sm text-slate-500 max-w-sm">
                Upload product docs (PDF, MD, DOCX) to let AgentPM understand
                your product and generate roadmaps.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-colors"
              >
                <div className="h-10 w-10 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-slate-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {doc.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatFileSize(doc.fileSize)}
                    {doc.chunkCount > 0 && ` · ${doc.chunkCount} chunks`}
                    {" · "}
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                  {doc.processingError && (
                    <p className="text-xs text-red-400 mt-1 truncate">
                      {doc.processingError}
                    </p>
                  )}
                </div>

                <StatusBadge status={doc.status} />

                <div className="flex items-center gap-1">
                  {(doc.status === "failed" || doc.status === "processed") && (
                    <button
                      onClick={() => reprocessMutation.mutate(doc.id)}
                      className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                      title="Reprocess"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm("Delete this document?")) {
                        deleteMutation.mutate(doc.id);
                      }
                    }}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Cockpit>
  );
}
