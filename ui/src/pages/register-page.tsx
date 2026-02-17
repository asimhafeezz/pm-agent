import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassInput } from "@/components/ui/glass-input";
import { Zap, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { apiUrl } from "@/lib/api";
import { GoogleContinueButton } from "@/components/auth/google-continue-button";

const auth0Domain = (import.meta.env.VITE_AUTH0_DOMAIN as string | undefined)?.trim() || "";
const auth0ClientId = (import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined)?.trim() || "";
const auth0Audience = (import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined)?.trim() || "";
const isAuth0Enabled = Boolean(auth0Domain && auth0ClientId);
const auth0StateStorageKey = "auth0:oauth-state";
const auth0StateSessionStorageKey = "auth0:oauth-state:session";
const auth0BaseUrl = auth0Domain
    ? (auth0Domain.startsWith("http") ? auth0Domain.replace(/\/$/, "") : `https://${auth0Domain}`)
    : "";

export function RegisterPage() {
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [error, setError] = useState("");

    const { login } = useAuth();
    const navigate = useNavigate();

    const generateOAuthState = () => {
        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    };

    const handleGoogleSignup = async () => {
        if (!isAuth0Enabled) {
            setError("Google signup is not configured yet.");
            return;
        }

        setError("");
        setIsGoogleLoading(true);

        try {
            const redirectUri = `${window.location.origin}/login`;
            const state = generateOAuthState();
            localStorage.setItem(auth0StateStorageKey, state);
            sessionStorage.setItem(auth0StateSessionStorageKey, state);

            const authorizeUrl = new URL(`${auth0BaseUrl}/authorize`);
            authorizeUrl.searchParams.set("response_type", "code");
            authorizeUrl.searchParams.set("client_id", auth0ClientId);
            authorizeUrl.searchParams.set("redirect_uri", redirectUri);
            authorizeUrl.searchParams.set("scope", "openid profile email");
            authorizeUrl.searchParams.set("connection", "google-oauth2");
            authorizeUrl.searchParams.set("prompt", "select_account");
            authorizeUrl.searchParams.set("state", state);
            if (auth0Audience) {
                authorizeUrl.searchParams.set("audience", auth0Audience);
            }

            window.location.assign(authorizeUrl.toString());
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to start Google signup.");
            setIsGoogleLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const res = await fetch(apiUrl("/api/auth/register"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ firstName, lastName, email, password }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.message || data?.error || "Registration failed");
            }

            const payload = data?.data ?? data;
            const token = payload?.accessToken || payload?.token;
            if (!token) {
                throw new Error("Missing auth token in response");
            }
            login(token, payload.user);
            navigate("/");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create account. Try again.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#09090b] relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-slate-500/5 rounded-full blur-[120px]" />
            </div>

            <div className="w-full max-w-md px-6 relative z-10">
                <div className="flex flex-col items-center mb-8">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-white/10 to-slate-500/10 border border-white/10 flex items-center justify-center mb-6 shadow-lg shadow-white/5">
                        <Zap className="h-6 w-6 text-white" fill="currentColor" fillOpacity={0.5} />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Create Account</h1>
                    <p className="text-slate-400 text-sm">Start your financial journey with Finly</p>
                </div>

                <GlassCard className="p-1 border-white/10 bg-white/[0.02] shadow-2xl shadow-black/50 overflow-hidden">
                    <div className="bg-[#0c0c0e]/80 backdrop-blur-xl p-7 rounded-xl border border-white/[0.02]">
                        {error && (
                            <div className="mb-6 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium text-center">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="flex justify-center">
                                <GoogleContinueButton
                                    onClick={handleGoogleSignup}
                                    loading={isGoogleLoading}
                                    primaryText="Continue with Google"
                                    showAvatar={false}
                                    showChevron={false}
                                    fullWidth={false}
                                    iconPosition="left"
                                    className="py-2.5 px-5"
                                />
                            </div>

                            <div className="relative my-1">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-white/10" />
                                </div>
                                <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                                    <span className="bg-[#0c0c0e] px-2 text-slate-500">or continue with email</span>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-medium text-slate-300 ml-1">First Name</label>
                                    <GlassInput
                                        type="text"
                                        required
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        placeholder="John"
                                        className="bg-black/20"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-medium text-slate-300 ml-1">Last Name</label>
                                    <GlassInput
                                        type="text"
                                        required
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        placeholder="Doe"
                                        className="bg-black/20"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-xs font-medium text-slate-300 ml-1">Email</label>
                                <GlassInput
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@example.com"
                                    autoComplete="email"
                                    className="bg-black/20"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-xs font-medium text-slate-300 ml-1">Password</label>
                                <GlassInput
                                    type="password"
                                    required
                                    minLength={8}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Min 8 characters"
                                    autoComplete="new-password"
                                    className="bg-black/20"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-white text-black font-semibold text-[13px] py-2 rounded-lg hover:bg-slate-200 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:cursor-not-allowed group"
                            >
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        Sign Up
                                        <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </GlassCard>

                <p className="mt-8 text-center text-xs text-slate-500">
                    Already have an account?{" "}
                    <Link to="/login" className="text-white hover:text-slate-300 font-medium transition-colors">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}
