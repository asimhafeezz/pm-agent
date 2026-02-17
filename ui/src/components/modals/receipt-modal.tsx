import { createPortal } from "react-dom";
import { useEffect, useMemo } from "react";
import { CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: {
        type: "buy" | "sell" | "deposit" | "withdraw";
        amount: number;
        symbol?: string;
        price?: number;
        timestamp?: Date;
    } | null;
}

export function ReceiptModal({ isOpen, onClose, data }: ReceiptModalProps) {
    useEffect(() => {
        if (!isOpen) return;
        const onEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onEsc);
        return () => window.removeEventListener("keydown", onEsc);
    }, [isOpen, onClose]);

    const details = useMemo(() => {
        if (!data) return null;
        const stamp = data.timestamp ?? new Date();
        const timeLabel = `${stamp.toLocaleDateString()} • ${stamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
        const successTone = data.type === "buy" || data.type === "deposit";
        const titleMap = {
            buy: "Buy Order Completed",
            sell: "Sell Order Completed",
            deposit: "Deposit Completed",
            withdraw: "Withdrawal Completed",
        } as const;

        if (data.type === "buy" || data.type === "sell") {
            return {
                successTone,
                title: titleMap[data.type],
                timeLabel,
                rows: [
                    { label: "Symbol", value: data.symbol || "-" },
                    { label: "Value", value: `$${data.amount.toFixed(2)}` },
                    ...(data.price ? [{ label: "Price", value: `$${data.price.toFixed(2)}` }] : []),
                ],
            };
        }

        return {
            successTone,
            title: titleMap[data.type],
            timeLabel,
            rows: [
                { label: "Amount", value: `$${data.amount.toFixed(2)}` },
                { label: "Direction", value: data.type === "deposit" ? "Bank -> Vault" : "Vault -> Bank" },
            ],
        };
    }, [data]);

    if (!isOpen || !details) return null;

    return createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0e1016]/95 p-5 shadow-2xl animate-in zoom-in-95 fade-in duration-200">
                <button
                    onClick={onClose}
                    className="absolute right-3 top-3 h-7 w-7 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
                >
                    <X className="h-4 w-4" />
                </button>

                <div className="flex flex-col items-center text-center">
                    <div
                        className={cn(
                            "relative h-14 w-14 rounded-full flex items-center justify-center shadow-lg",
                            details.successTone ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                        )}
                    >
                        <CheckCircle2 className="h-8 w-8 animate-in zoom-in duration-300" />
                        <span
                            className={cn(
                                "absolute inset-0 rounded-full animate-ping opacity-40",
                                details.successTone ? "bg-emerald-400/50" : "bg-rose-400/50"
                            )}
                        />
                    </div>
                    <h3 className="mt-3 text-base font-bold text-white">{details.title}</h3>
                    <p className="mt-1 text-[11px] text-slate-400">{details.timeLabel}</p>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2.5">
                    {details.rows.map((row) => (
                        <div key={row.label} className="flex items-center justify-between gap-4">
                            <span className="text-[11px] text-slate-400">{row.label}</span>
                            <span className="text-[11px] font-semibold text-white text-right">{row.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
}
