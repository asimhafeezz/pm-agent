import { Cockpit } from "@/components/layout/cockpit";
import { useEffect, useMemo, useState } from "react";
import {
  Map,
  Loader2,
  CheckCircle2,
  Settings2,
  Sparkles,
  Target,
  ArrowRight,
  CalendarClock,
} from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { useIntegrationsStore } from "@/store/integrations-store";
import { useAuth } from "@/components/auth/auth-provider";
import { apiUrl } from "@/lib/api";
import { Link } from "react-router-dom";

type RoadmapItem = {
  title: string;
  objective?: string;
  priority?: string;
  riceScore?: number;
  milestones?: string[];
};

type TicketItem = {
  title: string;
  description?: string;
  priority?: number;
  labels?: string[];
  acceptanceCriteria?: string[];
};

type RoadmapPhase = "now" | "next" | "later";

function inferPhase(item: RoadmapItem, index: number, total: number): RoadmapPhase {
  const raw = String(item.priority || "").toLowerCase();
  if (["p0", "high", "urgent", "critical", "now"].some((word) => raw.includes(word))) {
    return "now";
  }
  if (["p1", "medium", "next"].some((word) => raw.includes(word))) {
    return "next";
  }
  if (["p2", "p3", "low", "later", "backlog"].some((word) => raw.includes(word))) {
    return "later";
  }

  const segment = Math.max(1, Math.ceil(total / 3));
  if (index < segment) return "now";
  if (index < segment * 2) return "next";
  return "later";
}

function priorityLabel(phase: RoadmapPhase) {
  if (phase === "now") return "Now";
  if (phase === "next") return "Next";
  return "Later";
}

function phaseStyles(phase: RoadmapPhase) {
  if (phase === "now") {
    return {
      lane: "border-emerald-400/30 bg-emerald-500/[0.07]",
      dot: "bg-emerald-300",
      badge: "text-emerald-200 bg-emerald-500/20 border border-emerald-400/30",
    };
  }
  if (phase === "next") {
    return {
      lane: "border-sky-400/30 bg-sky-500/[0.07]",
      dot: "bg-sky-300",
      badge: "text-sky-200 bg-sky-500/20 border border-sky-400/30",
    };
  }
  return {
    lane: "border-violet-400/30 bg-violet-500/[0.07]",
    dot: "bg-violet-300",
    badge: "text-violet-200 bg-violet-500/20 border border-violet-400/30",
  };
}

function tokenize(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);
}

export function RoadmapPage() {
  const activeProject = useProjectStore((s) => s.activeProject);
  const linear = useIntegrationsStore((s) => s.linear);
  const { token } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([]);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeRoadmapIndex, setActiveRoadmapIndex] = useState(0);
  const [expandedTicketIndex, setExpandedTicketIndex] = useState<number | null>(
    null
  );

  const generate = async (createLinearTickets: boolean) => {
    if (!activeProject || !token) return;
    if (createLinearTickets && !linear.teamId) {
      setError("Select a Linear Team in Integrations first.");
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      const response = await fetch(apiUrl("/agent/generate-roadmap"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId: activeProject.id,
          createLinearTickets,
          linearTeamId: linear.teamId || undefined,
          linearProjectId: linear.projectId || undefined,
          assigneeId: linear.assigneeId || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail || payload?.message || "Failed to generate roadmap");
      }
      setRoadmap(Array.isArray(payload.roadmap) ? payload.roadmap : []);
      setTickets(Array.isArray(payload.tickets) ? payload.tickets : []);
      setActiveRoadmapIndex(0);
      setExpandedTicketIndex(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate roadmap");
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (activeRoadmapIndex >= roadmap.length) {
      setActiveRoadmapIndex(0);
    }
  }, [activeRoadmapIndex, roadmap.length]);

  const phaseGroups = useMemo(() => {
    const groups: Record<RoadmapPhase, Array<{ item: RoadmapItem; index: number }>> = {
      now: [],
      next: [],
      later: [],
    };
    roadmap.forEach((item, index) => {
      groups[inferPhase(item, index, roadmap.length)].push({ item, index });
    });
    return groups;
  }, [roadmap]);

  const activeRoadmap = roadmap[activeRoadmapIndex] || null;

  const focusedTickets = useMemo(() => {
    if (!activeRoadmap || roadmap.length === 0) return tickets;
    const topicTokens = new Set(
      tokenize([activeRoadmap.title, activeRoadmap.objective || ""].join(" "))
    );
    if (topicTokens.size === 0) {
      return tickets;
    }

    const scored = tickets.map((ticket, index) => {
      const words = tokenize(`${ticket.title} ${ticket.description || ""}`);
      const score = words.reduce((acc, word) => acc + (topicTokens.has(word) ? 1 : 0), 0);
      return { ticket, index, score };
    });

    const matches = scored
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.ticket);
    if (matches.length > 0) return matches;

    return tickets.filter((_, index) => index % roadmap.length === activeRoadmapIndex);
  }, [activeRoadmap, activeRoadmapIndex, roadmap.length, tickets]);

  const averageRice = useMemo(() => {
    const values = roadmap
      .map((item) => Number(item.riceScore))
      .filter((value) => Number.isFinite(value));
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [roadmap]);

  return (
    <Cockpit>
      <div className="flex flex-col h-full p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-white">Roadmap</h1>
            <p className="text-sm text-slate-400 mt-1">
              Interactive planning board with priorities, sequencing, and ticket handoff
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => generate(false)}
              disabled={!activeProject || isGenerating}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-40"
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Generate Roadmap
            </button>
            <button
              onClick={() => generate(true)}
              disabled={!activeProject || isGenerating}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-40"
            >
              Push Tickets
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Initiatives</p>
            <p className="text-lg font-semibold text-white mt-0.5">{roadmap.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Draft Tickets</p>
            <p className="text-lg font-semibold text-white mt-0.5">{tickets.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Avg RICE</p>
            <p className="text-lg font-semibold text-white mt-0.5">
              {averageRice === null ? "-" : averageRice.toFixed(1)}
            </p>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <div className="mb-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
          <div>
            Linear target:
            {" "}
            {linear.teamId ? (
              <>
                team <span className="text-slate-200">{linear.teamId}</span>
                {linear.projectId ? <> / project <span className="text-slate-200">{linear.projectId}</span></> : null}
              </>
            ) : (
              "not configured"
            )}
          </div>
          <Link to="/integrations" className="inline-flex items-center gap-1 text-slate-200 hover:text-white">
            <Settings2 className="h-3.5 w-3.5" />
            Configure
          </Link>
        </div>

        {roadmap.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Map className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-300 mb-2">
                No roadmaps yet
              </h3>
              <p className="text-sm text-slate-500 max-w-sm">
                Extract knowledge from your documents first, then generate a
                prioritized roadmap with RICE scoring.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
              {(["now", "next", "later"] as RoadmapPhase[]).map((phase) => {
                const items = phaseGroups[phase];
                const styles = phaseStyles(phase);
                return (
                  <div
                    key={phase}
                    className={`rounded-2xl border p-3 ${styles.lane} min-h-[200px]`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="inline-flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${styles.dot}`} />
                        <span className="text-sm font-semibold text-white">
                          {priorityLabel(phase)}
                        </span>
                      </div>
                      <span className="text-xs text-slate-300">{items.length}</span>
                    </div>
                    <div className="space-y-2">
                      {items.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-white/15 px-3 py-6 text-center text-xs text-slate-500">
                          No initiatives in this lane
                        </div>
                      ) : (
                        items.map(({ item, index }) => (
                          <button
                            key={`${item.title}-${index}`}
                            onClick={() => setActiveRoadmapIndex(index)}
                            className={`w-full text-left rounded-xl border px-3 py-3 transition-all ${
                              activeRoadmapIndex === index
                                ? "border-white/30 bg-white/[0.11] shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
                                : "border-white/10 bg-black/25 hover:bg-white/[0.07]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-white truncate">{item.title}</p>
                              <span className={`text-[10px] px-2 py-1 rounded-full ${styles.badge}`}>
                                RICE {item.riceScore ?? "-"}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                              {item.objective || "No objective provided"}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-4 min-h-0 overflow-y-auto pr-1">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                {activeRoadmap ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2 text-xs text-slate-300 bg-white/[0.06] border border-white/10 rounded-full px-2.5 py-1">
                        <Sparkles className="h-3.5 w-3.5" />
                        Initiative Focus
                      </div>
                      <div className="text-xs text-slate-400">
                        #{activeRoadmapIndex + 1} of {roadmap.length}
                      </div>
                    </div>

                    <h2 className="mt-3 text-2xl font-semibold text-white leading-tight">
                      {activeRoadmap.title}
                    </h2>
                    <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                      {activeRoadmap.objective || "No objective provided."}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">RICE Score</p>
                        <p className="text-lg font-semibold text-white mt-0.5">
                          {activeRoadmap.riceScore ?? "-"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Priority</p>
                        <p className="text-lg font-semibold text-white mt-0.5">
                          {String(activeRoadmap.priority || "Auto")}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5">
                      <p className="text-xs text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5" />
                        Milestones
                      </p>
                      <div className="mt-2 space-y-2">
                        {(activeRoadmap.milestones || []).length === 0 ? (
                          <div className="rounded-xl border border-dashed border-white/15 px-3 py-4 text-sm text-slate-500">
                            No milestones generated for this initiative.
                          </div>
                        ) : (
                          (activeRoadmap.milestones || []).map((milestone, idx) => (
                            <div
                              key={`${milestone}-${idx}`}
                              className="flex items-start gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2"
                            >
                              <CalendarClock className="h-4 w-4 mt-0.5 text-slate-400" />
                              <p className="text-sm text-slate-200">{milestone}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-white">
                    Ticket Drafts
                  </h2>
                  <span className="text-xs text-slate-400">
                    {focusedTickets.length} linked
                  </span>
                </div>
                <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
                  {focusedTickets.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/15 px-3 py-4 text-sm text-slate-500">
                      Generate roadmap to see ticket drafts.
                    </div>
                  ) : (
                    focusedTickets.slice(0, 40).map((ticket, idx) => (
                      <button
                        key={`${ticket.title}-${idx}`}
                        onClick={() =>
                          setExpandedTicketIndex((prev) => (prev === idx ? null : idx))
                        }
                        className="w-full text-left rounded-xl border border-white/10 bg-black/25 px-3 py-3 hover:bg-white/[0.06] transition-colors"
                      >
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-slate-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-white">{ticket.title}</p>
                              <ArrowRight
                                className={`h-4 w-4 text-slate-500 transition-transform ${
                                  expandedTicketIndex === idx ? "rotate-90" : ""
                                }`}
                              />
                            </div>
                            <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                              {ticket.description || "No description provided."}
                            </p>
                            {expandedTicketIndex === idx ? (
                              <div className="mt-2 border-t border-white/10 pt-2 space-y-2">
                                {ticket.priority !== undefined ? (
                                  <p className="text-xs text-slate-300">
                                    Priority: {ticket.priority}
                                  </p>
                                ) : null}
                                {(ticket.labels || []).length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {(ticket.labels || []).map((label) => (
                                      <span
                                        key={label}
                                        className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.06] text-slate-300"
                                      >
                                        {label}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Cockpit>
  );
}
