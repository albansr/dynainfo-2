import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useAuthStore, selectIsSupportAgent } from '@/core/store/authStore';
import { isDemoRoleEnabled } from '@/core/config/constants';
import { applyRoleOverrides, type RoleOverride } from '@/core/utils/roleOverrides';

/** A support agent viewing the app as a requester's role, from one of their requests. */
export interface ViewAs extends RoleOverride {
  ticketNumber: number;
}

interface ViewAsStore {
  viewAs: ViewAs | null;
  /** Start viewing as a role (support agents only; ignored otherwise). */
  start: (viewAs: ViewAs) => void;
  /** Stop and go back to the real (or demo) role. */
  stop: () => void;
}

/**
 * Re-apply the role overrides over the real session role in the auth store.
 * The real role comes from the last server hydration (`realDynaRole`).
 */
export function reapplyRoleOverrides(viewAs: ViewAs | null): void {
  const auth = useAuthStore.getState();
  if (!auth.user) return;
  const realUser = { ...auth.user, dynaRole: auth.realDynaRole, scope: auth.realScope };
  const user = applyRoleOverrides(realUser, {
    viewAs,
    canViewAs: selectIsSupportAgent(auth),
    demo: { dynaRole: auth.demoRole, scope: auth.demoScope },
    demoEnabled: isDemoRoleEnabled(),
  });
  auth.setUser(user);
}

/**
 * Support "view as" mode. Kept in sessionStorage: it lasts only for this browser
 * tab and never survives closing it.
 */
export const useViewAsStore = create<ViewAsStore>()(
  persist(
    (set) => ({
      viewAs: null,
      start: (viewAs) => {
        if (!selectIsSupportAgent(useAuthStore.getState())) return;
        set({ viewAs });
        reapplyRoleOverrides(viewAs);
      },
      stop: () => {
        set({ viewAs: null });
        reapplyRoleOverrides(null);
      },
    }),
    {
      name: 'support-view-as',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ viewAs: state.viewAs }),
    },
  ),
);
