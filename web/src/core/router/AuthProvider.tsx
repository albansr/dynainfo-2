import { useEffect } from 'react';
import { useAuthStore } from '@/core/store/authStore';
import { authApi } from '@/core/api/authApi';
import { normalizeAuthResponse } from '@/core/utils/normalizeAuthResponse';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { setUserAndSession, setLoading, clearAuth, isAuthenticated } = useAuthStore();

  useEffect(() => {
    async function checkSession() {
      setLoading(true);
      try {
        const response = await authApi.getSession();
        // Check if response has the expected structure
        if (response && response.user && response.session) {
          const { user, session } = normalizeAuthResponse(response);
          setUserAndSession(user, session);
        }
        // If response is empty but we have persisted state, keep it
        // The server will return empty if no active session, but we trust localStorage
      } catch (error: any) {
        // Only clear auth if session is explicitly invalid (401/403)
        // This means the server confirmed the session is bad
        if (error?.status === 401 || error?.status === 403) {
          clearAuth();
        }
        // For network errors or other issues, keep the persisted session
        // The user might be offline or there might be a temporary issue
      } finally {
        setLoading(false);
      }
    }

    checkSession();
  }, [setUserAndSession, setLoading, clearAuth, isAuthenticated]);

  return <>{children}</>;
}
