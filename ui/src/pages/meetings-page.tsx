import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Cockpit } from "@/components/layout/cockpit";
import { useAuth } from "@/components/auth/auth-provider";
import { useProjectStore } from "@/store/project-store";
import {
  fetchMeetings,
  createMeeting,
  deleteMeeting,
  reprocessMeeting,
  updateInsightStatus,
  type Meeting,
} from "@/api/meetings.api";
import {
  Loader2,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Target,
  Lightbulb,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  X,
  FileText,
} from "lucide-react";

const STATUS_CONFIG: Record<
  Meeting["status"],
  { icon: React.ElementType; label: string; className: string }
> = {
  pending: { icon: Clock, label: "Pending", className: "text-yellow-400 bg-yellow-400/10" },
  processing: { icon: Loader2, label: "Processing", className: "text-blue-400 bg-blue-400/10" },
  processed: { icon: CheckCircle2, label: "Processed", className: "text-emerald-400 bg-emerald-400/10" },
  failed: { icon: AlertCircle, label: "Failed", className: "text-red-400 bg-red-400/10" },
};

const INSIGHT_ICONS: Record<string, React.ElementType> = {
  action_item: Target,
  decision: Lightbulb,
  blocker: AlertTriangle,
  follow_up: ArrowRight,
  status_update: BarChart3,
};

const INSIGHT_COLORS: Record<string, string> = {
  action_item: "text-blue-400 bg-blue-400/10",
  decision: "text-emerald-400 bg-emerald-400/10",
  blocker: "text-red-400 bg-red-400/10",
  follow_up: "text-amber-400 bg-amber-400/10",
  status_update: "text-slate-400 bg-slate-400/10",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MeetingsPage() {
  const { token } = useAuth();
  const activeProject = useProjectStore((s) => s.activeProject);
  const qc = useQueryClient();

  const [showUpload, setShowUpload] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [source, setSource] = useState("upload");

  const projectId = activeProject?.id;

  const meetingsQuery = useQuery({
    queryKey: ["meetings", projectId],
    queryFn: () => fetchMeetings(projectId!, token!),
    enabled: !!token && !!projectId,
    refetchInterval: 10000,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createMeeting(projectId!, token!, {
        title,
        rawTranscript: transcript,
        meetingDate: meetingDate || undefined,
        source,
      }),
    onSuccess: () => {
      setShowUpload(false);
      setTitle("");
      setTranscript("");
      setMeetingDate("");
      setSource("upload");
      qc.invalidateQueries({ queryKey: ["meetings", projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMeeting(id, token!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings", projectId] }),
  });

  const reprocessMutation = useMutation({
    mutationFn: (id: string) => reprocessMeeting(id, token!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings", projectId] }),
  });

  const dismissInsight = useMutation({
    mutationFn: ({ meetingId, insightId }: { meetingId: string; insightId: string }) =>
      updateInsightStatus(meetingId, insightId, token!, { status: "dismissed" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings", projectId] }),
  });

  const meetings = meetingsQuery.data ?? [];

  if (!projectId) {
    return (
      <Cockpit>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <FileText className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-300 mb-2">No project selected</h3>
            <p className="text-sm text-slate-500">Select a project to view meetings.</p>
          </div>
        </div>
      </Cockpit>
    );
  }

  return (
    <Cockpit>
      <div className="flex flex-col h-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Meetings</h1>
            <p className="text-sm text-slate-400 mt-1">
              Upload meeting transcripts to extract action items, decisions, and blockers
            </p>
          </div>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium text-white transition-colors"
          >
            <Plus className="h-4 w-4" />
            Upload Transcript
          </button>
        </div>

        {/* Upload form */}
        {showUpload && (
          <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">New Meeting Transcript</h3>
              <button onClick={() => setShowUpload(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Daily Standup - Feb 18"
                  className="w-full h-10 px-3 rounded-lg bg-white/[0.06] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Meeting Date</label>
                <input
                  type="datetime-local"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-white/[0.06] border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white/[0.06] border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="upload">Manual Upload</option>
                <option value="otter">Otter.ai</option>
                <option value="fireflies">Fireflies.ai</option>
                <option value="google_meet">Google Meet</option>
                <option value="zoom">Zoom</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Transcript</label>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste the meeting transcript here..."
                rows={8}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowUpload(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!title.trim() || !transcript.trim() || createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Process Transcript
              </button>
            </div>

            {createMutation.isError && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <p className="text-sm text-red-300">
                  {createMutation.error instanceof Error ? createMutation.error.message : "Failed to create meeting"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Meetings list */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {meetingsQuery.isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
            </div>
          )}

          {meetings.length === 0 && !meetingsQuery.isLoading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <FileText className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-300 mb-2">No meetings yet</h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  Upload a meeting transcript to extract action items, decisions, and blockers automatically.
                </p>
              </div>
            </div>
          )}

          {meetings.map((meeting) => {
            const config = STATUS_CONFIG[meeting.status];
            const StatusIcon = config.icon;
            const isExpanded = expandedId === meeting.id;
            const insights = meeting.insights ?? [];

            return (
              <div
                key={meeting.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
              >
                {/* Meeting header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/[0.03] transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : meeting.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-white truncate">{meeting.title}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${config.className}`}>
                        <StatusIcon className={`h-3 w-3 ${meeting.status === "processing" ? "animate-spin" : ""}`} />
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-500">
                        {meeting.meetingDate ? formatDate(meeting.meetingDate) : formatDate(meeting.createdAt)}
                      </span>
                      <span className="text-xs text-slate-600 capitalize">{meeting.source}</span>
                      {meeting.insightCount > 0 && (
                        <span className="text-xs text-slate-400">{meeting.insightCount} insights</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {meeting.status === "failed" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); reprocessMutation.mutate(meeting.id); }}
                        className="p-1.5 text-slate-400 hover:text-white transition-colors"
                        title="Reprocess"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(meeting.id); }}
                      className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-white/[0.06]">
                    {/* Error message */}
                    {meeting.processingError && (
                      <div className="mx-4 mt-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                        <p className="text-sm text-red-300">{meeting.processingError}</p>
                      </div>
                    )}

                    {/* Insights */}
                    {insights.length > 0 && (
                      <div className="p-4 space-y-2">
                        <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                          Extracted Insights
                        </h4>
                        {insights.map((insight) => {
                          const InsightIcon = INSIGHT_ICONS[insight.insightType] || Target;
                          const colorClass = INSIGHT_COLORS[insight.insightType] || "text-slate-400 bg-slate-400/10";
                          const isDismissed = insight.status === "dismissed";

                          return (
                            <div
                              key={insight.id}
                              className={`flex items-start gap-3 p-3 rounded-lg border border-white/[0.04] bg-white/[0.02] ${isDismissed ? "opacity-40" : ""}`}
                            >
                              <div className={`mt-0.5 p-1 rounded ${colorClass}`}>
                                <InsightIcon className="h-3 w-3" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-xs font-medium text-slate-500 capitalize">
                                    {insight.insightType.replace(/_/g, " ")}
                                  </span>
                                  {insight.priority && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                                      insight.priority === "high" ? "text-red-400 bg-red-400/10" :
                                      insight.priority === "medium" ? "text-amber-400 bg-amber-400/10" :
                                      "text-slate-400 bg-slate-400/10"
                                    }`}>
                                      {insight.priority}
                                    </span>
                                  )}
                                  {insight.assignee && (
                                    <span className="text-xs text-slate-500">@{insight.assignee}</span>
                                  )}
                                </div>
                                <p className="text-sm text-white">{insight.content}</p>
                              </div>
                              {!isDismissed && (
                                <button
                                  onClick={() => dismissInsight.mutate({ meetingId: meeting.id, insightId: insight.id })}
                                  className="p-1 text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                                  title="Dismiss"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Transcript preview */}
                    <div className="p-4 border-t border-white/[0.04]">
                      <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                        Transcript
                      </h4>
                      <pre className="text-xs text-slate-400 whitespace-pre-wrap max-h-48 overflow-y-auto font-mono leading-relaxed">
                        {meeting.rawTranscript.slice(0, 2000)}
                        {meeting.rawTranscript.length > 2000 && "\n\n... [truncated]"}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Cockpit>
  );
}
