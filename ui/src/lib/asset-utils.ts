
export const getAssetColor = (type: string): string => {
    const typeUpper = type.toUpperCase();
    if (typeUpper === "STOCK" || typeUpper === "STOCKS") return "#3b82f6"; // blue-500
    if (typeUpper === "ETF") return "#a855f7"; // purple-500
    if (typeUpper === "CRYPTO" || typeUpper === "CRYPTOCURRENCY") return "#f97316"; // orange-500
    if (typeUpper === "BOND" || typeUpper === "BONDS") return "#10b981"; // emerald-500
    if (typeUpper === "REIT") return "#ec4899"; // pink-500
    if (typeUpper === "MUTUAL FUND") return "#06b6d4"; // cyan-500
    if (typeUpper === "OPTIONS") return "#eab308"; // yellow-500
    return "#64748b"; // slate-500
};

export const getAssetColorClass = (type: string) => {
    const typeUpper = type.toUpperCase();
    if (typeUpper === "STOCK" || typeUpper === "STOCKS") {
        return { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/20" };
    }
    if (typeUpper === "ETF") {
        return { bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/20" };
    }
    if (typeUpper === "CRYPTO" || typeUpper === "CRYPTOCURRENCY") {
        return { bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/20" };
    }
    if (typeUpper === "BOND" || typeUpper === "BONDS") {
        return { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/20" };
    }
    if (typeUpper === "REIT") {
        return { bg: "bg-pink-500/15", text: "text-pink-400", border: "border-pink-500/20" };
    }
    if (typeUpper === "MUTUAL FUND") {
        return { bg: "bg-cyan-500/15", text: "text-cyan-400", border: "border-cyan-500/20" };
    }
    if (typeUpper === "OPTIONS") {
        return { bg: "bg-yellow-500/15", text: "text-yellow-400", border: "border-yellow-500/20" };
    }
    return { bg: "bg-slate-500/15", text: "text-slate-400", border: "border-slate-500/20" };
};
