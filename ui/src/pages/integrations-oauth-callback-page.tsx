import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Cockpit } from "@/components/layout/cockpit";
import { useAuth } from "@/components/auth/auth-provider";
import { completeIntegrationOAuth } from "@/api/integrations.api";
import { getOAuthRedirectUri } from "@/lib/integrations";

export function IntegrationsOAuthCallbackPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const oauthError = searchParams.get("error");
    const oauthErrorDescription = searchParams.get("error_description");
    if (oauthError) {
      setError(oauthErrorDescription || oauthError);
      return;
    }

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (!code || !state) {
      setError("Missing OAuth callback parameters (code/state).");
      return;
    }
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    const redirectUri = getOAuthRedirectUri();
    completeIntegrationOAuth(token, { code, state, redirectUri })
      .then(() => {
        navigate("/integrations", { replace: true });
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "OAuth callback failed");
      });
  }, [navigate, searchParams, token]);

  return (
    <Cockpit>
      <div className="flex h-full items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
          {error ? (
            <>
              <h1 className="text-lg font-semibold text-white">OAuth Connection Failed</h1>
              <p className="mt-2 text-sm text-red-300">{error}</p>
              <button
                onClick={() => navigate("/integrations", { replace: true })}
                className="mt-4 rounded-lg border border-white/10 bg-white/[0.08] px-4 py-2 text-sm text-white"
              >
                Back to Integrations
              </button>
            </>
          ) : (
            <>
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08]">
                <Loader2 className="h-5 w-5 animate-spin text-slate-200" />
              </div>
              <h1 className="text-lg font-semibold text-white">Connecting Integration</h1>
              <p className="mt-2 text-sm text-slate-400">
                Finishing OAuth handshake and saving your account token...
              </p>
            </>
          )}
        </div>
      </div>
    </Cockpit>
  );
}
