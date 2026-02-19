import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  organizationId: string;
}

interface ProjectState {
  activeOrganization: Organization | null;
  activeProject: Project | null;
  setActiveOrganization: (org: Organization | null) => void;
  setActiveProject: (project: Project | null) => void;
  clear: () => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      activeOrganization: null,
      activeProject: null,
      setActiveOrganization: (org) => set({ activeOrganization: org }),
      setActiveProject: (project) => set({ activeProject: project }),
      clear: () => set({ activeOrganization: null, activeProject: null }),
    }),
    {
      name: "agentpm-project",
    }
  )
);
