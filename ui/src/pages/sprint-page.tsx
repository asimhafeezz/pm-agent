import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Cockpit } from "@/components/layout/cockpit";
import { useAuth } from "@/components/auth/auth-provider";
import { useProjectStore } from "@/store/project-store";
import {
  fetchStandupResponses,
  fetchTodayStandups,
  fetchStandupSummary,
  type StandupResponse,
  type StandupSummary,
} from "@/api/standups.api";
import {
  fetchScheduledJobs,
  createScheduledJob,
  updateScheduledJob,
  deleteScheduledJob,
  triggerJob,
  type ScheduledJob,
  type JobType,
} from "@/api/scheduler.api";
import {
  Loader2,
  Zap,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  Trash2,
  Plus,
  RefreshCw,
  Users,
  MessageSquare,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const STATUS_BADGE: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  on_track: { label: "On Track", className: "text-emerald-400 bg-emerald-400/10", icon: CheckCircle2 },
  at_risk: { label: "At Risk", className: "text-amber-400 bg-amber-400/10", icon: AlertTriangle },
  blocked: { label: "Blocked", className: "text-red-400 bg-red-400/10", icon: AlertCircle },
};

const JOB_TYPE_LABELS: Record<JobType, { label: string; icon: React.ElementType; description: string }> = {
  standup: { label: "Daily Standup", icon: Users, description: "Send standup prompts via Slack" },
  sprint_digest: { label: "Sprint Digest", icon: Zap, description: "Generate sprint health report" },
  blocker_check: { label: "Blocker Check", icon: AlertTriangle, description: "Scan for blocked issues" },
  risk_detection: { label: "Risk Detection", icon: AlertCircle, description: "Detect project risks automatically" },
  weekly_summary: { label: "Weekly Summary", icon: Calendar, description: "Generate weekly project summary" },
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SprintPage() {
  const { token } = useAuth();
  const activeProject = useProjectStore((s) => s.activeProject);
  const qc = useQueryClient();
  const projectId = activeProject?.id;

  const [activeTab, setActiveTab] = useState<"standups" | "schedule">("standups");
  const [showAddJob, setShowAddJob] = useState(false);
  const [newJobType, setNewJobType] = useState<JobType>("standup");
  const [newCron, setNewCron] = useState("0 9 * * 1-5");
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null);

  // Queries
  const todayQuery = useQuery({
    queryKey: ["standups", "today", projectId],
    queryFn: () => fetchTodayStandups(projectId!, token!),
    enabled: !!token && !!projectId,
    refetchInterval: 15000,
  });

  const summaryQuery = useQuery({
    queryKey: ["standups", "summary", projectId],
    queryFn: () => fetchStandupSummary(projectId!, token!),
    enabled: !!token && !!projectId,
  });

  const recentQuery = useQuery({
    queryKey: ["standups", "recent", projectId],
    queryFn: () => fetchStandupResponses(projectId!, token!, { limit: 30 }),
    enabled: !!token && !!projectId,
  });

  const jobsQuery = useQuery({
    queryKey: ["scheduler", "jobs", projectId],
    queryFn: () => fetchScheduledJobs(projectId!, token!),
    enabled: !!token && !!projectId,
  });

  // Mutations
  const createJobMutation = useMutation({
    mutationFn: () =>
      createScheduledJob(token!, {
        projectId: projectId!,
        jobType: newJobType,
        cronExpression: newCron,
      }),
    onSuccess: () => {
      setShowAddJob(false);
      setNewJobType("standup");
      setNewCron("0 9 * * 1-5");
      qc.invalidateQueries({ queryKey: ["scheduler", "jobs", projectId] });
    },
  });

  const toggleJobMutation = useMutation({
    mutationFn: (job: ScheduledJob) =>
      updateScheduledJob(job.id, token!, { isActive: !job.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scheduler", "jobs", projectId] }),
  });

  const deleteJobMutation = useMutation({
    mutationFn: (jobId: string) => deleteScheduledJob(jobId, token!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scheduler", "jobs", projectId] }),
  });

  const triggerJobMutation = useMutation({
    mutationFn: (jobId: string) => triggerJob(jobId, token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduler", "jobs", projectId] });
      qc.invalidateQueries({ queryKey: ["standups"] });
    },
  });

  const refreshSummary = useMutation({
    mutationFn: () => fetchStandupSummary(projectId!, token!),
    onSuccess: (data) => {
      qc.setQueryData(["standups", "summary", projectId], data);
    },
  });

  const todayResponses: StandupResponse[] = todayQuery.data ?? [];
  const summary: StandupSummary | undefined = summaryQuery.data;
  const recentResponses: StandupResponse[] = recentQuery.data ?? [];
  const jobs: ScheduledJob[] = jobsQuery.data ?? [];

  if (!projectId) {
    return (
      <Cockpit>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Zap className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-300 mb-2">No project selected</h3>
            <p className="text-sm text-slate-500">Select a project to view sprint dashboard.</p>
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
            <h1 className="text-2xl font-bold text-white">Sprint Dashboard</h1>
            <p className="text-sm text-slate-400 mt-1">
              Standups, sprint health, and scheduled automations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshSummary.mutate()}
              disabled={refreshSummary.isPending}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-sm text-slate-300 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${refreshSummary.isPending ? "animate-spin" : ""}`} />
              Refresh Summary
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && summary.memberSummaries && summary.memberSummaries.length > 0 && (
          <div className="mb-6 space-y-4">
            {/* Executive Summary */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
                Today's Standup Summary
              </h3>
              <p className="text-sm text-white leading-relaxed">{summary.summary}</p>

              {/* Team Blockers */}
              {summary.teamBlockers && summary.teamBlockers.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-xs font-medium text-red-400 uppercase tracking-wider">
                    Blockers ({summary.teamBlockers.length})
                  </h4>
                  {summary.teamBlockers.map((b, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-lg border border-red-500/10 bg-red-500/5"
                    >
                      <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">{b.description}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-slate-500">From {b.reporter}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            b.severity === "high" ? "text-red-400 bg-red-400/10" :
                            b.severity === "medium" ? "text-amber-400 bg-amber-400/10" :
                            "text-slate-400 bg-slate-400/10"
                          }`}>
                            {b.severity}
                          </span>
                        </div>
                        {b.suggestedAction && (
                          <p className="text-xs text-slate-400 mt-1">Suggestion: {b.suggestedAction}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Items */}
              {summary.actionItems && summary.actionItems.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-medium text-blue-400 uppercase tracking-wider mb-2">
                    Action Items
                  </h4>
                  <ul className="space-y-1">
                    {summary.actionItems.map((item, i) => (
                      <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                        <span className="text-blue-400 mt-0.5">-</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Member Summaries */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {summary.memberSummaries.map((member, i) => {
                const badge = STATUS_BADGE[member.status] || STATUS_BADGE.on_track;
                const BadgeIcon = badge.icon;
                return (
                  <div
                    key={i}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-white">{member.respondent}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${badge.className}`}>
                        <BadgeIcon className="h-3 w-3" />
                        {badge.label}
                      </span>
                    </div>
                    {member.yesterday && (
                      <div className="mb-2">
                        <span className="text-xs text-slate-500">Yesterday:</span>
                        <p className="text-xs text-slate-300 mt-0.5">{member.yesterday}</p>
                      </div>
                    )}
                    {member.today && (
                      <div className="mb-2">
                        <span className="text-xs text-slate-500">Today:</span>
                        <p className="text-xs text-slate-300 mt-0.5">{member.today}</p>
                      </div>
                    )}
                    {member.blockers && (
                      <div>
                        <span className="text-xs text-red-400">Blockers:</span>
                        <p className="text-xs text-slate-300 mt-0.5">{member.blockers}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-white/[0.06] pb-px">
          <button
            onClick={() => setActiveTab("standups")}
            className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
              activeTab === "standups"
                ? "text-white border-b-2 border-blue-500"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Standup Responses
              {todayResponses.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                  {todayResponses.length}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("schedule")}
            className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
              activeTab === "schedule"
                ? "text-white border-b-2 border-blue-500"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Scheduled Jobs
              {jobs.filter((j) => j.isActive).length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                  {jobs.filter((j) => j.isActive).length}
                </span>
              )}
            </span>
          </button>
        </div>

        {/* Standups Tab */}
        {activeTab === "standups" && (
          <div className="flex-1 space-y-3">
            {todayQuery.isLoading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
              </div>
            )}

            {todayResponses.length === 0 && !todayQuery.isLoading && (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-300 mb-2">No standups today</h3>
                  <p className="text-sm text-slate-500 max-w-sm">
                    Standup responses will appear here when team members respond via Slack or the UI.
                  </p>
                </div>
              </div>
            )}

            {/* Today's responses */}
            {todayResponses.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                  Today ({todayResponses.length} responses)
                </h3>
                <div className="space-y-2">
                  {todayResponses.map((r) => {
                    const isExpanded = expandedResponse === r.id;
                    return (
                      <div
                        key={r.id}
                        className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
                      >
                        <div
                          className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
                          onClick={() => setExpandedResponse(isExpanded ? null : r.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">{r.respondent}</span>
                              <span className="text-xs text-slate-500">{formatTime(r.respondedAt)}</span>
                              <span className="text-xs text-slate-600 capitalize">{r.source}</span>
                            </div>
                            {!isExpanded && (
                              <p className="text-xs text-slate-400 mt-0.5 truncate">{r.rawText}</p>
                            )}
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="px-4 pb-3 space-y-2 border-t border-white/[0.04]">
                            {r.yesterday && (
                              <div className="pt-2">
                                <span className="text-xs font-medium text-slate-500">Yesterday:</span>
                                <p className="text-sm text-slate-300 mt-0.5">{r.yesterday}</p>
                              </div>
                            )}
                            {r.today && (
                              <div>
                                <span className="text-xs font-medium text-slate-500">Today:</span>
                                <p className="text-sm text-slate-300 mt-0.5">{r.today}</p>
                              </div>
                            )}
                            {r.blockers && (
                              <div>
                                <span className="text-xs font-medium text-red-400">Blockers:</span>
                                <p className="text-sm text-slate-300 mt-0.5">{r.blockers}</p>
                              </div>
                            )}
                            {!r.yesterday && !r.today && !r.blockers && (
                              <pre className="text-xs text-slate-400 whitespace-pre-wrap pt-2">{r.rawText}</pre>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent (past days) */}
            {recentResponses.length > todayResponses.length && (
              <div className="mt-6">
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                  Recent
                </h3>
                <div className="space-y-2">
                  {recentResponses
                    .filter((r) => !todayResponses.some((t) => t.id === r.id))
                    .slice(0, 20)
                    .map((r) => (
                      <div
                        key={r.id}
                        className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-3"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-slate-300">{r.respondent}</span>
                          <span className="text-xs text-slate-500">{formatDate(r.respondedAt)}</span>
                          <span className="text-xs text-slate-600 capitalize">{r.source}</span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2">{r.rawText}</p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === "schedule" && (
          <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">
                Automate standups, digests, and blocker checks with scheduled jobs.
              </p>
              <button
                onClick={() => setShowAddJob(!showAddJob)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium text-white transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Job
              </button>
            </div>

            {/* Add job form */}
            {showAddJob && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-white">New Scheduled Job</h3>
                  <button onClick={() => setShowAddJob(false)} className="text-slate-400 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400">Job Type</label>
                    <select
                      value={newJobType}
                      onChange={(e) => setNewJobType(e.target.value as JobType)}
                      className="w-full h-10 px-3 rounded-lg bg-white/[0.06] border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="standup">Daily Standup</option>
                      <option value="sprint_digest">Sprint Digest</option>
                      <option value="blocker_check">Blocker Check</option>
                      <option value="risk_detection">Risk Detection</option>
                      <option value="weekly_summary">Weekly Summary</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400">Cron Expression</label>
                    <input
                      value={newCron}
                      onChange={(e) => setNewCron(e.target.value)}
                      placeholder="0 9 * * 1-5"
                      className="w-full h-10 px-3 rounded-lg bg-white/[0.06] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <p className="text-xs text-slate-500">
                      {newJobType === "standup" && "e.g. 0 9 * * 1-5 (9am weekdays)"}
                      {newJobType === "sprint_digest" && "e.g. 0 17 * * 5 (5pm Fridays)"}
                      {newJobType === "blocker_check" && "e.g. 0 */6 * * * (every 6 hours)"}
                      {newJobType === "risk_detection" && "e.g. 0 */6 * * * (every 6 hours)"}
                      {newJobType === "weekly_summary" && "e.g. 0 17 * * 5 (5pm Fridays)"}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowAddJob(false)}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => createJobMutation.mutate()}
                    disabled={!newCron.trim() || createJobMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createJobMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Create Job
                  </button>
                </div>
                {createJobMutation.isError && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                    <p className="text-sm text-red-300">
                      {createJobMutation.error instanceof Error ? createJobMutation.error.message : "Failed to create job"}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Jobs list */}
            {jobsQuery.isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
              </div>
            )}

            {jobs.length === 0 && !jobsQuery.isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Calendar className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-300 mb-2">No scheduled jobs</h3>
                  <p className="text-sm text-slate-500 max-w-sm">
                    Create a scheduled job to automate standups, sprint digests, or blocker checks.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {jobs.map((job) => {
                const info = JOB_TYPE_LABELS[job.jobType] || JOB_TYPE_LABELS.standup;
                const JobIcon = info.icon;
                return (
                  <div
                    key={job.id}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${job.isActive ? "bg-blue-500/10 text-blue-400" : "bg-slate-500/10 text-slate-500"}`}>
                        <JobIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{info.label}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            job.isActive ? "text-emerald-400 bg-emerald-400/10" : "text-slate-500 bg-slate-500/10"
                          }`}>
                            {job.isActive ? "Active" : "Paused"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {job.cronExpression}
                          </span>
                          {job.lastRunAt && (
                            <span className="text-xs text-slate-500">
                              Last: {formatDate(job.lastRunAt)}
                              {job.lastRunStatus && (
                                <span className={`ml-1 ${job.lastRunStatus === "success" ? "text-emerald-400" : "text-red-400"}`}>
                                  ({job.lastRunStatus})
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => triggerJobMutation.mutate(job.id)}
                          disabled={triggerJobMutation.isPending}
                          className="p-1.5 text-slate-400 hover:text-blue-400 transition-colors"
                          title="Run now"
                        >
                          <Play className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleJobMutation.mutate(job)}
                          className="p-1.5 text-slate-400 hover:text-white transition-colors"
                          title={job.isActive ? "Pause" : "Resume"}
                        >
                          {job.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => deleteJobMutation.mutate(job.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Cockpit>
  );
}
