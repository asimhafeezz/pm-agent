import { Cockpit } from "@/components/layout/cockpit";
import { useAuth } from "@/components/auth/auth-provider";
import { useProjectStore } from "@/store/project-store";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchIntegrationStatuses } from "@/api/integrations.api";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  FileText,
  Link2,
  Map,
  Ticket,
} from "lucide-react";
import { Link } from "react-router-dom";

type SetupItem = {
  label: string;
  done: boolean;
  href: string;
};

type Organization = {
  id: string;
  name: string;
  slug: string;
};

type Project = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  organizationId: string;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function HomePage() {
  const { user, token } = useAuth();
  const activeProject = useProjectStore((s) => s.activeProject);
  const activeOrganization = useProjectStore((s) => s.activeOrganization);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const setActiveOrganization = useProjectStore((s) => s.setActiveOrganization);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [newOrgName, setNewOrgName] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);

  const integrationsQuery = useQuery({
    queryKey: ["integrations", "statuses"],
    queryFn: () => fetchIntegrationStatuses(token!),
    enabled: !!token,
  });

  const statuses = integrationsQuery.data ?? [];
  const connected = statuses.filter((item) => item.connected).length;
  const linearConnected = statuses.some((s) => s.provider === "linear" && s.connected);
  const docSourceConnected = statuses.some(
    (s) => (s.provider === "notion" || s.provider === "google-docs") && s.connected,
  );

  const requestApi = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const response = await fetch(path, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(init?.headers || {}),
        },
      });
      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok) {
        const raw = payload?.message || payload?.error || "Request failed";
        const message = Array.isArray(raw) ? raw.join(", ") : String(raw);
        throw new Error(message);
      }
      if (
        payload &&
        typeof payload === "object" &&
        "data" in payload &&
        (payload as { data?: T }).data !== undefined
      ) {
        return (payload as { data: T }).data;
      }
      return payload as T;
    },
    [token],
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const run = async () => {
      setWorkspaceError(null);
      setWorkspaceLoading(true);
      try {
        const orgs = await requestApi<Organization[]>("/api/organizations");
        if (cancelled) return;
        setOrganizations(orgs);
        setSelectedOrgId((current) => current || activeOrganization?.id || orgs[0]?.id || "");
      } catch (error) {
        if (!cancelled) {
          setWorkspaceError(error instanceof Error ? error.message : "Failed to load organizations");
        }
      } finally {
        if (!cancelled) setWorkspaceLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [activeOrganization?.id, requestApi, token]);

  useEffect(() => {
    const selectedOrg = organizations.find((item) => item.id === selectedOrgId) || null;
    if (!selectedOrg) return;
    if (activeOrganization?.id !== selectedOrg.id) {
      setActiveOrganization(selectedOrg);
    }
  }, [activeOrganization?.id, organizations, selectedOrgId, setActiveOrganization]);

  useEffect(() => {
    if (!token || !selectedOrgId) {
      setProjects([]);
      return;
    }
    let cancelled = false;

    const run = async () => {
      setWorkspaceError(null);
      setWorkspaceLoading(true);
      try {
        const orgProjects = await requestApi<Project[]>(`/api/organizations/${selectedOrgId}/projects`);
        if (!cancelled) setProjects(orgProjects);
      } catch (error) {
        if (!cancelled) {
          setWorkspaceError(error instanceof Error ? error.message : "Failed to load projects");
        }
      } finally {
        if (!cancelled) setWorkspaceLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [requestApi, selectedOrgId, token]);

  useEffect(() => {
    if (!selectedOrgId) {
      if (activeProject) setActiveProject(null);
      return;
    }

    if (activeProject?.organizationId !== selectedOrgId) {
      if (projects[0]) {
        setActiveProject(projects[0]);
      } else if (activeProject) {
        setActiveProject(null);
      }
      return;
    }

    if (activeProject) {
      const stillExists = projects.some((item) => item.id === activeProject.id);
      if (!stillExists) {
        setActiveProject(projects[0] || null);
      }
      return;
    }

    if (!activeProject && projects[0]) {
      setActiveProject(projects[0]);
    }
  }, [activeProject, projects, selectedOrgId, setActiveProject]);

  const createOrganization = useCallback(async () => {
    if (!newOrgName.trim() || !token) return;
    setWorkspaceError(null);
    setCreatingOrg(true);
    try {
      const org = await requestApi<Organization>("/api/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: newOrgName.trim(),
          slug: slugify(newOrgName),
        }),
      });
      setOrganizations((prev) => [org, ...prev]);
      setSelectedOrgId(org.id);
      setActiveOrganization(org);
      setActiveProject(null);
      setProjects([]);
      setNewOrgName("");
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Failed to create organization");
    } finally {
      setCreatingOrg(false);
    }
  }, [newOrgName, requestApi, setActiveOrganization, setActiveProject, token]);

  const createProject = useCallback(async () => {
    if (!selectedOrgId || !newProjectName.trim() || !token) return;
    setWorkspaceError(null);
    setCreatingProject(true);
    try {
      const project = await requestApi<Project>(`/api/organizations/${selectedOrgId}/projects`, {
        method: "POST",
        body: JSON.stringify({
          name: newProjectName.trim(),
          slug: slugify(newProjectName),
        }),
      });
      setProjects((prev) => [project, ...prev]);
      setActiveProject(project);
      setNewProjectName("");
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Failed to create project");
    } finally {
      setCreatingProject(false);
    }
  }, [newProjectName, requestApi, selectedOrgId, setActiveProject, token]);

  const workspaceReady = Boolean(activeOrganization && activeProject);

  const sortedOrganizations = useMemo(
    () => [...organizations].sort((a, b) => a.name.localeCompare(b.name)),
    [organizations],
  );
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects],
  );

  const setupItems: SetupItem[] = [
    {
      label: "Connect Linear",
      done: linearConnected,
      href: "/integrations",
    },
    {
      label: "Connect Notion or Google Docs",
      done: docSourceConnected,
      href: "/integrations",
    },
    {
      label: "Import product documents",
      done: workspaceReady,
      href: "/documents",
    },
    {
      label: "Generate roadmap and push tickets",
      done: workspaceReady,
      href: "/roadmap",
    },
  ];

  return (
    <Cockpit>
      <div className="flex h-full flex-col gap-5 overflow-y-auto p-6">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-transparent p-6">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">AgentPM</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            {`Welcome ${user?.firstName || "there"}`}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Use this workspace to move from product docs to roadmap to execution with connected
            tools.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Link
              to="/integrations"
              className="rounded-xl border border-white/10 bg-black/20 p-4 hover:bg-white/[0.06] transition-colors"
            >
              <div className="flex items-center gap-2 text-slate-200">
                <Link2 className="h-4 w-4" />
                Integrations
              </div>
              <p className="mt-2 text-xs text-slate-400">{connected}/3 connected</p>
            </Link>

            <Link
              to="/documents"
              className="rounded-xl border border-white/10 bg-black/20 p-4 hover:bg-white/[0.06] transition-colors"
            >
              <div className="flex items-center gap-2 text-slate-200">
                <FileText className="h-4 w-4" />
                Documents
              </div>
              <p className="mt-2 text-xs text-slate-400">Import Notion, Google Docs, or upload</p>
            </Link>

            <Link
              to="/roadmap"
              className="rounded-xl border border-white/10 bg-black/20 p-4 hover:bg-white/[0.06] transition-colors"
            >
              <div className="flex items-center gap-2 text-slate-200">
                <Map className="h-4 w-4" />
                Roadmap
              </div>
              <p className="mt-2 text-xs text-slate-400">Generate prioritized plan with AI</p>
            </Link>

            <Link
              to="/tickets"
              className="rounded-xl border border-white/10 bg-black/20 p-4 hover:bg-white/[0.06] transition-colors"
            >
              <div className="flex items-center gap-2 text-slate-200">
                <Ticket className="h-4 w-4" />
                Tickets
              </div>
              <p className="mt-2 text-xs text-slate-400">Monitor sync loop and sprint status</p>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-sm font-semibold text-white">Setup Checklist</h2>
            <div className="mt-4 space-y-2">
              {setupItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 hover:bg-white/[0.06] transition-colors"
                >
                  <span className="inline-flex items-center gap-2 text-sm text-slate-200">
                    {item.done ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <CircleDashed className="h-4 w-4 text-slate-500" />
                    )}
                    {item.label}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-500" />
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-sm font-semibold text-white">Current Workspace</h2>
            <div className="mt-4 space-y-3 text-sm">
              {workspaceError ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {workspaceError}
                </div>
              ) : null}

              <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                <p className="text-xs text-slate-500">Organization</p>
                <p className="mt-1 text-slate-200">
                  {activeOrganization?.name || "No organization selected"}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                <p className="text-xs text-slate-500">Project</p>
                <p className="mt-1 text-slate-200">
                  {activeProject?.name || "No active project selected"}
                </p>
              </div>

              {workspaceLoading ? (
                <p className="text-xs text-slate-400">Loading workspace options...</p>
              ) : null}

              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <p className="text-xs text-slate-500">Select organization</p>
                <select
                  value={selectedOrgId}
                  onChange={(event) => {
                    const nextOrgId = event.target.value;
                    setSelectedOrgId(nextOrgId);
                    const nextOrg = organizations.find((item) => item.id === nextOrgId) || null;
                    setActiveOrganization(nextOrg);
                    setActiveProject(null);
                  }}
                  className="mt-2 h-9 w-full rounded-md border border-white/10 bg-[#121216] px-2 text-sm text-slate-200"
                >
                  <option value="">Select organization</option>
                  {sortedOrganizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
                <div className="mt-2 flex gap-2">
                  <input
                    value={newOrgName}
                    onChange={(event) => setNewOrgName(event.target.value)}
                    placeholder="New organization name"
                    className="h-9 flex-1 rounded-md border border-white/10 bg-[#121216] px-2 text-sm text-slate-200 placeholder:text-slate-500"
                  />
                  <button
                    onClick={createOrganization}
                    disabled={creatingOrg || !newOrgName.trim()}
                    className="h-9 rounded-md border border-white/10 px-3 text-xs text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creatingOrg ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <p className="text-xs text-slate-500">Select project</p>
                <select
                  value={activeProject?.id || ""}
                  onChange={(event) => {
                    const nextProject = projects.find((item) => item.id === event.target.value) || null;
                    setActiveProject(nextProject);
                  }}
                  className="mt-2 h-9 w-full rounded-md border border-white/10 bg-[#121216] px-2 text-sm text-slate-200"
                  disabled={!selectedOrgId}
                >
                  <option value="">Select project</option>
                  {sortedProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <div className="mt-2 flex gap-2">
                  <input
                    value={newProjectName}
                    onChange={(event) => setNewProjectName(event.target.value)}
                    placeholder="New project name"
                    className="h-9 flex-1 rounded-md border border-white/10 bg-[#121216] px-2 text-sm text-slate-200 placeholder:text-slate-500"
                    disabled={!selectedOrgId}
                  />
                  <button
                    onClick={createProject}
                    disabled={creatingProject || !selectedOrgId || !newProjectName.trim()}
                    className="h-9 rounded-md border border-white/10 px-3 text-xs text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creatingProject ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>

              {!workspaceReady ? (
                <p className="text-xs text-yellow-200">
                  Create/select an organization and project here, then proceed to Documents.
                </p>
              ) : (
                <p className="text-xs text-emerald-300">
                  Workspace is ready. Next: import docs, extract knowledge, generate roadmap.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Cockpit>
  );
}
