import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassSelect } from "@/components/ui/glass-select";
import { GlassInput } from "@/components/ui/glass-input";
import { useAuth } from "@/components/auth/auth-provider";
import { apiUrl } from "@/lib/api";
import { Loader2, Sparkles, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";

type ProfileDraft = {
    baseCurrency: string;
    country: string;
    age: string;
    riskLevel: string;
    timeHorizonDays: string;
    jobStability: string;
    panicTolerance: string;
    maxDrawdownPct: string;
    annualIncomeRange: string;
    netWorthRange: string;
    monthlyExpensesRange: string;
    dependents: string;
    experienceLevel: string;
    taxBracketRange: string;
    preferencesNotes: string;
};

export function OnboardingPage() {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [draft, setDraft] = useState<ProfileDraft>({
        baseCurrency: "",
        country: "",
        age: "",
        riskLevel: "",
        timeHorizonDays: "",
        jobStability: "",
        panicTolerance: "",
        maxDrawdownPct: "",
        annualIncomeRange: "",
        netWorthRange: "",
        monthlyExpensesRange: "",
        dependents: "",
        experienceLevel: "",
        taxBracketRange: "",
        preferencesNotes: "",
    });

    // Options mapped to match SettingsPage and API expectations
    const currencyOptions = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "SGD"].map(c => ({ value: c, label: c }));

    const ageOptions = [
        { label: "18-25", value: "22" },
        { label: "26-35", value: "30" },
        { label: "36-45", value: "40" },
        { label: "46-55", value: "50" },
        { label: "56-65", value: "60" },
        { label: "65+", value: "70" },
    ];

    const experienceOptions = ["New", "Some experience", "Experienced", "Expert"].map(o => ({ value: o, label: o }));

    const riskOptions = ["Conservative", "Moderate", "Balanced", "Growth", "Aggressive"].map(o => ({ value: o, label: o }));

    const horizonOptions = [
        { label: "3-12 months", value: "180" },
        { label: "1-3 years", value: "730" },
        { label: "3-5 years", value: "1460" },
        { label: "5-10 years", value: "2920" },
        { label: "10+ years", value: "3650" },
    ];

    const jobStabilityOptions = ["Unemployed", "Contract", "Part-time", "Full-time", "Self-employed", "Retired"].map(o => ({ value: o, label: o }));

    const panicOptions = ["Very Low", "Low", "Medium", "High", "Very High"].map(o => ({ value: o, label: o }));

    const drawdownOptions = [
        { label: "5%", value: "5" },
        { label: "10%", value: "10" },
        { label: "15%", value: "15" },
        { label: "20%", value: "20" },
        { label: "25%", value: "25" },
        { label: "30%", value: "30" },
        { label: "40%", value: "40" },
        { label: "50%+", value: "50" },
    ];

    const incomeRanges = ["< $50k", "$50k-$100k", "$100k-$250k", "$250k-$500k", "$500k+"].map(o => ({ value: o, label: o }));
    const netWorthRanges = ["< $50k", "$50k-$250k", "$250k-$1M", "$1M-$5M", "$5M+"].map(o => ({ value: o, label: o }));
    const expenseRanges = ["< $2k", "$2k-$5k", "$5k-$10k", "$10k-$25k", "$25k+"].map(o => ({ value: o, label: o }));
    const taxRanges = ["<10%", "10%-20%", "20%-30%", "30%-40%", "40%+"].map(o => ({ value: o, label: o }));

    const dependentOptions = [
        { label: "0", value: "0" },
        { label: "1", value: "1" },
        { label: "2", value: "2" },
        { label: "3", value: "3" },
        { label: "4", value: "4" },
        { label: "5+", value: "5" },
    ];

    const steps = useMemo(
        () => [
            {
                title: "Basics",
                subtitle: "Let's start with the essentials.",
                icon: Sparkles,
            },
            {
                title: "Risk Profile",
                subtitle: "Understanding your investment style.",
                icon: CheckCircle2,
            },
            {
                title: "Financial Context",
                subtitle: "Tailoring advice to your situation.",
                icon: Sparkles,
            },
        ],
        []
    );

    const update = (key: keyof ProfileDraft, value: string) => {
        setDraft((prev) => ({ ...prev, [key]: value }));
    };

    const validateStep = () => {
        if (step === 0) {
            if (!draft.baseCurrency) return "Base currency is required.";
            if (!draft.age) return "Age range is required.";
            if (!draft.experienceLevel) return "Experience level is required.";
        }
        if (step === 1) {
            if (!draft.riskLevel) return "Risk level is required.";
            if (!draft.timeHorizonDays) return "Time horizon is required.";
            if (!draft.jobStability) return "Job stability is required.";
        }
        return "";
    };

    const handleNext = () => {
        const message = validateStep();
        if (message) {
            setError(message);
            return;
        }
        setError("");
        setStep((prev) => Math.min(prev + 1, steps.length - 1));
    };

    const handleBack = () => {
        setError("");
        setStep((prev) => Math.max(prev - 1, 0));
    };

    const handleSubmit = async () => {
        const message = validateStep();
        if (message) {
            setError(message);
            return;
        }

        setIsSubmitting(true);
        setError("");

        try {
            const payload = {
                baseCurrency: draft.baseCurrency,
                country: draft.country.trim() || undefined,
                age: draft.age ? Number(draft.age) : undefined,
                riskLevel: draft.riskLevel,
                timeHorizonDays: draft.timeHorizonDays ? Number(draft.timeHorizonDays) : undefined,
                jobStability: draft.jobStability || undefined,
                panicTolerance: draft.panicTolerance || undefined,
                maxDrawdownPct: draft.maxDrawdownPct ? Number(draft.maxDrawdownPct) : undefined,
                annualIncomeRange: draft.annualIncomeRange || undefined,
                netWorthRange: draft.netWorthRange || undefined,
                monthlyExpensesRange: draft.monthlyExpensesRange || undefined,
                dependents: draft.dependents ? Number(draft.dependents) : undefined,
                experienceLevel: draft.experienceLevel || undefined,
                taxBracketRange: draft.taxBracketRange || undefined,
                investmentPreferencesJson: draft.preferencesNotes
                    ? { notes: draft.preferencesNotes.trim() }
                    : undefined,
                // Note: investmentGoalSummary is removed
            };

            const res = await fetch(apiUrl("/api/me/profile"), {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.message || "Failed to save profile.");
            }

            const completeRes = await fetch(apiUrl("/api/me/onboarding/complete"), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!completeRes.ok) {
                const data = await completeRes.json().catch(() => ({}));
                throw new Error(data?.message || "Failed to complete onboarding.");
            }

            navigate("/", { replace: true });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const CurrentIcon = steps[step].icon;

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#09090b] relative overflow-hidden px-4 py-12">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[10%] left-[20%] w-[30%] h-[30%] bg-white/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-[20%] right-[10%] w-[40%] h-[40%] bg-slate-500/5 rounded-full blur-[120px]" />
            </div>

            <GlassCard className="w-full max-w-2xl p-1 border-white/10 bg-white/[0.02] shadow-2xl shadow-black/50 overflow-hidden relative z-10">
                <div className="bg-[#0c0c0e]/95 backdrop-blur-xl p-8 rounded-xl border border-white/[0.02]">

                    {/* Header */}
                    <div className="flex items-start justify-between mb-8">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-300 font-semibold bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                    Step {step + 1} of {steps.length}
                                </span>
                            </div>
                            <h1 className="text-3xl font-bold text-white mb-1">
                                {steps[step].title}
                            </h1>
                            <p className="text-slate-400 text-sm">{steps[step].subtitle}</p>
                        </div>
                        <div className="h-12 w-12 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center">
                            <CurrentIcon className="h-6 w-6 text-white" />
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="flex items-center gap-2 mb-8">
                        {steps.map((_, index) => (
                            <div
                                key={index}
                                className={`h-1 flex-1 rounded-full transition-all duration-300 ${index <= step ? "bg-white" : "bg-white/10"
                                    }`}
                            />
                        ))}
                    </div>

                    {error && (
                        <div className="mb-6 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium text-center">
                            {error}
                        </div>
                    )}

                    <div className="min-h-[320px]">
                        {step === 0 && (
                            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">Base Currency <span className="text-white/60">*</span></label>
                                    <GlassSelect
                                        value={draft.baseCurrency}
                                        onChange={(value) => update("baseCurrency", value)}
                                        placeholder="Select currency (e.g., USD)"
                                        options={currencyOptions}
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">Country</label>
                                        <GlassInput
                                            value={draft.country}
                                            onChange={(e) => update("country", e.target.value)}
                                            placeholder="United States"
                                            className="bg-black/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">Age Range <span className="text-white/60">*</span></label>
                                        <GlassSelect
                                            value={draft.age}
                                            onChange={(value) => update("age", value)}
                                            placeholder="Select age range"
                                            options={ageOptions}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">Investment Experience <span className="text-white/60">*</span></label>
                                    <GlassSelect
                                        value={draft.experienceLevel}
                                        onChange={(value) => update("experienceLevel", value)}
                                        placeholder="Select your experience level"
                                        options={experienceOptions}
                                    />
                                </div>
                            </div>
                        )}

                        {step === 1 && (
                            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">Risk Level <span className="text-white/60">*</span></label>
                                    <GlassSelect
                                        value={draft.riskLevel}
                                        onChange={(value) => update("riskLevel", value)}
                                        placeholder="How much risk are you willing to take?"
                                        options={riskOptions}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">Time Horizon <span className="text-white/60">*</span></label>
                                    <GlassSelect
                                        value={draft.timeHorizonDays}
                                        onChange={(value) => update("timeHorizonDays", value)}
                                        placeholder="How long do you plan to invest?"
                                        options={horizonOptions}
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">Job Stability <span className="text-white/60">*</span></label>
                                        <GlassSelect
                                            value={draft.jobStability}
                                            onChange={(value) => update("jobStability", value)}
                                            placeholder="Select stability"
                                            options={jobStabilityOptions}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">Panic Tolerance</label>
                                        <GlassSelect
                                            value={draft.panicTolerance}
                                            onChange={(value) => update("panicTolerance", value)}
                                            placeholder="Reaction to drops"
                                            options={panicOptions}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">Max Drawdown Tolerance</label>
                                    <GlassSelect
                                        value={draft.maxDrawdownPct}
                                        onChange={(value) => update("maxDrawdownPct", value)}
                                        placeholder="Max drop you can handle"
                                        options={drawdownOptions}
                                    />
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">Annual Income</label>
                                        <GlassSelect
                                            value={draft.annualIncomeRange}
                                            onChange={(value) => update("annualIncomeRange", value)}
                                            placeholder="Select range"
                                            options={incomeRanges}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">Net Worth</label>
                                        <GlassSelect
                                            value={draft.netWorthRange}
                                            onChange={(value) => update("netWorthRange", value)}
                                            placeholder="Select range"
                                            options={netWorthRanges}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">Monthly Expenses</label>
                                        <GlassSelect
                                            value={draft.monthlyExpensesRange}
                                            onChange={(value) => update("monthlyExpensesRange", value)}
                                            placeholder="Select range"
                                            options={expenseRanges}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">Tax Bracket</label>
                                        <GlassSelect
                                            value={draft.taxBracketRange}
                                            onChange={(value) => update("taxBracketRange", value)}
                                            placeholder="Select bracket"
                                            options={taxRanges}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">Dependents</label>
                                    <GlassSelect
                                        value={draft.dependents}
                                        onChange={(value) => update("dependents", value)}
                                        placeholder="Number of dependents"
                                        options={dependentOptions}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">Additional Notes (Optional)</label>
                                    <textarea
                                        value={draft.preferencesNotes}
                                        onChange={(e) => update("preferencesNotes", e.target.value)}
                                        className="w-full bg-black/20 border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[13px] text-white/90 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/15 min-h-[80px] resize-none hover:border-white/12 transition-all"
                                        placeholder="Any specific sectors to avoid, ESG preferences, etc."
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between mt-10 pt-6 border-t border-white/[0.05]">
                        <button
                            onClick={handleBack}
                            disabled={step === 0}
                            className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors px-2 py-1"
                        >
                            <ArrowLeft className="h-3 w-3" />
                            Back
                        </button>
                        <div className="flex items-center gap-3">
                            {step < steps.length - 1 ? (
                                <button
                                    onClick={handleNext}
                                    className="bg-white text-black text-xs font-semibold px-6 py-2.5 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
                                >
                                    Continue
                                    <ArrowRight className="h-3 w-3" />
                                </button>
                            ) : (
                                <button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                    className="bg-white text-black text-xs font-semibold px-6 py-2.5 rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-white/5"
                                >
                                    {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Complete Setup"}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
}
