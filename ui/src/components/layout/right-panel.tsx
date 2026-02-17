import { useNavigate } from "react-router-dom";
import { ArrowRight, Wallet } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

interface RightPanelProps {
    onClose?: () => void;
}

export function RightPanel({ onClose }: RightPanelProps) {
    const navigate = useNavigate();
    const { user } = useAuth();

    return (
        <div className="h-full flex flex-col py-6 px-4 gap-6 border-l border-white/5 bg-[#0c0c0e] overflow-y-auto sidebar-scroll">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-white mb-1">Profile</h2>
                    <p className="text-sm text-slate-400">{user?.email}</p>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <ArrowRight className="h-5 w-5 text-current" />
                    </button>
                )}
            </div>

            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 relative overflow-hidden">
                <p className="text-slate-400 text-sm">
                    This is a generic right panel. You can add your own widgets here.
                </p>
            </div>

            <div className="mt-auto pt-4 border-t border-white/5">
                <button
                    onClick={() => navigate("/settings")}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium text-slate-300 transition-colors"
                >
                    <Wallet className="h-4 w-4" />
                    Open Settings
                </button>
            </div>
        </div>
    );
}
