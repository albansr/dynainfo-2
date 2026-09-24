import { useEffect } from 'react';
import { useAuthStore } from '@/core/store/authStore';
import { authApi } from '@/core/api/authApi';
import { normalizeAuthResponse } from '@/core/utils/normalizeAuthResponse';
import { DEMO_ROLE_EMAIL } from '@/core/config/constants';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { setUserAndSession, setLoading, clearAuth } = useAuthStore();

  // Validate the session once on mount. Store actions are stable, so this runs
  // a single time — do NOT depend on isAuthenticated (a successful login would
  // otherwise retrigger the whole session fetch).
  useEffect(() => {
    async function checkSession() {
      setLoading(true);
      try {
        const response = await authApi.getSession();
        if (response && response.user && response.session) {
          const { user, session } = normalizeAuthResponse(response);
          // Demo role override: apply the persisted override over the real session.
          const { demoRole, demoScope } = useAuthStore.getState();
          const finalUser =
            demoRole && user.email === DEMO_ROLE_EMAIL
              ? { ...user, dynaRole: demoRole, scope: demoScope }
              : user;
          setUserAndSession(finalUser, session);
        }
        // Empty response but persisted state → keep it (trust localStorage).
      } catch (error: unknown) {
        // Only clear auth if the server confirmed the session is invalid.
        const status = (error as { status?: number } | null)?.status;
        if (status === 401 || status === 403) {
          clearAuth();
        }
        // Network/other errors: keep the persisted session (offline/transient).
      } finally {
        setLoading(false);
      }
    }

    checkSession();
  }, [setUserAndSession, setLoading, clearAuth]);

  return <>{children}</>;
}
