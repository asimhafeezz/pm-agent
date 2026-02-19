import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Cockpit } from "@/components/layout/cockpit";
import { useAuth } from "@/components/auth/auth-provider";
import { useProjectStore } from "@/store/project-store";
import {
  fetchIntelligenceDashboard,
  fetchRisks,
  updateRiskStatus,
  triggerRiskDetection,
  fetchSummaries,
  triggerSummaryGeneration,
  generateStakeholderUpdate,
  runPrioritization,
  type RiskAssessment,
  type RiskStatus,
  type WeeklySummary,
  type StakeholderUpdate,
  type PrioritizationResult,
} from "@/api/intelligence.api";
import {
  Loader2,
  Brain,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Target,
  FileText,
  BarChart3,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Eye,
  Send,
  Copy,
  ArrowUpDown,
  Sparkles,
} from "lucide-react";

type TabId = "risks" | "summaries" | "stakeholder" | "prioritize";

const SEVERITY_CONFIG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  critical: { label: "Critical", className: "text-red-400 bg-red-400/10 border-red-500/20", icon: ShieldAlert },
  high: { label: "High", className: "text-orange-400 bg-orange-400/10 border-orange-500/20", icon: AlertTriangle },
  medium: { label: "Medium", className: "text-amber-400 bg-amber-400/10 border-amber-500/20", icon: Shield },
  low: { label: "Low", className: "text-blue-400 bg-blue-400/10 border-blue-500/20", icon: Shield },
};

const RISK_TYPE_LABELS: Record<string, string> = {
  blocker_aging: "Blocker Aging",
  velocity_decline: "Velocity Decline",
  scope_creep: "Scope Creep",
  dependency_risk: "Dependency Risk",
  unresolved_action: "Unresolved Action Item",
};

const STATUS_ACTIONS: Record<string, { next: RiskStatus; label: string; icon: React.ElementType }> = {
  open: { next: "acknowledged", label: "Acknowledge", icon: Eye },
  acknowledged: { next: "mitigated", label: "Mark Mitigated", icon: ShieldCheck },
  mitigated: { next: "resolved", label: "Resolve", icon: CheckCircle2 },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const e = new Date(end).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${s} - ${e}`;
}

export function IntelligencePage() {
  const { token } = useAuth();
  const activeProject = useProjectStore((s) => s.activeProject);
  const qc = useQueryClient();
  const projectId = activeProject?.id;

  const [activeTab, setActiveTab] = useState<TabId>("risks");
  const [expandedRisk, setExpandedRisk] = useState<string | null>(null);
  const [expandedSummary, setExpandedSummary] = useState<string | null>(null);
  const [stakeholderAudience, setStakeholderAudience] = useState<"executive" | "engineering" | "stakeholder">("executive");
  const [stakeholderResult, setStakeholderResult] = useState<StakeholderUpdate | null>(null);
  const [priorityResult, setPriorityResult] = useState<PrioritizationResult | null>(null);
  const [sortField, setSortField] = useState<"riceScore" | "wsjfScore" | "effort">("riceScore");

  // Queries
  const dashboardQuery = useQuery({
    queryKey: ["intelligence", "dashboard", projectId],
    queryFn: () => fetchIntelligenceDashboard(projectId!, token!),
    enabled: !!token && !!projectId,
    refetchInterval: 30000,
  });

  const risksQuery = useQuery({
    queryKey: ["intelligence", "risks", projectId],
    queryFn: () => fetchRisks(projectId!, token!),
    enabled: !!token && !!projectId && activeTab === "risks",
  });

  const summariesQuery = useQuery({
    queryKey: ["intelligence", "summaries", projectId],
    queryFn: () => fetchSummaries(projectId!, token!),
    enabled: !!token && !!projectId && activeTab === "summaries",
  });

  // Mutations
  const detectRisksMutation = useMutation({
    mutationFn: () => triggerRiskDetection(projectId!, token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intelligence", "risks", projectId] });
      qc.invalidateQueries({ queryKey: ["intelligence", "dashboard", projectId] });
    },
  });

  const generateSummaryMutation = useMutation({
    mutationFn: () => triggerSummaryGeneration(projectId!, token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intelligence", "summaries", projectId] });
      qc.invalidateQueries({ queryKey: ["intelligence", "dashboard", projectId] });
    },
  });

  const updateRiskMutation = useMutation({
    mutationFn: ({ riskId, status }: { riskId: string; status: RiskStatus }) =>
      updateRiskStatus(riskId, token!, {
        status,
        resolvedAt: status === "resolved" ? new Date().toISOString() : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intelligence", "risks", projectId] });
      qc.invalidateQueries({ queryKey: ["intelligence", "dashboard", projectId] });
    },
  });

  const stakeholderMutation = useMutation({
    mutationFn: () => generateStakeholderUpdate(projectId!, token!, stakeholderAudience),
    onSuccess: (data) => setStakeholderResult(data),
  });

  const prioritizeMutation = useMutation({
    mutationFn: () => runPrioritization(projectId!, token!),
    onSuccess: (data) => setPriorityResult(data),
  });

  const dashboard = dashboardQuery.data
    ? {
        ...dashboardQuery.data,
        risks: Array.isArray(dashboardQuery.data.risks) ? dashboardQuery.data.risks : [],
      }
    : null;
  const risks: RiskAssessment[] = risksQuery.data ?? [];
  const summaries: WeeklySummary[] = summariesQuery.data ?? [];

  if (!projectId) {
    return (
      <Cockpit>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Brain className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-300 mb-2">No project selected</h3>
            <p className="text-sm text-slate-500">Select a project to view intelligence dashboard.</p>
          </div>
        </div>
      </Cockpit>
    );
  }

  return (
    <Cockpit>
      <div className="flex flex-col h-full p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Intelligence</h1>
            <p className="text-sm text-slate-400 mt-1">
              Risk detection, project summaries, and prioritization
            </p>
          </div>
        </div>

        {/* Dashboard Cards */}
        {dashboard && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
            <div className="rounded-xl border border-red-500/10 bg-red-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="h-4 w-4 text-red-400" />
                <span className="text-xs font-medium text-red-400 uppercase tracking-wider">Critical</span>
              </div>
              <span className="text-2xl font-bold text-white">{dashboard.criticalCount}</span>
            </div>
            <div className="rounded-xl border border-orange-500/10 bg-orange-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
                <span className="text-xs font-medium text-orange-400 uppercase tracking-wider">High</span>
              </div>
              <span className="text-2xl font-bold text-white">{dashboard.highCount}</span>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Open Risks</span>
              </div>
              <span className="text-2xl font-bold text-white">{dashboard.risks.length}</span>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Latest Summary</span>
              </div>
              <span className="text-sm text-slate-300">
                {dashboard.latestSummary
                  ? formatDateRange(dashboard.latestSummary.periodStart, dashboard.latestSummary.periodEnd)
                  : "None yet"}
              </span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-white/[0.06] pb-px">
          {([
            { id: "risks" as TabId, label: "Risk Radar", icon: ShieldAlert, count: risks.filter((r) => r.status === "open").length },
            { id: "summaries" as TabId, label: "Weekly Summaries", icon: FileText },
            { id: "stakeholder" as TabId, label: "Stakeholder Update", icon: Send },
            { id: "prioritize" as TabId, label: "Prioritization", icon: BarChart3 },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
                activeTab === tab.id
                  ? "text-white border-b-2 border-blue-500"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-2">
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400">
                    {tab.count}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Risks Tab */}
        {activeTab === "risks" && (
          <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">
                Detected risks across sprints, tickets, meetings, and standups.
              </p>
              <button
                onClick={() => detectRisksMutation.mutate()}
                disabled={detectRisksMutation.isPending}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
              >
                {detectRisksMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Run Detection
              </button>
            </div>

            {risksQuery.isLoading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
              </div>
            )}

            {risks.length === 0 && !risksQuery.isLoading && (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <ShieldCheck className="h-12 w-12 text-emerald-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-300 mb-2">No risks detected</h3>
                  <p className="text-sm text-slate-500 max-w-sm">
                    Run risk detection to scan for blockers, velocity issues, and unresolved action items.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {risks.map((risk) => {
                const sev = SEVERITY_CONFIG[risk.severity] || SEVERITY_CONFIG.medium;
                const SevIcon = sev.icon;
                const isExpanded = expandedRisk === risk.id;
                const action = STATUS_ACTIONS[risk.status];
                return (
                  <div
                    key={risk.id}
                    className={`rounded-xl border bg-white/[0.02] overflow-hidden ${sev.className.split(" ").find((c) => c.startsWith("border-")) || "border-white/[0.06]"}`}
                  >
                    <div
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/[0.03] transition-colors"
                      onClick={() => setExpandedRisk(isExpanded ? null : risk.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                      )}
                      <SevIcon className={`h-4 w-4 shrink-0 ${sev.className.split(" ")[0]}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${sev.className}`}>
                            {sev.label}
                          </span>
                          <span className="text-xs text-slate-500 px-2 py-0.5 rounded-full bg-white/[0.05]">
                            {RISK_TYPE_LABELS[risk.riskType] || risk.riskType}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            risk.status === "open" ? "text-red-400 bg-red-400/10"
                            : risk.status === "acknowledged" ? "text-amber-400 bg-amber-400/10"
                            : risk.status === "mitigated" ? "text-blue-400 bg-blue-400/10"
                            : "text-emerald-400 bg-emerald-400/10"
                          }`}>
                            {risk.status}
                          </span>
                        </div>
                        <p className="text-sm text-white mt-1">{risk.description}</p>
                      </div>
                      <span className="text-xs text-slate-500 shrink-0">{formatDate(risk.detectedAt)}</span>
                    </div>
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-white/[0.04] space-y-3">
                        {risk.mitigation && (
                          <div>
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Mitigation</span>
                            <p className="text-sm text-slate-300 mt-1">{risk.mitigation}</p>
                          </div>
                        )}
                        {risk.evidence && Object.keys(risk.evidence).length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Evidence</span>
                            <pre className="text-xs text-slate-400 mt-1 whitespace-pre-wrap bg-white/[0.03] rounded-lg p-3">
                              {JSON.stringify(risk.evidence, null, 2)}
                            </pre>
                          </div>
                        )}
                        {risk.linkedIssueId && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Linked Issue:</span>
                            <span className="text-xs text-blue-400">{risk.linkedIssueId}</span>
                          </div>
                        )}
                        {action && (
                          <div className="flex justify-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateRiskMutation.mutate({ riskId: risk.id, status: action.next });
                              }}
                              disabled={updateRiskMutation.isPending}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white bg-white/[0.06] hover:bg-white/[0.1] transition-colors"
                            >
                              <action.icon className="h-3.5 w-3.5" />
                              {action.label}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Summaries Tab */}
        {activeTab === "summaries" && (
          <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">
                Weekly project summaries with metrics, highlights, and recommendations.
              </p>
              <button
                onClick={() => generateSummaryMutation.mutate()}
                disabled={generateSummaryMutation.isPending}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
              >
                {generateSummaryMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Generate Summary
              </button>
            </div>

            {summariesQuery.isLoading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
              </div>
            )}

            {summaries.length === 0 && !summariesQuery.isLoading && (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <FileText className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-300 mb-2">No summaries yet</h3>
                  <p className="text-sm text-slate-500 max-w-sm">
                    Generate a weekly summary to get a comprehensive project overview.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {summaries.map((summary) => {
                const isExpanded = expandedSummary === summary.id;
                return (
                  <div
                    key={summary.id}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
                  >
                    <div
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/[0.03] transition-colors"
                      onClick={() => setExpandedSummary(isExpanded ? null : summary.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                      )}
                      <FileText className="h-4 w-4 text-blue-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">
                            Week of {formatDateRange(summary.periodStart, summary.periodEnd)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">{summary.executiveSummary}</p>
                      </div>
                      <span className="text-xs text-slate-500 shrink-0">{formatDate(summary.createdAt)}</span>
                    </div>
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-white/[0.04] space-y-4">
                        <div>
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Executive Summary</span>
                          <p className="text-sm text-white mt-1 leading-relaxed">{summary.executiveSummary}</p>
                        </div>

                        {summary.metrics && Object.keys(summary.metrics).length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Metrics</span>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                              {Object.entries(summary.metrics).map(([key, val]) => (
                                <div key={key} className="rounded-lg bg-white/[0.03] p-3">
                                  <span className="text-xs text-slate-500 capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                                  <p className="text-sm font-medium text-white mt-0.5">{String(val)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {summary.highlights && summary.highlights.length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Highlights</span>
                            <ul className="mt-2 space-y-2">
                              {summary.highlights.map((h, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                                  <div>
                                    <span className="text-white font-medium">{h.title}</span>
                                    {h.description && (
                                      <p className="text-slate-400 text-xs mt-0.5">{h.description}</p>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {summary.risks && summary.risks.length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-red-400 uppercase tracking-wider">Risks</span>
                            <ul className="mt-2 space-y-2">
                              {summary.risks.map((r, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                                  <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                                  <div>
                                    <span className="text-white">{r.description}</span>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-xs text-red-400">{r.severity}</span>
                                      {r.mitigation && <span className="text-xs text-slate-400">Mitigation: {r.mitigation}</span>}
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {summary.recommendations && summary.recommendations.length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">Recommendations</span>
                            <ul className="mt-2 space-y-2">
                              {summary.recommendations.map((r, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <Target className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                                  <div>
                                    <span className="text-white">{r.action}</span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                                        r.priority === "high" ? "text-red-400 bg-red-400/10" : "text-slate-400 bg-white/[0.05]"
                                      }`}>{r.priority}</span>
                                      {r.reason && <span className="text-xs text-slate-500">{r.reason}</span>}
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stakeholder Update Tab */}
        {activeTab === "stakeholder" && (
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-4">
              <p className="text-sm text-slate-400 flex-1">
                Generate a tailored update for your audience.
              </p>
              <select
                value={stakeholderAudience}
                onChange={(e) => setStakeholderAudience(e.target.value as typeof stakeholderAudience)}
                className="h-9 px-3 rounded-lg bg-white/[0.06] border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="executive">Executive</option>
                <option value="engineering">Engineering</option>
                <option value="stakeholder">Stakeholder</option>
              </select>
              <button
                onClick={() => stakeholderMutation.mutate()}
                disabled={stakeholderMutation.isPending}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
              >
                {stakeholderMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate
              </button>
            </div>

            {!stakeholderResult && !stakeholderMutation.isPending && (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <Send className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-300 mb-2">Generate a stakeholder update</h3>
                  <p className="text-sm text-slate-500 max-w-sm">
                    Choose your audience and generate a tailored update based on all project data.
                  </p>
                </div>
              </div>
            )}

            {stakeholderMutation.isPending && (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-400 mx-auto mb-4" />
                  <p className="text-sm text-slate-400">Generating {stakeholderAudience} update...</p>
                </div>
              </div>
            )}

            {stakeholderResult && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-white/[0.04]">
                  <div>
                    <h3 className="text-sm font-medium text-white">{stakeholderResult.subject}</h3>
                    <span className="text-xs text-slate-500 capitalize">Audience: {stakeholderResult.audience}</span>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(stakeholderResult.body)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-300 bg-white/[0.06] hover:bg-white/[0.1] transition-colors"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </button>
                </div>
                <div className="p-4">
                  <div className="prose prose-sm prose-invert max-w-none">
                    <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {stakeholderResult.body}
                    </div>
                  </div>
                  {stakeholderResult.keyPoints.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/[0.04]">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Key Points</span>
                      <ul className="mt-2 space-y-1">
                        {stakeholderResult.keyPoints.map((point, i) => (
                          <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                            <span className="text-blue-400 mt-0.5">-</span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {stakeholderMutation.isError && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <p className="text-sm text-red-300">
                  {stakeholderMutation.error instanceof Error ? stakeholderMutation.error.message : "Failed to generate update"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Prioritization Tab */}
        {activeTab === "prioritize" && (
          <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">
                RICE/WSJF scoring using data from tickets, meetings, emails, and standups.
              </p>
              <button
                onClick={() => prioritizeMutation.mutate()}
                disabled={prioritizeMutation.isPending}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
              >
                {prioritizeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BarChart3 className="h-4 w-4" />
                )}
                Run Prioritization
              </button>
            </div>

            {!priorityResult && !prioritizeMutation.isPending && (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-300 mb-2">Run backlog prioritization</h3>
                  <p className="text-sm text-slate-500 max-w-sm">
                    Score and rank backlog items using RICE and WSJF frameworks with full project context.
                  </p>
                </div>
              </div>
            )}

            {prioritizeMutation.isPending && (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-400 mx-auto mb-4" />
                  <p className="text-sm text-slate-400">Analyzing and scoring items...</p>
                </div>
              </div>
            )}

            {priorityResult && (
              <div className="space-y-4">
                {priorityResult.summary && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <p className="text-sm text-white leading-relaxed">{priorityResult.summary}</p>
                  </div>
                )}

                {/* Sort control */}
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-slate-500" />
                  <span className="text-xs text-slate-500">Sort by:</span>
                  {(["riceScore", "wsjfScore", "effort"] as const).map((field) => (
                    <button
                      key={field}
                      onClick={() => setSortField(field)}
                      className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                        sortField === field
                          ? "text-white bg-blue-500/20 border border-blue-500/30"
                          : "text-slate-400 hover:text-white bg-white/[0.03]"
                      }`}
                    >
                      {field === "riceScore" ? "RICE" : field === "wsjfScore" ? "WSJF" : "Effort"}
                    </button>
                  ))}
                </div>

                {/* Priority items */}
                <div className="space-y-2">
                  {[...priorityResult.items]
                    .sort((a, b) => {
                      const av = a[sortField] ?? 0;
                      const bv = b[sortField] ?? 0;
                      return sortField === "effort" ? av - bv : bv - av;
                    })
                    .map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xs font-mono text-slate-500 w-6">#{idx + 1}</span>
                          <span className="text-sm font-medium text-white flex-1">{item.title}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono">
                              RICE: {item.riceScore.toFixed(1)}
                            </span>
                            {item.wsjfScore !== undefined && (
                              <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-mono">
                                WSJF: {item.wsjfScore.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mb-2 ml-9">
                          <span className="text-xs text-slate-500">
                            Reach: <span className="text-slate-300">{item.reach}</span>
                          </span>
                          <span className="text-xs text-slate-500">
                            Impact: <span className="text-slate-300">{item.impact}</span>
                          </span>
                          <span className="text-xs text-slate-500">
                            Confidence: <span className="text-slate-300">{(item.confidence * 100).toFixed(0)}%</span>
                          </span>
                          <span className="text-xs text-slate-500">
                            Effort: <span className="text-slate-300">{item.effort}w</span>
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 ml-9">{item.rationale}</p>
                        {item.recommendation && (
                          <p className="text-xs text-blue-400 ml-9 mt-1">{item.recommendation}</p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {prioritizeMutation.isError && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <p className="text-sm text-red-300">
                  {prioritizeMutation.error instanceof Error ? prioritizeMutation.error.message : "Failed to run prioritization"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Cockpit>
  );
}
