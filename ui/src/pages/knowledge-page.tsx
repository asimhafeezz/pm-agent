import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { Cockpit } from "@/components/layout/cockpit";
import {
  Brain,
  Loader2,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  useKnowledgeGraph,
  useKnowledgeSummary,
  useExtractKnowledge,
} from "@/hooks/use-knowledge";
import { useQueryClient } from "@tanstack/react-query";
import { useDocuments } from "@/hooks/use-documents";
import { useProjectStore } from "@/store/project-store";
import type { KnowledgeEntityItem } from "@/api/knowledge.api";

const TYPE_COLORS: Record<string, string> = {
  feature: "#3b82f6",
  requirement: "#8b5cf6",
  user_persona: "#ec4899",
  metric: "#f59e0b",
  constraint: "#ef4444",
  dependency: "#6366f1",
  technology: "#10b981",
  stakeholder: "#06b6d4",
};

function EntityDetail({ entity }: { entity: KnowledgeEntityItem }) {
  return (
    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: TYPE_COLORS[entity.type] || "#64748b" }}
        />
        <span className="text-xs font-medium text-slate-400 uppercase">
          {entity.type.replace("_", " ")}
        </span>
      </div>
      <h4 className="text-sm font-medium text-white mb-1">{entity.name}</h4>
      {entity.description && (
        <p className="text-xs text-slate-400 leading-relaxed">
          {entity.description}
        </p>
      )}
    </div>
  );
}

export function KnowledgePage() {
  const qc = useQueryClient();
  const activeProject = useProjectStore((s) => s.activeProject);
  const { data: graph, isLoading: graphLoading } = useKnowledgeGraph();
  const { data: summary } = useKnowledgeSummary();
  const { data: docs } = useDocuments();
  const extractMutation = useExtractKnowledge();
  const [selectedEntity, setSelectedEntity] = useState<KnowledgeEntityItem | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [extractNotice, setExtractNotice] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [pollingKnowledge, setPollingKnowledge] = useState(false);
  const pollRef = useRef<number | null>(null);

  const processedDocIds = useMemo(
    () => (docs ?? []).filter((d) => d.status === "processed").map((d) => d.id),
    [docs]
  );
  const processingDocCount = useMemo(
    () => (docs ?? []).filter((d) => d.status === "processing" || d.status === "pending").length,
    [docs]
  );

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPollingKnowledge(false);
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const handleExtract = useCallback(() => {
    if (!activeProject) return;
    setExtractError(null);
    setExtractNotice(null);

    if (processedDocIds.length === 0) {
      if (processingDocCount > 0) {
        setExtractError(
          `No processed documents yet. ${processingDocCount} document(s) are still processing.`
        );
      } else {
        setExtractError("No processed documents found. Upload and process docs first.");
      }
      return;
    }

    extractMutation.mutate(processedDocIds, {
      onSuccess: () => {
        setExtractNotice(
          `Knowledge extraction started for ${processedDocIds.length} document(s). Refreshing results...`
        );
        setPollingKnowledge(true);
        let ticks = 0;
        stopPolling();
        pollRef.current = window.setInterval(() => {
          ticks += 1;
          qc.invalidateQueries({ queryKey: ["knowledge-entities", activeProject.id] });
          qc.invalidateQueries({ queryKey: ["knowledge-graph", activeProject.id] });
          qc.invalidateQueries({ queryKey: ["knowledge-summary", activeProject.id] });
          if (ticks >= 12) {
            stopPolling();
            setExtractNotice("Extraction refresh finished. If needed, click Extract Knowledge again.");
          }
        }, 2500);
      },
      onError: (e) => {
        setExtractError(e instanceof Error ? e.message : "Failed to start extraction");
      },
    });
  }, [
    activeProject,
    extractMutation,
    processedDocIds,
    processingDocCount,
    qc,
    stopPolling,
  ]);

  const entities = useMemo(() => {
    if (!graph) return [];
    if (!filterType) return graph.entities;
    return graph.entities.filter((e) => e.type === filterType);
  }, [graph, filterType]);

  const { nodes, edges } = useMemo(() => {
    if (!graph || graph.entities.length === 0)
      return { nodes: [] as Node[], edges: [] as Edge[] };

    const flowNodes: Node[] = graph.entities.map((entity, i) => {
      // Simple circular layout
      const angle = (2 * Math.PI * i) / graph.entities.length;
      const radius = Math.min(300, graph.entities.length * 30);
      return {
        id: entity.id,
        position: {
          x: 400 + radius * Math.cos(angle),
          y: 300 + radius * Math.sin(angle),
        },
        data: { label: entity.name },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
          background: TYPE_COLORS[entity.type] || "#64748b",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          padding: "8px 12px",
          fontSize: "12px",
          fontWeight: 500,
          maxWidth: "150px",
          textAlign: "center" as const,
        },
      };
    });

    const flowEdges: Edge[] = graph.relations.map((rel) => ({
      id: rel.id,
      source: rel.sourceEntityId,
      target: rel.targetEntityId,
      label: rel.relationType.replace("_", " "),
      type: "default",
      animated: rel.relationType === "blocks",
      style: {
        stroke: "#475569",
        strokeWidth: Math.max(1, rel.strength * 3),
      },
      labelStyle: {
        fontSize: "10px",
        fill: "#94a3b8",
      },
    }));

    return { nodes: flowNodes, edges: flowEdges };
  }, [graph]);

  if (!activeProject) {
    return (
      <Cockpit>
        <div className="flex flex-col h-full items-center justify-center p-6">
          <Brain className="h-12 w-12 text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-slate-300 mb-2">
            No project selected
          </h3>
          <p className="text-sm text-slate-500">
            Select or create a project first to view knowledge.
          </p>
        </div>
      </Cockpit>
    );
  }

  const hasEntities = (graph?.entities.length ?? 0) > 0;

  return (
    <Cockpit>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-0">
          <div>
            <h1 className="text-2xl font-bold text-white">Knowledge Graph</h1>
            <p className="text-sm text-slate-400 mt-1">
              {summary
                ? `${summary.entityCount} entities · ${summary.relationCount} relations`
                : "Extracted product entities and relationships"}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Ready docs: {processedDocIds.length}
              {processingDocCount > 0 ? ` · Processing: ${processingDocCount}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pollingKnowledge ? (
              <button
                onClick={() => {
                  if (!activeProject) return;
                  qc.invalidateQueries({ queryKey: ["knowledge-entities", activeProject.id] });
                  qc.invalidateQueries({ queryKey: ["knowledge-graph", activeProject.id] });
                  qc.invalidateQueries({ queryKey: ["knowledge-summary", activeProject.id] });
                }}
                className="flex items-center gap-2 px-3 py-2 text-xs border border-white/10 rounded-lg text-slate-300 hover:bg-white/[0.05]"
              >
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Refreshing
              </button>
            ) : null}
            <button
              onClick={handleExtract}
              disabled={extractMutation.isPending}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {extractMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Extract Knowledge
            </button>
          </div>
        </div>

        {extractError ? (
          <div className="mx-6 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {extractError}
          </div>
        ) : null}

        {extractNotice ? (
          <div className="mx-6 mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            {extractNotice}
          </div>
        ) : null}

        {/* Summary badges */}
        {summary && summary.entityCount > 0 && (
          <div className="flex gap-2 px-6 pt-4 flex-wrap">
            <button
              onClick={() => setFilterType(null)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                !filterType
                  ? "bg-white/10 text-white"
                  : "bg-white/[0.04] text-slate-400 hover:text-white"
              }`}
            >
              All ({summary.entityCount})
            </button>
            {Object.entries(summary.byType).map(([type, count]) => (
              <button
                key={type}
                onClick={() =>
                  setFilterType(filterType === type ? null : type)
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filterType === type
                    ? "bg-white/10 text-white"
                    : "bg-white/[0.04] text-slate-400 hover:text-white"
                }`}
              >
                <div
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: TYPE_COLORS[type] || "#64748b",
                  }}
                />
                {type.replace("_", " ")} ({count})
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {graphLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-slate-500 animate-spin" />
          </div>
        ) : !hasEntities ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <Brain className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-300 mb-2">
                No knowledge extracted yet
              </h3>
              <p className="text-sm text-slate-500 max-w-sm">
                Upload documents first, then extract knowledge to build your
                product's entity graph.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex min-h-0">
            {/* Graph */}
            <div className="flex-1 min-w-0">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                fitView
                proOptions={{ hideAttribution: true }}
                onNodeClick={(_e, node) => {
                  const entity = graph?.entities.find(
                    (e) => e.id === node.id
                  );
                  if (entity) setSelectedEntity(entity);
                }}
              >
                <Background color="#1e293b" gap={20} />
                <Controls
                  style={{
                    background: "#18181b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                  }}
                />
              </ReactFlow>
            </div>

            {/* Entity sidebar */}
            <div className="w-[280px] border-l border-white/5 overflow-y-auto p-4 space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Entities ({entities.length})
              </h3>
              {entities.map((entity) => (
                <button
                  key={entity.id}
                  onClick={() => setSelectedEntity(entity)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedEntity?.id === entity.id
                      ? "bg-white/[0.08] border border-white/10"
                      : "hover:bg-white/[0.04] border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          TYPE_COLORS[entity.type] || "#64748b",
                      }}
                    />
                    <span className="text-sm text-white truncate">
                      {entity.name}
                    </span>
                  </div>
                  {entity.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 pl-[18px]">
                      {entity.description}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Entity detail panel */}
        {selectedEntity && (
          <div className="border-t border-white/5 p-4">
            <EntityDetail entity={selectedEntity} />
          </div>
        )}
      </div>
    </Cockpit>
  );
}
