import { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { GlassCard } from "@/components/ui/glass-card";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, CartesianGrid, Legend } from "recharts";
import { TrendingUp, TrendingDown, BarChart2 } from "lucide-react";
import { DeepAnalysisReport, type DeepAnalysisVisualization as DeepAnalysisVizType } from "@/components/chat/deep-analysis-report";

export interface ChartDataPoint {
    datetime?: string;
    date?: string;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    volume?: number;
}

export interface PriceChartVisualization {
    type: "price_chart";
    symbol: string;
    data: ChartDataPoint[];
    interval?: string;
    currentPrice?: number;
    change?: number;
    percentChange?: number;
}

export interface ComparisonChartVisualization {
    type: "comparison_chart";
    symbols: string[];
    data: Array<{ date: string;[key: string]: number | string }>;
    title?: string;
    winner?: {
        symbol: string;
        value?: number;
        source?: "score_confidence" | "price_return" | string;
    };
}

export interface PortfolioBreakdownVisualization {
    type: "portfolio_breakdown";
    data: Array<{ name: string; value: number; percentage: number; color: string }>;
    totalValue: number;
    currency: string;
}

export interface RevenueChartDataPoint {
    date: string;
    revenue: number;
    fiscalPeriod?: string;
}

export interface RevenueChartVisualization {
    type: "revenue_chart";
    symbol: string;
    period?: "annual" | "quarter" | string;
    currency?: string;
    data: RevenueChartDataPoint[];
    asOf?: string;
}

export interface AssetSnapshotVisualization {
    type: "asset_snapshot";
    symbol: string;
    priceChart?: PriceChartVisualization;
    revenueChart?: RevenueChartVisualization;
}

export interface NewsCardsVisualization {
    type: "news_cards";
    data: Array<{
        title: string;
        source: string;
        url?: string;
        sentiment?: "positive" | "negative" | "neutral";
        date?: string;
    }>;
}

export type { DeepAnalysisVizType as DeepAnalysisVisualization };

export type Visualization =
    | PriceChartVisualization
    | ComparisonChartVisualization
    | PortfolioBreakdownVisualization
    | RevenueChartVisualization
    | AssetSnapshotVisualization
    | NewsCardsVisualization
    | DeepAnalysisVizType;

interface ChatVisualizationProps {
    visualization: Visualization;
    decision?: { action: string; confidence: number } | null;
    onTradeFromChart?: (symbol: string, side: string) => void;
    onTradeFromAnalysis?: (
        symbol: string,
        side: string,
        suggestedAmount: number | null,
        suggestedQty: number,
        assetType?: string,
        amountType?: 'usd' | 'shares',
        currentPrice?: number | null
    ) => void;
}

// Color palette for charts
const CHART_COLORS = {
    primary: "#10b981", // emerald
    secondary: "#6366f1", // indigo
    tertiary: "#f59e0b", // amber
    negative: "#ef4444", // red
    lines: ["#10b981", "#6366f1", "#f59e0b", "#06b6d4", "#ec4899"],
};

// import { CandleStickChart } from "@/components/widgets/candlestick-chart";

function StockPriceChart({ visualization, decision, onTradeFromChart }: {
    visualization: PriceChartVisualization;
    decision?: { action: string; confidence: number } | null;
    onTradeFromChart?: (symbol: string, side: string) => void;
}) {
    const { symbol, currentPrice, change, percentChange } = visualization;
    const isPositive = (change || 0) >= 0;
    const showTradeButton = decision && ['buy', 'sell'].includes(decision.action);

    // Map data to match CandleStickChart expectations if needed
    // The backend now provides 'time', 'open', 'high', 'low', 'close'
    // We just need to ensure the types match perfectly.


    return (
        <GlassCard className="p-0 w-full max-w-2xl border-white/5 bg-white/[0.02] overflow-hidden">
            <div className="flex justify-between items-start p-5 pb-2">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-medium text-slate-400">{symbol}</span>
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${isPositive
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            }`}>
                            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {percentChange !== undefined ? `${Math.abs(percentChange).toFixed(2)}%` : ""}
                        </div>
                    </div>

                    <div className="flex items-baseline gap-2">
                        {currentPrice ? (
                            <h3 className="text-3xl font-bold text-white tracking-tight">
                                ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </h3>
                        ) : (
                            <h3 className="text-3xl font-bold text-slate-500 tracking-tight">---</h3>
                        )}
                        {change !== undefined && (
                            <span className={`text-sm font-medium ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                                {isPositive ? "+" : ""}{change.toFixed(2)}
                            </span>
                        )}
                        <span className="text-xs text-slate-500 ml-1">Today</span>
                    </div>
                </div>
            </div>

            {/* Chart Area */}
            <div className="w-full h-[300px] mt-2 flex items-center justify-center relative">
                <div className="text-slate-500 text-sm flex flex-col items-center gap-2">
                    <BarChart2 className="h-8 w-8 opacity-20" />
                    <span>Chart data unavailable (Component Removed)</span>
                </div>
            </div>

            {/* Trade Logic */}
            {showTradeButton && (
                <div className="p-4 pt-2 border-t border-white/5">
                    <button
                        onClick={() => onTradeFromChart?.(symbol, decision!.action)}
                        className={`w-full py-3 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg ${decision!.action === 'buy'
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
                            : 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
                            }`}
                    >
                        {decision!.action === 'buy' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        {decision!.action === 'buy' ? 'Buy' : 'Sell'} {symbol}
                    </button>
                </div>
            )}
        </GlassCard>
    );
}

function ComparisonChart({ visualization }: { visualization: ComparisonChartVisualization }) {
    const { symbols, data, title, winner } = visualization;

    return (
        <GlassCard className="p-4 w-full max-w-2xl">
            <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-slate-400" />
                    <h3 className="text-sm font-semibold text-white">{title || "Comparison"}</h3>
                </div>
                {winner?.symbol && (
                    <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Winner</p>
                        <p className="text-xs font-semibold text-emerald-400">
                            {winner.symbol}
                            {typeof winner.value === "number" && (
                                <span className="text-slate-400 font-medium ml-1">
                                    {winner.source === "score_confidence"
                                        ? `${Math.round(winner.value * 100)} pts`
                                        : `${winner.value >= 0 ? "+" : ""}${winner.value.toFixed(2)}%`}
                                </span>
                            )}
                        </p>
                    </div>
                )}
            </div>

            <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis
                            dataKey="date"
                            stroke="#64748b"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#64748b"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "#020617",
                                borderColor: "#1e293b",
                                borderRadius: "8px",
                            }}
                        />
                        <Legend />
                        {symbols.map((symbol, index) => (
                            <Line
                                key={symbol}
                                type="monotone"
                                dataKey={symbol}
                                stroke={CHART_COLORS.lines[index % CHART_COLORS.lines.length]}
                                strokeWidth={2}
                                dot={false}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </GlassCard>
    );
}

function PortfolioBreakdown({ visualization }: { visualization: PortfolioBreakdownVisualization }) {
    const { data, totalValue, currency } = visualization;

    return (
        <GlassCard className="p-4 w-full max-w-2xl">
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-semibold text-white">Portfolio Breakdown</h3>
                <p className="text-sm font-mono text-slate-400">
                    {currency} {totalValue.toLocaleString()}
                </p>
            </div>

            <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                        <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} width={80} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "#020617",
                                borderColor: "#1e293b",
                                borderRadius: "8px",
                            }}
                            formatter={(value, _name, props: any) => [
                                `${currency} ${Number(value).toLocaleString()} (${props.payload.percentage.toFixed(1)}%)`,
                                "Value",
                            ]}
                        />
                        <Bar dataKey="value" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </GlassCard>
    );
}

function formatRevenueValue(value: number) {
    if (Math.abs(value) >= 1_000_000_000_000) {
        return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
    }
    if (Math.abs(value) >= 1_000_000_000) {
        return `$${(value / 1_000_000_000).toFixed(2)}B`;
    }
    if (Math.abs(value) >= 1_000_000) {
        return `$${(value / 1_000_000).toFixed(2)}M`;
    }
    return `$${value.toLocaleString()}`;
}

function RevenueChart({ visualization }: { visualization: RevenueChartVisualization }) {
    const { symbol, data, period } = visualization;
    if (!Array.isArray(data) || data.length === 0) return null;

    const chartData = data.map((point) => ({
        date: point.date,
        label: new Date(point.date).toLocaleDateString("en-US", { year: "numeric", month: "short" }),
        revenue: Number(point.revenue || 0),
    }));

    const latest = chartData[chartData.length - 1];
    const first = chartData[0];
    const growth = first?.revenue ? ((latest.revenue - first.revenue) / Math.abs(first.revenue)) * 100 : undefined;

    return (
        <GlassCard className="p-4 w-full max-w-2xl border-white/5 bg-white/[0.02]">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm font-semibold text-white">{symbol} Revenue</h3>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">{period || "annual"}</p>
                </div>
                <div className="text-right">
                    <p className="text-sm font-semibold text-white">{formatRevenueValue(latest.revenue)}</p>
                    {growth !== undefined && (
                        <p className={`text-xs ${growth >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {growth >= 0 ? "+" : ""}{growth.toFixed(1)}%
                        </p>
                    )}
                </div>
            </div>

            <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis hide />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "#020617",
                                borderColor: "#1e293b",
                                borderRadius: "8px",
                            }}
                            formatter={(value: number | string | undefined) => [formatRevenueValue(Number(value || 0)), "Revenue"]}
                            labelFormatter={(label) => String(label)}
                        />
                        <Bar dataKey="revenue" fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </GlassCard>
    );
}

function AssetSnapshot({ visualization, decision, onTradeFromChart }: {
    visualization: AssetSnapshotVisualization;
    decision?: { action: string; confidence: number } | null;
    onTradeFromChart?: (symbol: string, side: string) => void;
}) {
    const { priceChart, revenueChart } = visualization;
    return (
        <div className="space-y-3 w-full">
            {priceChart && <StockPriceChart visualization={priceChart} decision={decision} onTradeFromChart={onTradeFromChart} />}
            {revenueChart && <RevenueChart visualization={revenueChart} />}
        </div>
    );
}

function formatNewsDate(raw?: string): string {
    if (!raw) return "";
    try {
        const date = new Date(raw);
        if (isNaN(date.getTime())) return raw;
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
        return raw;
    }
}

function NewsSourcesModal({ data, onClose }: { data: NewsCardsVisualization["data"]; onClose: () => void }) {
    const getSentimentColor = (sentiment?: string) => {
        switch (sentiment) {
            case "positive": return "text-emerald-400";
            case "negative": return "text-rose-400";
            default: return "text-slate-500";
        }
    };

    const getSentimentLabel = (sentiment?: string) => {
        switch (sentiment) {
            case "positive": return "Bullish";
            case "negative": return "Bearish";
            default: return null;
        }
    };

    // Close on Escape
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
    }, [onClose]);

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [handleKeyDown]);

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-lg max-h-[80vh] rounded-2xl border border-white/[0.1] bg-[#0f1117] shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/[0.08]">
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                    <span className="text-sm font-semibold text-white">Sources</span>
                    <span className="text-xs text-slate-500 ml-1">{data.length} article{data.length !== 1 ? "s" : ""}</span>
                    <button
                        onClick={onClose}
                        className="ml-auto h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Scrollable list */}
                <div className="overflow-y-auto max-h-[calc(80vh-60px)] divide-y divide-white/[0.05]">
                    {data.slice(0, 8).map((item, index) => {
                        const Wrapper = item.url ? "a" : "div";
                        const linkProps = item.url ? { href: item.url, target: "_blank" as const, rel: "noopener noreferrer" } : {};
                        const sentimentLabel = getSentimentLabel(item.sentiment);

                        return (
                            <Wrapper
                                key={index}
                                {...linkProps}
                                className={`group flex items-start gap-4 px-5 py-4 transition-colors duration-150 ${item.url ? "cursor-pointer hover:bg-white/[0.04]" : ""}`}
                            >
                                {/* Number */}
                                <span className="text-xs font-semibold text-slate-600 mt-0.5 w-4 shrink-0 text-right">
                                    {index + 1}
                                </span>

                                <div className="flex-1 min-w-0">
                                    <h4 className="text-[13px] font-medium text-slate-200 leading-snug group-hover:text-white transition-colors">
                                        {item.title}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                                        <span className="font-medium text-slate-400">{item.source}</span>
                                        {item.date && (
                                            <>
                                                <span className="text-slate-700">·</span>
                                                <span className="text-slate-500">{formatNewsDate(item.date)}</span>
                                            </>
                                        )}
                                        {sentimentLabel && (
                                            <>
                                                <span className="text-slate-700">·</span>
                                                <span className={`font-medium ${getSentimentColor(item.sentiment)}`}>{sentimentLabel}</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {item.url && (
                                    <svg className="h-3.5 w-3.5 text-slate-700 group-hover:text-slate-400 transition-colors shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                )}
                            </Wrapper>
                        );
                    })}
                </div>
            </div>
        </div>,
        document.body,
    );
}

function NewsCards({ visualization }: { visualization: NewsCardsVisualization }) {
    const { data } = visualization;
    const [isOpen, setIsOpen] = useState(false);

    // Collect unique source names for the inline pills
    const sources = useMemo(() => {
        const seen = new Set<string>();
        return data
            .map((item) => item.source)
            .filter((s) => {
                if (!s || seen.has(s)) return false;
                seen.add(s);
                return true;
            })
            .slice(0, 4);
    }, [data]);

    return (
        <>
            {/* Inline trigger — compact pill row that sits in the chat flow */}
            <button
                onClick={() => setIsOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/[0.2] transition-all duration-200 cursor-pointer group"
            >
                <svg className="h-3 w-3 text-slate-500 group-hover:text-slate-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
                <span className="text-[10px] font-medium text-slate-400 group-hover:text-slate-200 transition-colors">
                    {sources.join(", ")}
                    {data.length > sources.length ? ` +${data.length - sources.length}` : ""}
                </span>
                <span className="text-[9px] text-slate-600 border-l border-white/[0.08] pl-2 ml-0.5">
                    {data.length} source{data.length !== 1 ? "s" : ""}
                </span>
            </button>

            {/* Modal popup */}
            {isOpen && <NewsSourcesModal data={data} onClose={() => setIsOpen(false)} />}
        </>
    );
}

export function ChatVisualization({ visualization, decision, onTradeFromChart, onTradeFromAnalysis }: ChatVisualizationProps) {
    switch (visualization.type) {
        case "price_chart":
            return <StockPriceChart visualization={visualization} decision={decision} onTradeFromChart={onTradeFromChart} />;
        case "comparison_chart":
            return <ComparisonChart visualization={visualization} />;
        case "portfolio_breakdown":
            return <PortfolioBreakdown visualization={visualization} />;
        case "revenue_chart":
            return <RevenueChart visualization={visualization} />;
        case "asset_snapshot":
            return <AssetSnapshot visualization={visualization} decision={decision} onTradeFromChart={onTradeFromChart} />;
        case "news_cards":
            return <NewsCards visualization={visualization} />;
        case "deep_analysis":
            return <DeepAnalysisReport visualization={visualization} onTradeClick={onTradeFromAnalysis} />;
        default:
            return null;
    }
}
