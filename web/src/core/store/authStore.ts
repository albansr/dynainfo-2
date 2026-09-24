import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  image: string | null;
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
