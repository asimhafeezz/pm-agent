import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, X, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
    value: string;
    label: string;
    subLabel?: string;
}

interface GlassComboboxProps {
    value: string;
    onChange: (value: string) => void;
    onSearch?: (query: string) => Promise<Option[]>;
    placeholder?: string;
    className?: string;
    defaultOptions?: Option[];
    loading?: boolean;
    disabled?: boolean;
}

export function GlassCombobox({
    value,
    onChange,
    onSearch,
    placeholder = "Select...",
    className,
    defaultOptions = [],
    loading: externalLoading = false,
    disabled = false,
}: GlassComboboxProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [options, setOptions] = useState<Option[]>(defaultOptions);
    const [loading, setLoading] = useState(false);
    const [selectedOption, setSelectedOption] = useState<Option | null>(
        defaultOptions.find((opt) => opt.value === value) || null
    );
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync internal state with props
    useEffect(() => {
        if (value && !selectedOption && defaultOptions.length > 0) {
            setSelectedOption(defaultOptions.find(opt => opt.value === value) || null);
        }
    }, [value, defaultOptions, selectedOption]);


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const timer = setTimeout(async () => {
            if (onSearch) {
                setLoading(true);
                try {
                    const results = await onSearch(query);
                    setOptions(results);
                } catch (error) {
                    console.error("Search failed", error);
                    setOptions([]);
                } finally {
                    setLoading(false);
                }
            } else {
                setOptions(
                    defaultOptions.filter((opt) =>
                        opt.label.toLowerCase().includes(query.toLowerCase()) ||
                        opt.value.toLowerCase().includes(query.toLowerCase())
                    )
                );
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query, isOpen, onSearch]);

    const handleSelect = (option: Option) => {
        onChange(option.value);
        setSelectedOption(option);
        setIsOpen(false);
        setQuery("");
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange("");
        setSelectedOption(null);
        setQuery("");
    };

    return (
        <div className={cn("relative", className)} ref={wrapperRef}>
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={cn(
                    "w-full bg-[#1a1a1d] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white/90 cursor-pointer flex items-center justify-between transition-all duration-200 hover:border-white/12",
                    isOpen && "border-white/20 bg-[#1f1f23] ring-1 ring-white/20",
                    disabled && "opacity-50 cursor-not-allowed"
                )}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    {selectedOption ? (
                        <span className="truncate">{selectedOption.label}</span>
                    ) : value ? (
                        <span className="truncate text-white">{value}</span>
                    ) : (
                        <span className="text-slate-500 truncate">{placeholder}</span>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    {selectedOption && !disabled && (
                        <div
                            onClick={handleClear}
                            className="p-0.5 rounded-full hover:bg-white/10 transition-colors mr-1"
                        >
                            <X className="h-3 w-3 text-slate-400" />
                        </div>
                    )}
                    <ChevronDown
                        className={cn(
                            "h-3.5 w-3.5 text-slate-500 transition-transform duration-200",
                            isOpen && "transform rotate-180"
                        )}
                    />
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-[#1a1a1d] border border-white/[0.08] rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-2 border-b border-white/[0.06]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500" />
                            <input
                                ref={inputRef}
                                autoFocus
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search..."
                                className="w-full bg-white/[0.04] border-none rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:ring-0"
                            />
                        </div>
                    </div>

                    <div className="max-h-[200px] overflow-y-auto p-1 custom-scrollbar">
                        {loading || externalLoading ? (
                            <div className="py-6 text-center flex flex-col items-center justify-center gap-2 text-slate-500">
                                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                                <span className="text-[10px]">Searching...</span>
                            </div>
                        ) : options.length === 0 ? (
                            <div className="py-6 text-center text-slate-500 text-xs">
                                {query ? "No results found" : "Type to search..."}
                            </div>
                        ) : (
                            options.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => handleSelect(option)}
                                    className={cn(
                                        "w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between group",
                                        option.value === value
                                            ? "bg-indigo-500/10 text-indigo-400"
                                            : "text-slate-300 hover:bg-white/[0.04] hover:text-white"
                                    )}
                                >
                                    <div>
                                        <div className="font-medium">{option.label}</div>
                                        {option.subLabel && (
                                            <div className="text-[10px] text-slate-500 group-hover:text-slate-400">
                                                {option.subLabel}
                                            </div>
                                        )}
                                    </div>
                                    {option.value === value && (
                                        <Check className="h-3 w-3 text-indigo-400" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
