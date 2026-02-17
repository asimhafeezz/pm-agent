import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, Zap } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { useAuth } from "@/components/auth/auth-provider";
import { apiUrl } from "@/lib/api";
import { GoogleContinueButton } from "@/components/auth/google-continue-button";

const auth0Domain = (import.meta.env.VITE_AUTH0_DOMAIN as string | undefined)?.trim() || "";
const auth0ClientId = (import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined)?.trim() || "";
const auth0Audience = (import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined)?.trim() || "";
const isAuth0Enabled = Boolean(auth0Domain && auth0ClientId);
const auth0StateStorageKey = "auth0:oauth-state";
const auth0StateSessionStorageKey = "auth0:oauth-state:session";
const auth0CodeStatusPrefix = "auth0:oauth-code-status:";
const auth0BaseUrl = auth0Domain
  ? auth0Domain.startsWith("http")
    ? auth0Domain.replace(/\/$/, "")
    : `https://${auth0Domain}`
  : "";

export function LoginPage() {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const callbackParams = new URLSearchParams(location.search);
  const isAuthCallbackFlow = callbackParams.has("code") || callbackParams.has("state");

  useEffect(() => {
    if (!isAuth0Enabled) return;

    const params = new URLSearchParams(location.search);
    const auth0Error = params.get("error");
    if (auth0Error) {
      const errorDescription = params.get("error_description")?.replace(/\+/g, " ");
      setError(errorDescription || "Google login was cancelled or failed.");
      setIsGoogleLoading(false);
      navigate("/login", { replace: true });
      return;
    }

    const hasCallbackParams = params.has("code") && params.has("state");
    if (!hasCallbackParams) return;

    let active = true;
    setIsGoogleLoading(true);
    setError("");

    (async () => {
      try {
        const code = params.get("code");
        const state = params.get("state");
        if (!code || !state) {
          throw new Error("Missing OAuth callback parameters.");
        }

        const codeStatusKey = `${auth0CodeStatusPrefix}${code}`;
        const existingCodeStatus = sessionStorage.getItem(codeStatusKey);
        if (existingCodeStatus === "processing" || existingCodeStatus === "done") {
          return;
        }
        sessionStorage.setItem(codeStatusKey, "processing");

        const expectedState =
          localStorage.getItem(auth0StateStorageKey) || sessionStorage.getItem(auth0StateSessionStorageKey);

        if (!expectedState || expectedState !== state) {
          sessionStorage.removeItem(codeStatusKey);
          throw new Error("Invalid login state. Please try again.");
        }

        localStorage.removeItem(auth0StateStorageKey);
        sessionStorage.removeItem(auth0StateSessionStorageKey);

        const redirectUri = `${window.location.origin}/login`;
        const res = await fetch(apiUrl("/api/auth/auth0-login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, redirectUri }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          sessionStorage.removeItem(codeStatusKey);
          throw new Error(data?.message || data?.error || "Google login failed.");
        }

        const payload = data?.data ?? data;
        const token = payload?.accessToken || payload?.token;
        if (!token || !payload?.user) {
          sessionStorage.removeItem(codeStatusKey);
          throw new Error("Missing application session from social login.");
        }

        sessionStorage.setItem(codeStatusKey, "done");
        login(token, payload.user);
        navigate("/", { replace: true });
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Google login failed.");
        navigate("/login", { replace: true });
      } finally {
        if (!active) return;
        setIsGoogleLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [location.search, login, navigate]);

  const handleGoogleLogin = async () => {
    if (!isAuth0Enabled) {
      setError("Google login is not configured yet.");
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
      setError(err instanceof Error ? err.message : "Unable to start Google login.");
      setIsGoogleLoading(false);
    }
  };

  const generateOAuthState = () => {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  };

  if (isAuthCallbackFlow || (isGoogleLoading && location.search.length > 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="flex flex-col items-center gap-3 text-slate-300">
          <Loader2 className="h-7 w-7 animate-spin text-white" />
          <p className="text-sm font-medium">Signing you in...</p>
          <p className="text-xs text-slate-500">Please wait, redirecting you securely.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-slate-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md px-6 relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-white/10 to-slate-500/10 border border-white/10 flex items-center justify-center mb-6 shadow-lg shadow-white/5">
            <Zap className="h-6 w-6 text-white" fill="currentColor" fillOpacity={0.5} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Sign in</h1>
          <p className="text-slate-400 text-sm">Continue with Google to access PM Agent</p>
        </div>

        <GlassCard className="p-1 border-white/10 bg-white/[0.02] shadow-2xl shadow-black/50 overflow-hidden">
          <div className="bg-[#0c0c0e]/80 backdrop-blur-xl p-7 rounded-xl border border-white/[0.02]">
            {error && (
              <div className="mb-6 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium text-center">
                {error}
              </div>
            )}

            <div className="flex justify-center">
              <GoogleContinueButton
                onClick={handleGoogleLogin}
                loading={isGoogleLoading}
                primaryText="Continue with Google"
                showAvatar={false}
                showChevron={false}
                fullWidth={false}
                iconPosition="left"
                className="py-2.5 px-5"
              />
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
