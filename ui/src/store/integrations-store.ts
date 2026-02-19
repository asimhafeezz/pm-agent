import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LinearIntegrationConfig {
  teamId: string;
  projectId: string;
  assigneeId: string;
}

interface IntegrationsState {
  linear: LinearIntegrationConfig;
  setLinear: (updates: Partial<LinearIntegrationConfig>) => void;
  resetLinear: () => void;
}

const EMPTY_LINEAR_CONFIG: LinearIntegrationConfig = {
  teamId: "",
  projectId: "",
  assigneeId: "",
};

export const useIntegrationsStore = create<IntegrationsState>()(
  persist(
    (set) => ({
      linear: EMPTY_LINEAR_CONFIG,
      setLinear: (updates) =>
        set((state) => ({
          linear: { ...state.linear, ...updates },
        })),
      resetLinear: () => set({ linear: EMPTY_LINEAR_CONFIG }),
    }),
    {
      name: "agentpm-integrations",
    }
  )
);

