import type { ReactNode } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import { Settings2 } from "lucide-react";

export type IntegrationStatus = "connected" | "disconnected" | "loading";

export interface IntegrationCardProps {
    title: string;
    description: string;
    icon: ReactNode;
    status: IntegrationStatus;
    connectedAs?: string;
    onToggle: () => void;
    onConfigure?: () => void;
    isLoading?: boolean;
    className?: string;
    disabled?: boolean;
}

export function IntegrationCard({
    title,
    description,
    icon,
    status,
    connectedAs,
    onToggle,
    onConfigure,
    isLoading,
    className,
    disabled,
}: IntegrationCardProps) {
    const isConnected = status === "connected";

    return (
        <GlassCard className={cn("relative overflow-hidden transition-all duration-300 hover:border-white/10 group", className)}>
            <div className="p-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div className={cn(
                        "h-12 w-12 rounded-2xl border flex items-center justify-center text-xl shadow-inner transition-colors duration-300",
                        isConnected
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-white/[0.03] border-white/10 text-slate-400"
                    )}>
                        {icon}
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-white leading-tight">{title}</h3>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-[200px]">{description}</p>

                        {isConnected && connectedAs && (
                            <div className="flex items-center gap-1.5 mt-2.5 text-[11px] font-medium text-emerald-400/90">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                {connectedAs}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col items-end gap-3">
                    {/* Toggle Button */}
                    <button
                        onClick={onToggle}
                        disabled={disabled || isLoading}
                        className={cn(
                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-2 focus:ring-offset-[#09090b]",
                            isConnected ? "bg-emerald-500" : "bg-slate-700/50 hover:bg-slate-700",
                            (disabled || isLoading) && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <span
                            className={cn(
                                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out shadow-sm",
                                isConnected ? "translate-x-6" : "translate-x-1"
                            )}
                        />
                    </button>

                    {/* Settings/Configure Button - Only show if connected */}
                    {isConnected && onConfigure && (
                        <button
                            onClick={onConfigure}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
                            title="Configure settings"
                        >
                            <Settings2 className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>
        </GlassCard>
    );
}

export function IntegrationCardWaitlist({
    title,
    description,
    icon,
}: {
    title: string;
    description: string;
    icon: ReactNode;
}) {
    return (
        <GlassCard className="flex flex-col h-full bg-[#18181b]/20 border-white/[0.02] hover:border-white/[0.05] transition-colors group opacity-60 hover:opacity-100">
            <div className="p-5 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center text-slate-500 font-bold text-sm grayscale group-hover:grayscale-0 transition-all">
                    {icon}
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-slate-300">{title}</h3>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-white/5 bg-white/[0.02] text-slate-500 text-center">Soon</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{description}</p>
                </div>
            </div>
        </GlassCard>
    )
}
