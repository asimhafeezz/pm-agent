import * as React from "react";
import { cn } from "@/lib/utils";

export interface GlassInputProps
    extends React.InputHTMLAttributes<HTMLInputElement> { }

const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(
                    "flex w-full bg-[#1a1a1d] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[13px] text-white/90 placeholder:text-slate-500",
                    "focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/15 focus:bg-[#1f1f23]",
                    "transition-all duration-200 hover:border-white/12",
                    "file:border-0 file:bg-transparent file:text-sm file:font-medium",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                ref={ref}
                {...props}
            />
        );
    }
);
GlassInput.displayName = "GlassInput";

export { GlassInput };
