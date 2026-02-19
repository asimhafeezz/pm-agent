import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { RightPanel } from "./right-panel";
import { Wallet, Menu, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";

interface CockpitProps {
    children?: React.ReactNode;
}

export function Cockpit({ children }: CockpitProps) {
    const [leftOpen, setLeftOpen] = useState(() => (typeof window !== "undefined" ? window.innerWidth >= 768 : true));
    const [rightOpen, setRightOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const isWallet = location.pathname === "/wallet" || location.pathname === "/vault";
    const showRightSidebar = !isWallet; // Hide right sidebar on wallet page

    useEffect(() => {
        if (isWallet) {
            setRightOpen(false);
        }
    }, [isWallet]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const media = window.matchMedia("(min-width: 768px)");
        const syncFromMedia = () => setLeftOpen(media.matches);
        syncFromMedia();
        const handler = (event: MediaQueryListEvent) => setLeftOpen(event.matches);
        if ("addEventListener" in media) {
            media.addEventListener("change", handler);
            return () => media.removeEventListener("change", handler);
        }
        const legacyMedia = media as MediaQueryList & {
            addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
            removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
        };
        legacyMedia.addListener?.(handler);
        return () => legacyMedia.removeListener?.(handler);
    }, []);

    return (
        <div className="flex h-screen w-full bg-[#09090b] text-white overflow-hidden font-sans">
            {/* Mobile Sidebar Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity md:hidden",
                    leftOpen ? "opacity-100" : "pointer-events-none opacity-0"
                )}
                onClick={() => setLeftOpen(false)}
            />

            {/* Mobile Sidebar Drawer */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 w-[75vw] max-w-[300px] bg-[#0c0c0e] border-r border-white/5 transform transition-transform duration-300 ease-in-out md:hidden",
                    leftOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <Sidebar onClose={() => setLeftOpen(false)} autoCloseOnNav={true} />
            </aside>

            {/* Left Sidebar */}
            <aside
                className={cn(
                    "hidden md:block shrink-0 border-r border-white/5 transition-all duration-300 ease-in-out overflow-hidden relative",
                    leftOpen ? "w-[260px] opacity-100" : "w-0 opacity-0 border-none"
                )}
            >
                <div className="w-[260px] h-full">
                    <Sidebar onClose={() => setLeftOpen(false)} autoCloseOnNav={false} />
                </div>
            </aside>

            {/* Center Stage - Flexible */}
            <main className="flex-1 relative flex flex-col min-w-0 bg-black/50 transition-all duration-300">
                {/* Floating Toggles */}
                <div className="absolute top-4 left-4 z-50 flex gap-2">
                    <button
                        onClick={() => setLeftOpen(true)}
                        className={cn(
                            "h-8 w-8 flex items-center justify-center rounded-lg text-white bg-white/10 transition-colors backdrop-blur-sm",
                            leftOpen ? "hidden" : "flex"
                        )}
                        aria-label="Open sidebar"
                    >
                        <Menu className="h-5 w-5" strokeWidth={2} />
                    </button>
                    <button
                        onClick={() => navigate("/")}
                        className={cn(
                            "h-8 w-8 flex items-center justify-center rounded-lg text-white bg-white/10 transition-colors backdrop-blur-sm",
                            leftOpen ? "hidden" : "flex"
                        )}
                        aria-label="New chat"
                    >
                        <Plus className="h-5 w-5" strokeWidth={2} />
                    </button>
                </div>

                <div className="absolute top-4 right-4 z-50 flex gap-2">
                    {!rightOpen && showRightSidebar && (
                        <button
                            onClick={() => setRightOpen(true)}
                            className="h-8 w-8 items-center justify-center rounded-lg text-white bg-white/10 transition-colors backdrop-blur-sm flex"
                        >
                            <Wallet className="h-5 w-5 text-current" strokeWidth={2} />
                        </button>
                    )}
                </div>

                <div className="flex-1 relative z-0 overflow-hidden flex flex-col pt-14">
                    {children}
                </div>
            </main>

            {/* Right Sidebar */}
            {/* Mobile Right Sidebar Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden",
                    rightOpen ? "opacity-100" : "pointer-events-none opacity-0"
                )}
                onClick={() => setRightOpen(false)}
            />

            {/* Right Sidebar (Mobile & Desktop) */}
            <aside
                className={cn(
                    "fixed inset-y-0 right-0 z-50 bg-[#0c0c0e] border-l border-white/5 transition-all duration-300 ease-in-out overflow-hidden shadow-2xl lg:shadow-none lg:relative lg:shrink-0",
                    rightOpen ? "w-[85vw] max-w-[350px] opacity-100 translate-x-0" : "w-0 opacity-0 lg:w-0 lg:opacity-0 translate-x-full lg:translate-x-0"
                )}
            >
                <div className="w-[85vw] max-w-[350px] h-full">
                    <RightPanel onClose={() => setRightOpen(false)} />
                </div>
            </aside>
        </div>
    );
}
