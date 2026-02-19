import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cockpit } from "@/components/layout/cockpit";
import { useAuth } from "@/components/auth/auth-provider";
import {
  connectIntegrationToken,
  disconnectIntegration,
  fetchIntegrationStatuses,
  startIntegrationOAuth,
  type IntegrationProvider,
} from "@/api/integrations.api";
import {
  useLinearProjects,
  useLinearTeams,
  useLinearUsers,
  useLinearViewer,
} from "@/hooks/use-linear";
import { useIntegrationsStore } from "@/store/integrations-store";
import { getOAuthRedirectUri } from "@/lib/integrations";
import { IntegrationCard, IntegrationCardWaitlist } from "@/components/integrations/integration-card";
import { IntegrationDetailsModal } from "@/components/integrations/integration-details-modal";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassSelect } from "@/components/ui/glass-select";
import { Loader2, Plug } from "lucide-react";

const comingSoon = [
  { name: "Jira", description: "Enterprise backlog sync", icon: "J" },
  { name: "GitHub", description: "PR merge/status automation", icon: "G" },
];

export function IntegrationsPage() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const linearPrefs = useIntegrationsStore((s) => s.linear);
  const setLinearPrefs = useIntegrationsStore((s) => s.setLinear);
  const resetLinearPrefs = useIntegrationsStore((s) => s.resetLinear);

  const [linearToken, setLinearToken] = useState("");
  const [notionToken, setNotionToken] = useState("");
  const [googleDocsToken, setGoogleDocsToken] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [oauthLoadingProvider, setOauthLoadingProvider] = useState<IntegrationProvider | null>(null);

  // Modal State
  const [selectedProvider, setSelectedProvider] = useState<IntegrationProvider | null>(null);

  const statusesQuery = useQuery({
    queryKey: ["integrations", "statuses"],
    queryFn: () => fetchIntegrationStatuses(token!),
    enabled: !!token,
  });

  const byProvider = useMemo(() => {
    const map = new Map<
      string,
      { connected: boolean; metadata?: Record<string, unknown> | null }
    >();
    for (const row of statusesQuery.data ?? []) {
      map.set(row.provider, { connected: row.connected, metadata: row.metadata });
    }
    return map;
  }, [statusesQuery.data]);

  const notionStatus = byProvider.get("notion");
  const notionMetadata = notionStatus?.metadata || null;
  const notionWorkspaceName = String(
    notionMetadata?.workspaceName ||
      notionMetadata?.workspace_name ||
      notionMetadata?.workspaceId ||
      notionMetadata?.workspace_id ||
      ""
  ).trim();

  const linearConnected = Boolean(byProvider.get("linear")?.connected);
  const notionConnected = Boolean(byProvider.get("notion")?.connected);
  const googleDocsConnected = Boolean(byProvider.get("google-docs")?.connected);
  const gmailConnected = Boolean(byProvider.get("gmail")?.connected);
  const slackConnected = Boolean(byProvider.get("slack")?.connected);

  const viewerQuery = useLinearViewer(linearConnected);
  const teamsQuery = useLinearTeams(linearConnected);
  const projectsQuery = useLinearProjects(linearPrefs.teamId || undefined, linearConnected);
  const usersQuery = useLinearUsers(userSearch || undefined, linearConnected);

  const connectMutation = useMutation({
    mutationFn: (args: { provider: IntegrationProvider; accessToken: string }) =>
      connectIntegrationToken(args.provider, args.accessToken, token!),
    onSuccess: (_data, variables) => {
      if (variables.provider === "linear") setLinearToken("");
      if (variables.provider === "notion") setNotionToken("");
      if (variables.provider === "google-docs") setGoogleDocsToken("");
      if (variables.provider === "gmail") setSelectedProvider(null);
      if (variables.provider === "slack") setSelectedProvider(null);
      setError(null);
      qc.invalidateQueries({ queryKey: ["integrations", "statuses"] });
      qc.invalidateQueries({ queryKey: ["linear"] });

      // Close modal on success for token-based integrations if no further config needed
      if (['notion', 'google-docs', 'gmail', 'slack'].includes(variables.provider)) {
        setSelectedProvider(null);
      }
    },
    onError: (e) => {
      setError(e instanceof Error ? e.message : "Failed to connect integration");
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (provider: IntegrationProvider) => disconnectIntegration(provider, token!),
    onSuccess: (_data, provider) => {
      if (provider === "linear") {
        resetLinearPrefs();
      }
      setError(null);
      qc.invalidateQueries({ queryKey: ["integrations", "statuses"] });
      qc.invalidateQueries({ queryKey: ["linear"] });
    },
    onError: (e) => {
      setError(e instanceof Error ? e.message : "Failed to disconnect integration");
    },
  });

  const onConnect = (provider: IntegrationProvider) => {
    const value =
      provider === "linear"
        ? linearToken
        : provider === "notion"
          ? notionToken
          : googleDocsToken;

    if (!value.trim()) {
      setError(`Enter a token for ${provider} first.`);
      return;
    }
    connectMutation.mutate({ provider, accessToken: value.trim() });
  };

  const onDisconnect = (provider: IntegrationProvider) => {
    disconnectMutation.mutate(provider);
  };

  const onToggle = (provider: IntegrationProvider, isConnected: boolean) => {
    if (isConnected) {
      onDisconnect(provider);
    } else {
      setSelectedProvider(provider);
    }
  };

  const onConnectOAuth = async (provider: IntegrationProvider) => {
    if (!token) {
      setError("Missing auth token. Please login again.");
      return;
    }
    setError(null);
    setOauthLoadingProvider(provider);
    try {
      const redirectUri = getOAuthRedirectUri();
      const payload = await startIntegrationOAuth(provider, token, redirectUri);
      window.location.assign(payload.authorizationUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to start ${provider} OAuth`);
      setOauthLoadingProvider(null);
    }
  };

  const linearUsers = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);

  return (
    <Cockpit>
      <div className="flex flex-col h-full overflow-y-auto bg-[#09090b]">
        {/* Header Section */}
        <div className="px-8 py-10 max-w-7xl mx-auto w-full">
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-white tracking-tight">Integrations</h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-[15px] leading-relaxed">
              Connect your favorite tools to sync roadmaps, import documents, and automate your workflow.
              Manage your active connections and configure sync preferences below.
            </p>
          </div>

          {error ? (
            <div className="mb-8 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 lg:grid-cols-2">
            {/* Linear Integration */}
            <IntegrationCard
              title="Linear"
              description="Roadmap + ticket sync target"
              icon={<span className="text-lg font-bold">L</span>}
              status={linearConnected ? "connected" : "disconnected"}
              connectedAs={viewerQuery.data ? `${viewerQuery.data.name}` : undefined}
              onToggle={() => onToggle("linear", linearConnected)}
              onConfigure={() => setSelectedProvider("linear")}
              isLoading={connectMutation.isPending || disconnectMutation.isPending}
            />

            {/* Notion Integration */}
            <IntegrationCard
              title="Notion"
              description="Import PRDs & specs"
              icon={<span className="text-lg font-bold">N</span>}
              status={notionConnected ? "connected" : "disconnected"}
              connectedAs={notionWorkspaceName || undefined}
              onToggle={() => onToggle("notion", notionConnected)}
              onConfigure={() => setSelectedProvider("notion")}
              isLoading={connectMutation.isPending || disconnectMutation.isPending}
            />

            {/* Google Docs Integration */}
            <IntegrationCard
              title="Google Docs"
              description="Import specs and notes"
              icon={<span className="text-lg font-bold">G</span>}
              status={googleDocsConnected ? "connected" : "disconnected"}
              onToggle={() => onToggle("google-docs", googleDocsConnected)}
              onConfigure={() => setSelectedProvider("google-docs")}
              isLoading={connectMutation.isPending || disconnectMutation.isPending}
            />

            {/* Gmail Integration */}
            <IntegrationCard
              title="Gmail"
              description="Email monitoring & context"
              icon={<span className="text-lg font-bold">M</span>}
              status={gmailConnected ? "connected" : "disconnected"}
              onToggle={() => onToggle("gmail", gmailConnected)}
              onConfigure={() => setSelectedProvider("gmail")}
              isLoading={connectMutation.isPending || disconnectMutation.isPending}
            />

            {/* Slack Integration */}
            <IntegrationCard
              title="Slack"
              description="Standups, digests & notifications"
              icon={<span className="text-lg font-bold">S</span>}
              status={slackConnected ? "connected" : "disconnected"}
              onToggle={() => onToggle("slack", slackConnected)}
              onConfigure={() => setSelectedProvider("slack")}
              isLoading={connectMutation.isPending || disconnectMutation.isPending}
            />
          </div>

          <div className="mt-12">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <span className="w-1 h-5 bg-blue-500 rounded-full" />
              Coming Soon
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {comingSoon.map((integration) => (
                <IntegrationCardWaitlist
                  key={integration.name}
                  title={integration.name}
                  description={integration.description}
                  icon={integration.icon}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Linear Modal */}
        <IntegrationDetailsModal
          isOpen={selectedProvider === "linear"}
          onClose={() => setSelectedProvider(null)}
          title="Linear Integration"
          icon={<span className="text-lg font-bold">L</span>}
        >
          <div className="space-y-6">
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
              <h4 className="text-sm font-medium text-white mb-2">Connection</h4>
              <div className="flex gap-3">
                <button
                  onClick={() => onConnectOAuth("linear")}
                  disabled={oauthLoadingProvider !== null || !token || linearConnected}
                  className="flex-1 h-10 rounded-lg border border-white/10 bg-white/[0.05] hover:bg-white/[0.1] text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {oauthLoadingProvider === "linear" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                  Connect via OAuth
                </button>
              </div>
              {/* Only show API key input if not connected */}
              {!linearConnected && (
                <>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-[#18181b] px-2 text-slate-500">Or use API Key</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <GlassInput
                      type="password"
                      value={linearToken}
                      onChange={(e) => setLinearToken(e.target.value)}
                      placeholder="lin_api_..."
                      disabled={linearConnected}
                    />
                    <button
                      onClick={() => onConnect("linear")}
                      disabled={connectMutation.isPending || !token || linearConnected}
                      className="h-[42px] px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white transition-all disabled:opacity-50"
                    >
                      {connectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                    </button>
                  </div>
                </>
              )}
            </div>

            {linearConnected && (
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 space-y-4">
                <h4 className="text-sm font-medium text-white">Sync Preferences</h4>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400">Team</label>
                    <GlassSelect
                      value={linearPrefs.teamId}
                      onChange={(val) => setLinearPrefs({ teamId: val, projectId: "" })}
                      options={[
                        { value: "", label: "Select team" },
                        ...(teamsQuery.data ?? []).map(t => ({ value: t.id, label: `${t.name} (${t.key})` }))
                      ]}
                      placeholder="Select Team"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400">Project</label>
                    <GlassSelect
                      value={linearPrefs.projectId}
                      onChange={(val) => setLinearPrefs({ projectId: val })}
                      options={[
                        { value: "", label: "All projects" },
                        ...(projectsQuery.data ?? []).map(p => ({ value: p.id, label: p.name }))
                      ]}
                      placeholder="Select Project"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400">Assignee Filter</label>
                      <GlassInput
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Search users..."
                        className="h-[42px]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400">Default Assignee</label>
                      <GlassSelect
                        value={linearPrefs.assigneeId}
                        onChange={(val) => setLinearPrefs({ assigneeId: val })}
                        options={[
                          { value: "", label: "No default" },
                          ...linearUsers.map(u => ({ value: u.id, label: u.name }))
                        ]}
                        placeholder="Assignee"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </IntegrationDetailsModal>

        {/* Notion Modal */}
        <IntegrationDetailsModal
          isOpen={selectedProvider === "notion"}
          onClose={() => setSelectedProvider(null)}
          title="Notion Integration"
          icon={<span className="text-lg font-bold">N</span>}
        >
          <div className="space-y-6">
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
              <p className="text-sm text-slate-400 mb-4">Connect Notion to import your PRDs and specifications directly into the agent context.</p>
              {!notionConnected && (
                <button
                  onClick={() => onConnectOAuth("notion")}
                  disabled={oauthLoadingProvider !== null || !token || notionConnected}
                  className="w-full h-10 rounded-lg border border-white/10 bg-white/[0.05] hover:bg-white/[0.1] text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4"
                >
                  {oauthLoadingProvider === "notion" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                  Connect via OAuth
                </button>
              )}

              {!notionConnected && (
                <>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-[#18181b] px-2 text-slate-500">Or use Secret</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <GlassInput
                      type="password"
                      value={notionToken}
                      onChange={(e) => setNotionToken(e.target.value)}
                      placeholder="secret_..."
                      disabled={notionConnected}
                    />
                    <button
                      onClick={() => onConnect("notion")}
                      disabled={connectMutation.isPending || !token || notionConnected}
                      className="h-[42px] px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white transition-all disabled:opacity-50"
                    >
                      {connectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                    </button>
                  </div>
                </>
              )}

              {notionConnected && (
                <div className="space-y-3">
                  <div className="text-emerald-400 text-sm flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    Connected successfully
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="text-xs text-slate-400">Connected workspace</p>
                    <p className="text-sm text-white mt-0.5">
                      {notionWorkspaceName || "Workspace info not available"}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">
                    To switch workspace, disconnect Notion and connect again.
                  </p>
                  <button
                    onClick={() => onDisconnect("notion")}
                    disabled={disconnectMutation.isPending}
                    className="w-full h-10 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-sm font-medium text-red-200 transition-all disabled:opacity-50"
                  >
                    Disconnect Notion
                  </button>
                </div>
              )}
            </div>
          </div>
        </IntegrationDetailsModal>

        {/* Google Specs Modal */}
        <IntegrationDetailsModal
          isOpen={selectedProvider === "google-docs"}
          onClose={() => setSelectedProvider(null)}
          title="Google Docs Integration"
          icon={<span className="text-lg font-bold">G</span>}
        >
          <div className="space-y-6">
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
              <p className="text-sm text-slate-400 mb-4">Connect Google Docs to read specs and notes.</p>
              {!googleDocsConnected && (
                <button
                  onClick={() => onConnectOAuth("google-docs")}
                  disabled={oauthLoadingProvider !== null || !token || googleDocsConnected}
                  className="w-full h-10 rounded-lg border border-white/10 bg-white/[0.05] hover:bg-white/[0.1] text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4"
                >
                  {oauthLoadingProvider === "google-docs" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                  Connect via OAuth
                </button>
              )}

              {!googleDocsConnected && (
                <>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-[#18181b] px-2 text-slate-500">Or use Token</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <GlassInput
                      type="password"
                      value={googleDocsToken}
                      onChange={(e) => setGoogleDocsToken(e.target.value)}
                      placeholder="ya29..."
                      disabled={googleDocsConnected}
                    />
                    <button
                      onClick={() => onConnect("google-docs")}
                      disabled={connectMutation.isPending || !token || googleDocsConnected}
                      className="h-[42px] px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white transition-all disabled:opacity-50"
                    >
                      {connectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                    </button>
                  </div>
                </>
              )}

              {googleDocsConnected && (
                <div className="text-emerald-400 text-sm flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  Connected successfully
                </div>
              )}
            </div>
          </div>
        </IntegrationDetailsModal>

        {/* Gmail Modal */}
        <IntegrationDetailsModal
          isOpen={selectedProvider === "gmail"}
          onClose={() => setSelectedProvider(null)}
          title="Gmail Integration"
          icon={<span className="text-lg font-bold">M</span>}
        >
          <div className="space-y-6">
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
              <p className="text-sm text-slate-400 mb-4">
                Connect Gmail to let the agent read and monitor your project emails, providing context for decisions and auto-detecting action items.
              </p>
              {!gmailConnected && (
                <button
                  onClick={() => onConnectOAuth("gmail")}
                  disabled={oauthLoadingProvider !== null || !token || gmailConnected}
                  className="w-full h-10 rounded-lg border border-white/10 bg-white/[0.05] hover:bg-white/[0.1] text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {oauthLoadingProvider === "gmail" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                  Connect via Google OAuth
                </button>
              )}

              {gmailConnected && (
                <div className="text-emerald-400 text-sm flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  Connected successfully
                </div>
              )}
            </div>
          </div>
        </IntegrationDetailsModal>

        {/* Slack Modal */}
        <IntegrationDetailsModal
          isOpen={selectedProvider === "slack"}
          onClose={() => setSelectedProvider(null)}
          title="Slack Integration"
          icon={<span className="text-lg font-bold">S</span>}
        >
          <div className="space-y-6">
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
              <p className="text-sm text-slate-400 mb-4">
                Connect Slack for async standups, sprint digest delivery, and blocker escalation notifications. The bot will send DMs and collect responses automatically.
              </p>
              {!slackConnected && (
                <button
                  onClick={() => onConnectOAuth("slack")}
                  disabled={oauthLoadingProvider !== null || !token || slackConnected}
                  className="w-full h-10 rounded-lg border border-white/10 bg-white/[0.05] hover:bg-white/[0.1] text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {oauthLoadingProvider === "slack" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                  Add to Slack
                </button>
              )}

              {slackConnected && (
                <div className="text-emerald-400 text-sm flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  Connected successfully
                </div>
              )}
            </div>
          </div>
        </IntegrationDetailsModal>
      </div>
    </Cockpit>
  );
}
