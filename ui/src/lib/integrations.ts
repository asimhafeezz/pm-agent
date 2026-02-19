const normalizeUrl = (value: string) => value.trim().replace(/\/+$/, "");

export function getOAuthRedirectUri(): string {
  const configured = (import.meta.env.VITE_INTEGRATIONS_OAUTH_REDIRECT_URI as string | undefined) || "";
  if (configured.trim()) {
    return normalizeUrl(configured);
  }
  return `${normalizeUrl(window.location.origin)}/integrations/callback`;
}
