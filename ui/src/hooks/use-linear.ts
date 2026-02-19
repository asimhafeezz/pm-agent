import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import {
  fetchLinearProjects,
  fetchLinearTeams,
  fetchLinearUsers,
  fetchLinearViewer,
  type LinearProject,
  type LinearTeam,
  type LinearUser,
  type LinearViewer,
} from "@/api/linear.api";

export function useLinearViewer(enabled = true) {
  const { token } = useAuth();
  return useQuery<LinearViewer | null>({
    queryKey: ["linear", "viewer"],
    queryFn: () => fetchLinearViewer(token!),
    enabled: enabled && !!token,
    retry: false,
  });
}

export function useLinearTeams(enabled = true) {
  const { token } = useAuth();
  return useQuery<LinearTeam[]>({
    queryKey: ["linear", "teams"],
    queryFn: () => fetchLinearTeams(token!, 100),
    enabled: enabled && !!token,
  });
}

export function useLinearProjects(teamId?: string, enabled = true) {
  const { token } = useAuth();
  return useQuery<LinearProject[]>({
    queryKey: ["linear", "projects", teamId || "all"],
    queryFn: () => fetchLinearProjects({ token: token!, teamId, first: 100 }),
    enabled: enabled && !!token,
  });
}

export function useLinearUsers(query?: string, enabled = true) {
  const { token } = useAuth();
  return useQuery<LinearUser[]>({
    queryKey: ["linear", "users", query || ""],
    queryFn: () => fetchLinearUsers({ token: token!, query, first: 100 }),
    enabled: enabled && !!token,
  });
}
