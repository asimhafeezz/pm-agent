import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface GlassDatePickerProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    min?: string;
    max?: string;
}

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function GlassDatePicker({
    value,
    onChange,
    placeholder = "Select date",
    className,
    disabled,
    min,
    max,
}: GlassDatePickerProps) {

    // ... existing code ...

    // Check if a date is before min date
    const isBeforeMin = (day: number) => {
        if (!min) return false;
        const date = new Date(viewYear, viewMonth, day);
        const minDate = new Date(min);
        // Compare timestamps to avoid time issues, set minDate to start of day
        return date.setHours(0, 0, 0, 0) < minDate.setHours(0, 0, 0, 0);
    };

    // Check if a date is after max date
    const isAfterMax = (day: number) => {
        if (!max) return false;
        const date = new Date(viewYear, viewMonth, day);
        const maxDate = new Date(max);
        // Compare timestamps, set maxDate to start of day
        return date.setHours(0, 0, 0, 0) > maxDate.setHours(0, 0, 0, 0);
    };

    // ... existing code ...


    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Parse the value to get the displayed date
    const parsedDate = value ? new Date(value) : null;
    const [viewMonth, setViewMonth] = useState(parsedDate?.getMonth() ?? new Date().getMonth());
    const [viewYear, setViewYear] = useState(parsedDate?.getFullYear() ?? new Date().getFullYear());

    // Update view when value changes
    useEffect(() => {
        if (parsedDate) {
            setViewMonth(parsedDate.getMonth());
            setViewYear(parsedDate.getFullYear());
        }
    }, [value]);

    // Close on outside click
    useEffect(() => {
        const handleClick = (event: MouseEvent) => {
            const path = event.composedPath?.() ?? [];
            const inside = path.some((node) => {
                if (node instanceof HTMLElement) {
                    return node === wrapperRef.current || node.dataset?.datepickerPortal === "true";
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
            const calendarHeight = 320;
            const shouldOpenUpward = spaceBelow < calendarHeight;

            setPosition({
                top: shouldOpenUpward ? rect.top - calendarHeight - 8 : rect.bottom + 8,
                left: rect.left,
                width: Math.max(rect.width, 280),
            });
        }
        setOpen((prev) => !prev);
    };

    // Get days in month
    const getDaysInMonth = (month: number, year: number) => {
        return new Date(year, month + 1, 0).getDate();
    };

    // Get first day of month (0 = Sunday)
    const getFirstDayOfMonth = (month: number, year: number) => {
        return new Date(year, month, 1).getDay();
    };

    const handlePrevMonth = () => {
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear(viewYear - 1);
        } else {
            setViewMonth(viewMonth - 1);
        }
    };

    const handleNextMonth = () => {
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear(viewYear + 1);
        } else {
            setViewMonth(viewMonth + 1);
        }
    };

    const handleSelectDate = (day: number) => {
        const date = new Date(viewYear, viewMonth, day);
        const formatted = date.toISOString().split("T")[0];
        onChange(formatted);
        setOpen(false);
    };

    const handleToday = () => {
        const today = new Date();
        setViewMonth(today.getMonth());
        setViewYear(today.getFullYear());
        const formatted = today.toISOString().split("T")[0];
        onChange(formatted);
        setOpen(false);
    };

    const handleClear = () => {
        onChange("");
        setOpen(false);
    };

    // Format display value
    const displayValue = parsedDate
        ? parsedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : null;

    // Build calendar grid
    const daysInMonth = getDaysInMonth(viewMonth, viewYear);
    const firstDay = getFirstDayOfMonth(viewMonth, viewYear);
    const days: (number | null)[] = [];

    // Add empty cells for days before the first day
    for (let i = 0; i < firstDay; i++) {
        days.push(null);
    }

    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
    }

    // Check if a date is before min date


    // Check if a date is selected
    const isSelected = (day: number) => {
        if (!parsedDate) return false;
        return (
            parsedDate.getDate() === day &&
            parsedDate.getMonth() === viewMonth &&
            parsedDate.getFullYear() === viewYear
        );
    };

    // Check if a date is today
    const isToday = (day: number) => {
        const today = new Date();
        return (
            today.getDate() === day &&
            today.getMonth() === viewMonth &&
            today.getFullYear() === viewYear
        );
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
                    displayValue ? "text-white/90" : "text-slate-500"
                )}
            >
                <span className="truncate">
                    {displayValue || placeholder}
                </span>
                <Calendar className="h-4 w-4 text-slate-400" />
            </button>

            {open && position && createPortal(
                <div
                    data-datepicker-portal="true"
                    className={cn(
                        "fixed z-[9999] rounded-xl border border-white/10 bg-[#18181b]/98",
                        "backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)]",
                        "p-4"
                    )}
                    style={{
                        top: position.top,
                        left: position.left,
                        width: position.width,
                    }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="text-[13px] font-medium text-white">
                            {MONTHS[viewMonth]} {viewYear}
                        </span>
                        <button
                            type="button"
                            onClick={handleNextMonth}
                            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Days header */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {DAYS.map((day) => (
                            <div key={day} className="h-8 flex items-center justify-center text-[11px] font-medium text-slate-500">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {days.map((day, index) => (
                            <div key={index} className="h-8">
                                {day !== null && (
                                    <button
                                        type="button"
                                        disabled={isBeforeMin(day) || isAfterMax(day)}
                                        onClick={() => handleSelectDate(day)}
                                        className={cn(
                                            "h-8 w-full rounded-lg text-[12px] font-medium transition-all",
                                            isSelected(day)
                                                ? "bg-white text-black"
                                                : isToday(day)
                                                    ? "bg-white/10 text-white ring-1 ring-white/20"
                                                    : "text-slate-300 hover:bg-white/10 hover:text-white",
                                            (isBeforeMin(day) || isAfterMax(day)) && "opacity-30 cursor-not-allowed hover:bg-transparent"
                                        )}
                                    >
                                        {day}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-[12px] font-medium text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                        >
                            Clear
                        </button>
                        <button
                            type="button"
                            onClick={handleToday}
                            className="text-[12px] font-medium text-white bg-white/10 hover:bg-white/15 transition-colors px-3 py-1.5 rounded-lg"
                        >
                            Today
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
