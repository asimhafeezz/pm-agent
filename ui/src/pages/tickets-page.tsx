import { Cockpit } from "@/components/layout/cockpit";
import { useState } from "react";
import { Ticket, Plus, Loader2 } from "lucide-react";
import { useIntegrationsStore } from "@/store/integrations-store";
import { fetchLinearSyncSummary } from "@/api/linear.api";
import { useAuth } from "@/components/auth/auth-provider";

type SyncSummary = {
  total: number;
  blocked: number;
  overdue: number;
  stale: number;
  completionPct: number;
};

export function TicketsPage() {
  const linear = useIntegrationsStore((s) => s.linear);
  const setLinear = useIntegrationsStore((s) => s.setLinear);
  const { token } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSync = async () => {
    if (!token) {
      setError("Missing auth token. Please login again.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const payload = await fetchLinearSyncSummary(token, {
        teamId: linear.teamId || undefined,
        projectId: linear.projectId || undefined,
      });
      setSummary(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sync summary");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Cockpit>
      <div className="flex flex-col h-full p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Tickets</h1>
            <p className="text-sm text-slate-400 mt-1">
              Manage epics, stories, and tasks
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 rounded-xl text-sm font-medium text-white transition-colors">
            <Plus className="h-4 w-4" />
            Create Ticket
          </button>
        </div>

        {/* View tabs */}
        <div className="flex gap-1 mb-6">
          {["Board", "List", "Sprint"].map((view) => (
            <button
              key={view}
              className="px-4 py-2 text-sm font-medium rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors first:bg-white/[0.08] first:text-white"
            >
              {view}
            </button>
          ))}
        </div>

        <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-medium text-white mb-3">Phase 2 Sync Loop</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={linear.teamId}
              onChange={(e) => setLinear({ teamId: e.target.value })}
              placeholder="Linear teamId"
              className="h-9 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-slate-500"
            />
            <input
              value={linear.projectId}
              onChange={(e) => setLinear({ projectId: e.target.value })}
              placeholder="Linear projectId (optional)"
              className="h-9 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-slate-500"
            />
            <button
              onClick={loadSync}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.08] px-3 py-2 text-sm text-white"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Refresh Sync
            </button>
          </div>
          {summary ? (
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-300 md:grid-cols-5">
              <div>Total: {summary.total}</div>
              <div>Blocked: {summary.blocked}</div>
              <div>Overdue: {summary.overdue}</div>
              <div>Stale: {summary.stale}</div>
              <div>Done: {summary.completionPct}%</div>
            </div>
          ) : null}
          {error ? (
            <p className="mt-3 text-xs text-red-300">{error}</p>
          ) : null}
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Ticket className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-300 mb-2">
              No tickets yet
            </h3>
            <p className="text-sm text-slate-500 max-w-sm">
              Generate tickets from your roadmap or create them manually.
              Tickets can be synced to Linear.
            </p>
          </div>
        </div>
      </div>
    </Cockpit>
  );
}
