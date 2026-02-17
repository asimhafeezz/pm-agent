import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/glass-card";
import { Modal } from "@/components/ui/modal";
import { ChevronDown, ChevronUp, ExternalLink, FileText, TrendingUp, TrendingDown } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface DeepAnalysisSection {
    id: string;
    title: string;
    content: string;
    score?: number;
    signals?: string[];
    sources?: Array<{ title: string; url: string; snippet?: string }>;
}

export interface DeepAnalysisVisualization {
    type: "deep_analysis";
    symbol: string;
    title?: string;  // Generated title for the analysis
    recommendation: {
        action: "buy" | "hold" | "wait" | "sell";
        confidence: number;
        reasoning?: string;
    };
    scoreBreakdown: Record<string, number>;
    sections: DeepAnalysisSection[];
    sources: Array<{
        type: string;
        name: string;
        dataPoints?: number;
        queries?: string[];
    }>;
    priceChart?: any;
    revenueChart?: any;
    comparisonChart?: any;
    positionSizing?: {
        suggestedQty: number;
        suggestedAmount: number | null;
        currentPrice: number | null;
        maxPositionPct: number;
        reasoning: string;
        assetType?: string;
        amountType?: 'usd' | 'shares';
    };
}

interface DeepAnalysisReportProps {
    visualization: DeepAnalysisVisualization;
    onTradeClick?: (
        symbol: string,
        side: string,
        suggestedAmount: number | null,
        suggestedQty: number,
        assetType?: string,
        amountType?: 'usd' | 'shares',
        currentPrice?: number | null
    ) => void;
}

const ACTION_STYLES = {
    buy: {
        bg: "bg-emerald-500/15",
        border: "border-emerald-500/30",
        text: "text-emerald-400",
        label: "BUY",
    },
    hold: {
        bg: "bg-amber-500/15",
        border: "border-amber-500/30",
        text: "text-amber-400",
        label: "HOLD",
    },
    wait: {
        bg: "bg-slate-500/15",
        border: "border-slate-500/30",
        text: "text-slate-400",
        label: "WAIT",
    },
    sell: {
        bg: "bg-red-500/15",
        border: "border-red-500/30",
        text: "text-red-400",
        label: "SELL",
    },
};

const SCORE_LABELS: Record<string, string> = {
    suitability: "Suitability",
    fundamentals: "Fundamentals",
    sentiment: "News Sentiment",
    webSentiment: "Web Research",
    priceContext: "Price Action",
};

const SCORE_COLORS: Record<string, string> = {
    suitability: "#6366f1",
    fundamentals: "#10b981",
    sentiment: "#f59e0b",
    webSentiment: "#06b6d4",
    priceContext: "#ec4899",
};

const SECTION_ACCENT_COLORS = [
    "#6366f1", // indigo
    "#10b981", // emerald
    "#f59e0b", // amber
    "#06b6d4", // cyan
    "#ec4899", // pink
];

// Shared markdown components for ReactMarkdown
const markdownComponents = {
    strong: ({ node, ...props }: any) => <strong className="text-white font-semibold" {...props} />,
    a: ({ node, ...props }: any) => (
        <a
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 underline-offset-2"
            {...props}
        />
    ),
    ul: ({ node, ...props }: any) => <ul className="list-disc pl-4 space-y-1.5" {...props} />,
    ol: ({ node, ...props }: any) => <ol className="list-decimal pl-4 space-y-1.5" {...props} />,
    li: ({ node, ...props }: any) => <li className="text-slate-400" {...props} />,
    p: ({ node, ...props }: any) => <p className="mb-2.5" {...props} />,
    h3: ({ node, ...props }: any) => <h3 className="text-white text-sm font-semibold mt-4 mb-2" {...props} />,
    h4: ({ node, ...props }: any) => <h4 className="text-slate-300 text-[13px] font-semibold mt-3 mb-1.5" {...props} />,
};

function ConfidenceRing({ confidence, size = "md" }: { confidence: number; size?: "md" | "lg" }) {
    const percentage = Math.round(confidence * 100);
    const dim = size === "lg" ? 80 : 64;
    const radius = size === "lg" ? 34 : 28;
    const strokeW = size === "lg" ? 5 : 4;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (confidence * circumference);

    return (
        <div className={`relative shrink-0 ${size === "lg" ? "h-20 w-20" : "h-16 w-16"}`}>
            <svg className={`${size === "lg" ? "h-20 w-20" : "h-16 w-16"} -rotate-90`} viewBox={`0 0 ${dim} ${dim}`}>
                <circle cx={dim / 2} cy={dim / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeW} />
                <circle
                    cx={dim / 2}
                    cy={dim / 2}
                    r={radius}
                    fill="none"
                    stroke={confidence >= 0.6 ? "#10b981" : confidence >= 0.4 ? "#f59e0b" : "#64748b"}
                    strokeWidth={strokeW}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className={`font-bold text-white ${size === "lg" ? "text-base" : "text-sm"}`}>{percentage}%</span>
            </div>
        </div>
    );
}

function ScoreBreakdownChart({ scoreBreakdown }: { scoreBreakdown: Record<string, number> }) {
    const chartData = useMemo(() => {
        return Object.entries(scoreBreakdown)
            .filter(([key]) => SCORE_LABELS[key])
            .map(([key, value]) => ({
                name: SCORE_LABELS[key] || key,
                value: Math.round(value * 100),
                fill: SCORE_COLORS[key] || "#64748b",
                key,
            }));
    }, [scoreBreakdown]);

    if (chartData.length === 0) return null;

    return (
        <div className="pt-4 pb-1 border-t border-white/[0.04]">
            <h4 className="text-[10px] uppercase tracking-widest text-slate-500/80 font-semibold mb-4">Score Breakdown</h4>
            <div className="space-y-3">
                {chartData.map((item) => (
                    <div key={item.key} className="flex items-center gap-2 sm:gap-3">
                        <span className="text-[10px] sm:text-[11px] text-slate-400 w-20 sm:w-28 shrink-0 text-right">{item.name}</span>
                        <div className="relative flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                            <div
                                className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
                                style={{
                                    width: `${Math.abs(Math.max(item.value, 2))}%`,
                                    backgroundColor: item.fill,
                                    opacity: item.value < 0 ? 0.5 : 0.85,
                                }}
                            />
                        </div>
                        <span className={`text-[11px] w-10 shrink-0 text-right tabular-nums font-medium ${item.value > 0 ? "text-slate-400" : item.value < 0 ? "text-slate-500" : "text-slate-600"}`}>
                            {item.value}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function SectionTabs({ sections, activeTab, onTabChange }: {
    sections: DeepAnalysisSection[];
    activeTab: string;
    onTabChange: (id: string) => void;
}) {
    return (
        <div className="pt-4 border-t border-white/[0.04]">
            <div className="flex gap-1 overflow-x-auto pb-0.5 -mx-1 px-1 chat-scroll scroll-smooth">
                {sections.map((section) => (
                    <button
                        key={section.id}
                        onClick={() => onTabChange(section.id)}
                        className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-[11px] font-medium whitespace-nowrap transition-all duration-150 ${activeTab === section.id
                            ? "bg-white/[0.08] text-white border border-white/[0.1] shadow-sm"
                            : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] border border-transparent"
                            }`}
                    >
                        {section.title}
                    </button>
                ))}
            </div>
        </div>
    );
}

function SourcesFooter({ sources }: { sources: DeepAnalysisVisualization["sources"] }) {
    const [expanded, setExpanded] = useState(false);
    const totalDataPoints = sources.reduce((sum, s) => sum + (s.dataPoints || 0), 0);

    return (
        <div className="border-t border-white/[0.06] pt-3 mt-4">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 text-[11px] text-slate-500 hover:text-slate-300 transition-colors w-full"
            >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{sources.length} sources analyzed · {totalDataPoints} data points</span>
                {expanded ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
            </button>

            {expanded && (
                <div className="mt-2 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    {sources.map((source, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px] text-slate-500 pl-5">
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${source.type === "web" ? "bg-cyan-500/60" : "bg-emerald-500/60"
                                }`} />
                            <span>{source.name}</span>
                            {source.dataPoints !== undefined && (
                                <span className="text-slate-600">({source.dataPoints} points)</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function InlineMarketCharts({ visualization }: { visualization: DeepAnalysisVisualization }) {
    const priceChart = visualization.priceChart;
    const revenueChart = visualization.revenueChart;

    const priceData = Array.isArray(priceChart?.data)
        ? [...priceChart.data]
            .map((p: any) => ({
                time: p?.datetime || p?.date,
                value: Number(p?.close ?? 0),
            }))
            .filter((p: any) => p.time && Number.isFinite(p.value))
            .slice(-60)
        : [];

    const revenueData = Array.isArray(revenueChart?.data)
        ? revenueChart.data
            .map((p: any) => ({
                label: new Date(p?.date || "").toLocaleDateString("en-US", { year: "numeric", month: "short" }),
                value: Number(p?.revenue ?? 0),
            }))
            .filter((p: any) => p.label && Number.isFinite(p.value))
        : [];
    const comparisonChart = visualization.comparisonChart;
    const comparisonSymbols: string[] = Array.isArray(comparisonChart?.symbols) ? comparisonChart.symbols : [];
    const comparisonWinner = comparisonChart?.winner;

    if (priceData.length === 0 && revenueData.length === 0 && comparisonSymbols.length === 0) {
        return null;
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {priceData.length > 0 && (
                <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-3">
                    <p className="text-[11px] text-slate-400 mb-2">Price Trend</p>
                    <div className="h-32">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={priceData}>
                                <XAxis dataKey="time" hide />
                                <YAxis hide />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", borderRadius: "8px" }}
                                    formatter={(value: number | string | undefined) => [`$${Number(value || 0).toFixed(2)}`, "Price"]}
                                />
                                <Area type="monotone" dataKey="value" stroke="#10b981" fill="#10b98133" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
            {revenueData.length > 0 && (
                <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-3">
                    <p className="text-[11px] text-slate-400 mb-2">Revenue Trend</p>
                    <div className="h-32">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={revenueData}>
                                <XAxis dataKey="label" hide />
                                <YAxis hide />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", borderRadius: "8px" }}
                                    formatter={(value: number | string | undefined) => [`$${Number(value || 0).toLocaleString()}`, "Revenue"]}
                                />
                                <Bar dataKey="value" fill="#6366f1" radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
            {comparisonSymbols.length > 0 && (
                <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-3 lg:col-span-2">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] text-slate-400">Comparison Snapshot</p>
                        {comparisonWinner?.symbol && (
                            <p className="text-[11px] text-emerald-400 font-semibold">
                                Winner: {comparisonWinner.symbol}
                                {typeof comparisonWinner.value === "number" && (
                                    <span className="text-slate-400 font-medium ml-1">
                                        {comparisonWinner.source === "score_confidence"
                                            ? `${Math.round(comparisonWinner.value * 100)} pts`
                                            : `${comparisonWinner.value >= 0 ? "+" : ""}${comparisonWinner.value.toFixed(2)}%`}
                                    </span>
                                )}
                            </p>
                        )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                        {comparisonSymbols.join(" vs ")}
                    </p>
                </div>
            )}
        </div>
    );
}

/* ─── Full Report Modal ─────────────────────────────────────────────── */

function DeepAnalysisModal({ visualization, onClose, onTradeClick }: {
    visualization: DeepAnalysisVisualization;
    onClose: () => void;
    onTradeClick?: (
        symbol: string,
        side: string,
        suggestedAmount: number | null,
        suggestedQty: number,
        assetType?: string,
        amountType?: 'usd' | 'shares',
        currentPrice?: number | null
    ) => void;
}) {
    const { symbol, title, recommendation, scoreBreakdown, sections, sources } = visualization;
    const actionStyle = ACTION_STYLES[recommendation.action] || ACTION_STYLES.wait;
    const totalDataPoints = sources.reduce((sum, s) => sum + (s.dataPoints || 0), 0);
    const displayTitle = title || `${symbol} Analysis`;

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={
                <div className="flex items-center gap-2.5">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <span>{displayTitle}</span>
                </div>
            }
            width="full"
        >
            <div className="space-y-6">
                {/* Recommendation Banner */}
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                                <span className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wider border ${actionStyle.bg} ${actionStyle.border} ${actionStyle.text}`}>
                                    {actionStyle.label}
                                </span>
                                <span className="text-[13px] text-slate-400">
                                    {Math.round(recommendation.confidence * 100)}% Confidence
                                </span>
                            </div>
                            {recommendation.reasoning && (
                                <p className="text-[13px] text-slate-300 leading-relaxed">{recommendation.reasoning}</p>
                            )}
                        </div>
                        <ConfidenceRing confidence={recommendation.confidence} size="lg" />
                    </div>
                </div>

                {/* Trade CTA — also available in full report */}
                {(recommendation.action === 'buy' || recommendation.action === 'sell') && onTradeClick && (
                    <button
                        onClick={() => onTradeClick(
                            symbol,
                            recommendation.action,
                            visualization.positionSizing?.suggestedAmount ?? null,
                            visualization.positionSizing?.suggestedQty ?? 1,
                            visualization.positionSizing?.assetType,
                            visualization.positionSizing?.amountType,
                            visualization.positionSizing?.currentPrice
                        )}
                        className={cn(
                            "w-full group flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition-all duration-300",
                            recommendation.action === 'buy'
                                ? "bg-emerald-500/[0.08] border-emerald-500/25 hover:bg-emerald-500/[0.15] hover:border-emerald-500/40 hover:shadow-[0_0_24px_rgba(16,185,129,0.15)]"
                                : "bg-rose-500/[0.08] border-rose-500/25 hover:bg-rose-500/[0.15] hover:border-rose-500/40 hover:shadow-[0_0_24px_rgba(244,63,94,0.15)]"
                        )}
                    >
                        <div className="flex items-center gap-2.5">
                            <div className={cn(
                                "h-8 w-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110",
                                recommendation.action === 'buy' ? "bg-emerald-500/15" : "bg-rose-500/15"
                            )}>
                                {recommendation.action === 'buy'
                                    ? <TrendingUp className="h-4 w-4 text-emerald-400" />
                                    : <TrendingDown className="h-4 w-4 text-rose-400" />
                                }
                            </div>
                            <div className="text-left">
                                <span className={recommendation.action === 'buy' ? "text-emerald-300" : "text-rose-300"}>
                                    {recommendation.action === 'buy' ? 'Buy' : 'Sell'} {symbol}
                                    {visualization.positionSizing?.suggestedAmount != null && (
                                        <span className="text-slate-400 font-medium ml-1.5">
                                            · ~${visualization.positionSizing.suggestedAmount.toLocaleString()}
                                        </span>
                                    )}
                                </span>
                                {visualization.positionSizing?.reasoning && (
                                    <p className="text-[10px] text-slate-500 font-normal mt-0.5">
                                        {visualization.positionSizing.reasoning}
                                    </p>
                                )}
                            </div>
                        </div>
                        <svg className={cn(
                            "h-4 w-4 transition-transform group-hover:translate-x-0.5",
                            recommendation.action === 'buy' ? "text-emerald-400/60" : "text-rose-400/60"
                        )} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                )}

                {/* Score Breakdown */}
                {Object.keys(scoreBreakdown).length > 0 && (
                    <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-4 sm:p-5">
                        <ScoreBreakdownChart scoreBreakdown={scoreBreakdown} />
                    </div>
                )}

                {/* All Sections — Document Style */}
                {sections.map((section, index) => {
                    const accentColor = SECTION_ACCENT_COLORS[index % SECTION_ACCENT_COLORS.length];
                    return (
                        <div key={section.id} className="group">
                            {/* Section Header */}
                            <div
                                className="flex items-center gap-3 mb-3 pl-4 py-1"
                                style={{ borderLeft: `2px solid ${accentColor}` }}
                            >
                                <h3 className="text-[15px] font-semibold text-white">{section.title}</h3>
                                {section.score !== undefined && section.score > 0 && (
                                    <span
                                        className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                                        style={{
                                            backgroundColor: `${accentColor}15`,
                                            color: accentColor,
                                            border: `1px solid ${accentColor}30`,
                                        }}
                                    >
                                        {Math.round(section.score * 100)}%
                                    </span>
                                )}
                            </div>

                            {/* Section Content */}
                            <div className="chat-prose max-w-none text-[13px] text-slate-300 leading-relaxed pl-4">
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                    {section.content}
                                </ReactMarkdown>
                            </div>

                            {/* Section Signals */}
                            {section.signals && section.signals.length > 0 && (
                                <div className="mt-3 pl-4 flex flex-wrap gap-1.5">
                                    {section.signals.map((signal, i) => (
                                        <span
                                            key={i}
                                            className="px-2 py-0.5 rounded-md text-[10px] text-slate-500 bg-white/[0.03] border border-white/[0.06]"
                                        >
                                            {signal}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Section Sources */}
                            {section.sources && section.sources.length > 0 && (
                                <div className="mt-3 pl-4 flex flex-wrap gap-1.5">
                                    {section.sources.map((src, i) => (
                                        <a
                                            key={i}
                                            href={src.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] text-slate-500 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.07] hover:text-slate-300 transition-colors"
                                        >
                                            <ExternalLink className="h-2.5 w-2.5" />
                                            {src.title.length > 50 ? src.title.slice(0, 50) + "..." : src.title}
                                        </a>
                                    ))}
                                </div>
                            )}

                            {/* Divider between sections */}
                            {index < sections.length - 1 && (
                                <div className="border-t border-white/[0.04] mt-5" />
                            )}
                        </div>
                    );
                })}

                {/* Full Sources Breakdown */}
                {sources.length > 0 && (
                    <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-4 sm:p-5">
                        <h4 className="text-[10px] uppercase tracking-widest text-slate-500/80 font-semibold mb-4">
                            Data Sources · {totalDataPoints} data points
                        </h4>
                        <div className="space-y-3">
                            {sources.map((source, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <span className={`h-2 w-2 rounded-full shrink-0 mt-1 ${source.type === "web" ? "bg-cyan-500/60" : "bg-emerald-500/60"
                                        }`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[12px] text-slate-300 font-medium">{source.name}</span>
                                            {source.dataPoints !== undefined && (
                                                <span className="text-[10px] text-slate-600">
                                                    {source.dataPoints} data points
                                                </span>
                                            )}
                                        </div>
                                        {source.queries && source.queries.length > 0 && (
                                            <div className="mt-1 space-y-0.5">
                                                {source.queries.map((query, qi) => (
                                                    <p key={qi} className="text-[11px] text-slate-500/70 italic">
                                                        "{query}"
                                                    </p>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}

/* ─── Compact Card (inline in chat) ─────────────────────────────────── */

export function DeepAnalysisReport({ visualization, onTradeClick }: DeepAnalysisReportProps) {
    const { symbol, title, recommendation, scoreBreakdown, sections, sources } = visualization;
    const [activeTab, setActiveTab] = useState(sections[0]?.id || "");
    const [showFullReport, setShowFullReport] = useState(false);
    const actionStyle = ACTION_STYLES[recommendation.action] || ACTION_STYLES.wait;
    const displayTitle = title || `${symbol} Analysis`;

    const activeSection = sections.find((s) => s.id === activeTab);

    return (
        <>
            <GlassCard className="p-4 sm:p-6 w-full max-w-2xl border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
                {/* Header: Title + Recommendation + Confidence */}
                <div className="flex items-start justify-between gap-4 pb-1">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-lg font-semibold text-white tracking-tight">{displayTitle}</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider border ${actionStyle.bg} ${actionStyle.border} ${actionStyle.text}`}>
                                {actionStyle.label}
                            </span>
                        </div>
                        {recommendation.reasoning && (
                            <p className="text-[12px] text-slate-400/90 leading-relaxed">{recommendation.reasoning}</p>
                        )}
                    </div>
                    <ConfidenceRing confidence={recommendation.confidence} />
                </div>

                {/* Score Breakdown */}
                {Object.keys(scoreBreakdown).length > 0 && (
                    <ScoreBreakdownChart scoreBreakdown={scoreBreakdown} />
                )}

                {/* Trade CTA — only when buy/sell recommendation exists */}
                {(recommendation.action === 'buy' || recommendation.action === 'sell') && onTradeClick && (
                    <div className="pt-4 border-t border-white/[0.04]">
                        <button
                            onClick={() => onTradeClick(
                                symbol,
                                recommendation.action,
                                visualization.positionSizing?.suggestedAmount ?? null,
                                visualization.positionSizing?.suggestedQty ?? 1,
                                visualization.positionSizing?.assetType,
                                visualization.positionSizing?.amountType,
                                visualization.positionSizing?.currentPrice
                            )}
                            className={cn(
                                "w-full group flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition-all duration-300",
                                recommendation.action === 'buy'
                                    ? "bg-emerald-500/[0.08] border-emerald-500/25 hover:bg-emerald-500/[0.15] hover:border-emerald-500/40 hover:shadow-[0_0_24px_rgba(16,185,129,0.15)]"
                                    : "bg-rose-500/[0.08] border-rose-500/25 hover:bg-rose-500/[0.15] hover:border-rose-500/40 hover:shadow-[0_0_24px_rgba(244,63,94,0.15)]"
                            )}
                        >
                            <div className="flex items-center gap-2.5">
                                <div className={cn(
                                    "h-8 w-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110",
                                    recommendation.action === 'buy' ? "bg-emerald-500/15" : "bg-rose-500/15"
                                )}>
                                    {recommendation.action === 'buy'
                                        ? <TrendingUp className="h-4 w-4 text-emerald-400" />
                                        : <TrendingDown className="h-4 w-4 text-rose-400" />
                                    }
                                </div>
                                <div className="text-left">
                                    <span className={recommendation.action === 'buy' ? "text-emerald-300" : "text-rose-300"}>
                                        {recommendation.action === 'buy' ? 'Buy' : 'Sell'} {symbol}
                                        {visualization.positionSizing?.suggestedAmount != null && (
                                            <span className="text-slate-400 font-medium ml-1.5">
                                                · ~${visualization.positionSizing.suggestedAmount.toLocaleString()}
                                            </span>
                                        )}
                                    </span>
                                    {visualization.positionSizing?.reasoning && (
                                        <p className="text-[10px] text-slate-500 font-normal mt-0.5">
                                            {visualization.positionSizing.reasoning}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <svg className={cn(
                                "h-4 w-4 transition-transform group-hover:translate-x-0.5",
                                recommendation.action === 'buy' ? "text-emerald-400/60" : "text-rose-400/60"
                            )} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                )}

                <InlineMarketCharts visualization={visualization} />

                {/* Section Tabs + Content */}
                {sections.length > 0 && (
                    <>
                        <SectionTabs sections={sections} activeTab={activeTab} onTabChange={setActiveTab} />

                        {/* Active Section Content */}
                        {activeSection && (
                            <div className="min-h-[100px] pt-4 animate-in fade-in duration-200">
                                <div className="chat-prose max-w-none text-[13px] text-slate-300 leading-relaxed">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                        {activeSection.content}
                                    </ReactMarkdown>
                                </div>

                                {/* Section-level sources */}
                                {activeSection.sources && activeSection.sources.length > 0 && (
                                    <div className="mt-4 flex flex-wrap gap-1.5">
                                        {activeSection.sources.map((src, i) => (
                                            <a
                                                key={i}
                                                href={src.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] text-slate-500 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.07] hover:text-slate-300 transition-colors"
                                            >
                                                <ExternalLink className="h-2.5 w-2.5" />
                                                {src.title.length > 40 ? src.title.slice(0, 40) + "..." : src.title}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* Sources Footer */}
                {sources.length > 0 && <SourcesFooter sources={sources} />}

                {/* View Full Report Button */}
                {sections.length > 0 && (
                    <button
                        onClick={() => setShowFullReport(true)}
                        className="w-full mt-3 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] backdrop-blur-sm text-[11px] text-slate-400 hover:text-slate-200 flex items-center justify-center gap-2 transition-all duration-200"
                    >
                        <FileText className="h-3.5 w-3.5" />
                        View Full Report
                    </button>
                )}
            </GlassCard>

            {/* Full Report Modal */}
            {showFullReport && (
                <DeepAnalysisModal
                    visualization={visualization}
                    onClose={() => setShowFullReport(false)}
                    onTradeClick={onTradeClick}
                />
            )}
        </>
    );
}
