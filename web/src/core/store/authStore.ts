import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  image: string | null;
  /** Authorization role of the user table (superadmin | admin | user). */
  role?: string | null;
  dynaRole: string | null;
  scope: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  email: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  /** Demo-only role override (applied over the real session for the demo user). */
  demoRole: string | null;
  demoScope: string | null;
  /** Role and scope from the server session, before any override (set on hydration, not persisted). */
  realDynaRole: string | null;
  realScope: string | null;
  /** user.role from the server session (superadmin | admin | user). */
  realRole: string | null;
}

interface AuthActions {
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setUserAndSession: (user: User | null, session: Session | null) => void;
  setEmail: (email: string | null) => void;
  clearEmail: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearAuth: () => void;
  /** Apply a demo role override; patches the current user immediately. */
  setDemoRole: (demoRole: string | null, demoScope: string | null) => void;
  /** Record the server session's own role and scope (before overrides). */
  setRealRole: (real: { dynaRole: string | null; scope: string | null; role: string | null }) => void;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  user: null,
  session: null,
  email: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  demoRole: null,
  demoScope: null,
  realDynaRole: null,
  realScope: null,
  realRole: null,
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...initialState,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          error: null,
        }),

      setSession: (session) =>
        set({ session }),

      setUserAndSession: (user, session) =>
        set({
          user,
          session,
          isAuthenticated: !!user && !!session,
          error: null,
        }),

      setEmail: (email) =>
        set({ email }),

      clearEmail: () =>
        set({ email: null }),

      setLoading: (isLoading) =>
        set({ isLoading }),

      setError: (error) =>
        set({ error, isLoading: false }),

      clearAuth: () =>
        set(initialState),

      setRealRole: ({ dynaRole, scope, role }) =>
        set({ realDynaRole: dynaRole, realScope: scope, realRole: role }),

      setDemoRole: (demoRole, demoScope) =>
        set((state) => ({
          demoRole,
          demoScope,
          user:
            state.user && demoRole
              ? { ...state.user, dynaRole: demoRole, scope: demoScope }
              : state.user,
        })),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        isAuthenticated: state.isAuthenticated,
        email: state.email,
        demoRole: state.demoRole,
        demoScope: state.demoScope,
      }),
    }
  )
);

/**
 * Whether the signed-in user handles support requests: real Dyna ADMIN, or a
 * superadmin of the user table. Same rule as the API (which is the real gate).
 */
export function isSupportAgentRole(dynaRole: string | null | undefined, role: string | null | undefined): boolean {
  return dynaRole === 'ADMIN' || role === 'superadmin';
}

/** Selector: support agent by the real session role (ignores demo and "view as"). */
export const selectIsSupportAgent = (state: AuthState): boolean =>
  isSupportAgentRole(state.realDynaRole, state.realRole);
