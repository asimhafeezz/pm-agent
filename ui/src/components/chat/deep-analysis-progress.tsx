import { HugeiconsIcon } from "@hugeicons/react";
import { SparklesIcon } from "@hugeicons/core-free-icons";
import { Check, Loader2 } from "lucide-react";

export interface DeepProgressStep {
    id: string;
    label: string;
    status: "pending" | "active" | "completed";
    detail?: string;
}

export interface DeepAnalysisProgress {
    currentStep: string;
    steps: DeepProgressStep[];
}

interface DeepAnalysisProgressProps {
    progress: DeepAnalysisProgress;
}

export function DeepAnalysisProgressStepper({ progress }: DeepAnalysisProgressProps) {
    return (
        <div className="flex flex-col gap-4 max-w-4xl mx-auto mt-6 px-1">
            <div className="flex items-center gap-4 mb-2">
                <div className="h-10 w-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                    <HugeiconsIcon icon={SparklesIcon} size={18} className="text-white animate-[spin_3s_linear_infinite]" strokeWidth={2} />
                </div>
                <div className="flex flex-col">
                    <p className="text-slate-200 text-sm font-medium">Deep Analysis</p>
                    <p className="text-slate-500 text-xs">Comprehensive research in progress</p>
                </div>
            </div>

            <div className="ml-5 border-l border-white/[0.08] pl-6 space-y-3">
                {progress.steps.map((step) => (
                    <div
                        key={step.id}
                        className={`flex items-start gap-3 transition-all duration-300 ${
                            step.status === "pending" ? "opacity-40" : "opacity-100"
                        }`}
                    >
                        {/* Status icon */}
                        <div className="mt-0.5 shrink-0">
                            {step.status === "completed" ? (
                                <div className="h-5 w-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                                    <Check className="h-3 w-3 text-emerald-400" />
                                </div>
                            ) : step.status === "active" ? (
                                <div className="h-5 w-5 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
                                    <Loader2 className="h-3 w-3 text-blue-400 animate-spin" />
                                </div>
                            ) : (
                                <div className="h-5 w-5 rounded-full bg-white/5 border border-white/10" />
                            )}
                        </div>

                        {/* Label + detail */}
                        <div className="flex flex-col">
                            <span
                                className={`text-xs font-medium ${
                                    step.status === "active"
                                        ? "text-slate-200"
                                        : step.status === "completed"
                                        ? "text-slate-400"
                                        : "text-slate-600"
                                }`}
                            >
                                {step.label}
                            </span>
                            {step.status === "active" && step.detail && (
                                <span className="text-[11px] text-slate-500 mt-0.5 animate-pulse">
                                    {step.detail}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Create the initial progress steps for deep analysis.
 */
export function createInitialDeepProgress(): DeepAnalysisProgress {
    return {
        currentStep: "loading_profile",
        steps: [
            { id: "loading_profile", label: "Loading your profile", status: "active" },
            { id: "fetching_data", label: "Fetching market data & fundamentals", status: "pending" },
            { id: "web_research", label: "Searching web for analyst insights", status: "pending" },
            { id: "analyzing", label: "Scoring & analyzing", status: "pending" },
            { id: "report", label: "Generating report", status: "pending" },
        ],
    };
}

/**
 * Update progress based on agent events.
 */
export function updateDeepProgress(
    prev: DeepAnalysisProgress | undefined,
    event: string,
    payload: any
): DeepAnalysisProgress {
    if (!prev) return createInitialDeepProgress();

    const steps = prev.steps.map((s) => ({ ...s }));

    const setStep = (id: string, status: "active" | "completed", detail?: string) => {
        for (const step of steps) {
            if (step.id === id) {
                step.status = status;
                if (detail !== undefined) step.detail = detail;
            }
        }
    };

    const completeAndActivate = (completedId: string, activeId: string, detail?: string) => {
        setStep(completedId, "completed");
        setStep(activeId, "active", detail);
    };

    switch (event) {
        case "loaded_user":
            completeAndActivate("loading_profile", "fetching_data");
            break;

        case "collecting_data":
            setStep("loading_profile", "completed");
            setStep("fetching_data", "active", "Fetching from multiple sources...");
            break;

        case "web_research_progress": {
            const { queriesCompleted, totalQueries, currentQuery } = payload || {};
            setStep("fetching_data", "completed");
            if (queriesCompleted !== undefined && totalQueries !== undefined) {
                setStep("web_research", "active", `${queriesCompleted}/${totalQueries} queries${currentQuery ? ` — ${currentQuery}` : ""}`);
            } else {
                setStep("web_research", "active");
            }
            break;
        }

        case "news_classified":
        case "scoring_done":
            setStep("fetching_data", "completed");
            setStep("web_research", "completed");
            setStep("analyzing", "active", "Running deep scoring model...");
            break;

        case "analyzing": {
            const step = payload?.step;
            setStep("fetching_data", "completed");
            setStep("web_research", "completed");
            if (step === "scoring") {
                setStep("analyzing", "active", "Running deep scoring model...");
            } else if (step === "report") {
                setStep("analyzing", "completed");
                setStep("report", "active", "Synthesizing comprehensive report...");
            }
            break;
        }

        case "response_ready":
        case "deep_completed":
            for (const step of steps) {
                step.status = "completed";
                step.detail = undefined;
            }
            break;
    }

    const activeStep = steps.find((s) => s.status === "active");
    return {
        currentStep: activeStep?.id || prev.currentStep,
        steps,
    };
}
