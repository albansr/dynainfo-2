import { useEffect } from 'react';
import { useAuthStore } from '@/core/store/authStore';
import { hydrateSessionFromServer } from '@/core/api/hydrateSession';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { setLoading, clearAuth } = useAuthStore();

  // Validate the session once on mount. Store actions are stable, so this runs
  // a single time — do NOT depend on isAuthenticated (a successful login would
  // otherwise retrigger the whole session fetch).
  useEffect(() => {
    async function checkSession() {
      setLoading(true);
      try {
        // Empty response but persisted state → keep it (trust localStorage).
        await hydrateSessionFromServer();
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
  }, [setLoading, clearAuth]);

  return <>{children}</>;
}
