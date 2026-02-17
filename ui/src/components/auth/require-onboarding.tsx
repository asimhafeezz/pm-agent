import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth-provider";
import { apiUrl } from "@/lib/api";
import { Loader2 } from "lucide-react";

type UserProfile = {
    onboardingCompletedAt?: string | null;
    baseCurrency?: string | null;
};

export function RequireOnboarding({ children }: { children: React.ReactNode }) {
    const { token, user } = useAuth();
    const location = useLocation();
    const [isLoading, setIsLoading] = useState(true);
    const [profile, setProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        if (!token) return;
        let isMounted = true;
        setIsLoading(true);
        fetch(apiUrl("/api/me/profile"), {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((res) => res.json())
            .then((payload) => {
                if (!isMounted) return;
                const data = payload?.data ?? payload;
                setProfile(data ?? null);
                if (data?.onboardingCompletedAt && user?.id) {
                    localStorage.setItem(`onboarding:${user.id}`, "true");
                }
            })
            .catch(() => {
                if (!isMounted) return;
                setProfile(null);
            })
            .finally(() => {
                if (!isMounted) return;
                setIsLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [token]);

    if (isLoading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-[#09090b]">
                <Loader2 className="h-8 w-8 text-slate-200 animate-spin" />
            </div>
        );
    }

    const localComplete = user?.id
        ? localStorage.getItem(`onboarding:${user.id}`) === "true"
        : false;
    const isComplete = Boolean(profile?.onboardingCompletedAt) || localComplete;
    if (!isComplete && location.pathname !== "/onboarding") {
        return <Navigate to="/onboarding" replace />;
    }

    return children;
}
