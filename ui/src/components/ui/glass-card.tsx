import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    gradient?: boolean;
}

export function GlassCard({
    className,
    children,
    gradient = false,
    ...props
}: GlassCardProps) {
    return (
        <div
            className={cn(
                "relative rounded-xl border border-white/5 bg-[#18181b]/60 backdrop-blur-xl shadow-xl",
                gradient && "bg-gradient-to-br from-[#27272a]/80 to-[#18181b]/60",
                className
            )}
            {...props}
        >
            {/* Glossy Reflection Effect */}
            <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-white/10 to-transparent opacity-50" />

            {/* Content */}
            <div className="relative z-10 h-full">
                {children}
            </div>
        </div>
    );
}
