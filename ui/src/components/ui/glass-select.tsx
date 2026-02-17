import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = {
    value: string;
    label: string;
};

interface GlassSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export function GlassSelect({
    value,
    onChange,
    options,
    placeholder = "Select",
    className,
    disabled,
}: GlassSelectProps) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const selectedLabel = useMemo(() => {
        return options.find((opt) => opt.value === value)?.label ?? "";
    }, [options, value]);

    useEffect(() => {
        const handleClick = (event: MouseEvent) => {
            const path = event.composedPath?.() ?? [];
            const inside = path.some((node) => {
                if (node instanceof HTMLElement) {
                    return node === wrapperRef.current || node.dataset?.selectPortal === "true";
                }
                return false;
            });
            if (!inside) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const handleToggle = () => {
        if (!open && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const dropdownHeight = Math.min(options.length * 32 + 16, 256);
            const shouldOpenUpward = spaceBelow < dropdownHeight;

            setPosition({
                top: shouldOpenUpward ? rect.top - dropdownHeight - 8 : rect.bottom + 8,
                left: rect.left,
                width: rect.width,
            });
        }
        setOpen((prev) => !prev);
    };

    return (
        <div ref={wrapperRef} className={cn("relative", className)}>
            <button
                ref={buttonRef}
                type="button"
                disabled={disabled}
                onClick={handleToggle}
                className={cn(
                    "w-full bg-[#1a1a1d] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-left text-[13px]",
                    "focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/15 focus:bg-[#1f1f23]",
                    "transition-all duration-200 hover:border-white/12",
                    "flex items-center justify-between gap-2",
                    disabled && "opacity-60 cursor-not-allowed",
                    selectedLabel ? "text-white/90" : "text-slate-500"
                )}
            >
                <span className="truncate">
                    {selectedLabel || placeholder}
                </span>
                <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform shrink-0", open && "rotate-180")} />
            </button>

            {open && position && createPortal(
                <div
                    data-select-portal="true"
                    className={cn(
                        "fixed z-[9999] rounded-xl border border-white/10 bg-[#18181b]/98",
                        "backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)]",
                        "max-h-64 overflow-y-auto py-1"
                    )}
                    style={{
                        top: position.top,
                        left: position.left,
                        width: position.width,
                    }}
                >
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                onChange(option.value);
                                setOpen(false);
                            }}
                            className={cn(
                                "w-full px-3.5 py-2 text-left text-[13px]",
                                "hover:bg-white/10 transition-colors",
                                value === option.value
                                    ? "text-white bg-white/10 font-medium"
                                    : "text-slate-400 hover:text-white"
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
}
