import { useApiMutation } from '@/core/hooks/useApiMutation';
import { useAuthStore } from '@/core/store/authStore';
import { authApi } from '@/core/api/authApi';
import { normalizeAuthResponse } from '@/core/utils/normalizeAuthResponse';
import { hydrateSessionFromServer } from '@/core/api/hydrateSession';

export function useVerifyOTP() {
  const email = useAuthStore((state) => state.email);

  const { mutate, ...mutation } = useApiMutation({
    mutationFn: (otp: string) => {
      if (!email) throw new Error('Email not found');
      return authApi.verifyOTP({ email, otp });
    },
    onSuccess: async (response) => {
      // Seed from the verify response so the guard lets us through immediately.
      const { user, session } = normalizeAuthResponse(response);
      useAuthStore.getState().setUserAndSession(user, session);
      // Clear email from store after successful login
      useAuthStore.getState().clearEmail();
      // The OTP verify response omits name/role, so hydrate the full profile
      // from the session (same source the app uses on mount). Otherwise the
      // sidebar shows the fallback until a manual reload.
      try {
        await hydrateSessionFromServer();
      } catch {
        // Transient error: keep the seeded session; the next load hydrates it.
      }
    },
    errorMessage: 'Código inválido o expirado',
  });

  return { verifyOTP: mutate, ...mutation, email };
}
