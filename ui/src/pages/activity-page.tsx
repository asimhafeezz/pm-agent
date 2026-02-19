import { Cockpit } from "@/components/layout/cockpit";
import { useState, useEffect } from "react";
import { Activity, Loader2, RefreshCw, Mail, GitBranch, FileText, Bot, Users } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { fetchActivityStream, type ActivityEvent } from "@/api/activity.api";

const SOURCE_ICONS: Record<string, typeof Activity> = {
  linear: GitBranch,
  gmail: Mail,
  notion: FileText,
  agent: Bot,
  meeting: Users,
  manual: Activity,
};

const SOURCE_COLORS: Record<string, string> = {
  linear: "text-indigo-400",
  gmail: "text-red-400",
  notion: "text-slate-300",
  agent: "text-emerald-400",
  meeting: "text-amber-400",
  manual: "text-slate-400",
};

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export function ActivityPage() {
  const { token } = useAuth();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const loadEvents = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const params: { source?: string; limit: number } = { limit: 50 };
      if (sourceFilter !== "all") params.source = sourceFilter;
      const result = await fetchActivityStream(token, params);
      setEvents(result.events);
      setTotal(result.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load activity");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [token, sourceFilter]);

  const sources = ["all", "linear", "gmail", "notion", "agent", "meeting"];

  return (
    <Cockpit>
      <div className="flex flex-col h-full p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Activity</h1>
            <p className="text-sm text-slate-400 mt-1">
              Real-time feed of events across all connected tools
            </p>
          </div>
          <button
            onClick={loadEvents}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 rounded-xl text-sm font-medium text-white transition-colors"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </button>
        </div>

        {/* Source filter tabs */}
        <div className="flex gap-1 mb-6">
          {sources.map((source) => (
            <button
              key={source}
              onClick={() => setSourceFilter(source)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${
                sourceFilter === source
                  ? "bg-white/[0.08] text-white"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              {source}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Event feed */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {events.length === 0 && !isLoading && (
            <div className="flex-1 flex items-center justify-center py-20">
              <div className="text-center">
                <Activity className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-300 mb-2">
                  No activity yet
                </h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  Connect your integrations (Linear, Gmail, Notion) to start seeing
                  activity here. Events from webhooks and agent actions will appear
                  in real-time.
                </p>
              </div>
            </div>
          )}

          {events.map((event) => {
            const Icon = SOURCE_ICONS[event.source] || Activity;
            const colorClass = SOURCE_COLORS[event.source] || "text-slate-400";

            return (
              <div
                key={event.id}
                className="flex items-start gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
              >
                <div className={`mt-0.5 ${colorClass}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-slate-500 uppercase">
                      {event.source}
                    </span>
                    <span className="text-xs text-slate-600">
                      {event.eventType.replace(/_/g, " ")}
                    </span>
                  </div>
                  {event.title && (
                    <p className="text-sm font-medium text-white truncate">
                      {event.title}
                    </p>
                  )}
                  {event.summary && (
                    <p className="text-sm text-slate-400 line-clamp-2">
                      {event.summary}
                    </p>
                  )}
                </div>
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {formatTime(event.occurredAt || event.createdAt)}
                </span>
              </div>
            );
          })}
        </div>

        {total > events.length && (
          <div className="mt-4 text-center">
            <p className="text-xs text-slate-500">
              Showing {events.length} of {total} events
            </p>
          </div>
        )}
      </div>
    </Cockpit>
  );
}
