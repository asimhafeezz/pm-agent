import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth-provider";
import { Loader2 } from "lucide-react";
import React from "react";

export function RequireAuth({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-[#09090b]">
                <Loader2 className="h-8 w-8 text-slate-200 animate-spin" />
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
}
