import { useApiMutation } from '@/core/hooks/useApiMutation';
import { useAuthStore } from '@/core/store/authStore';
import { authApi } from '@/core/api/authApi';
import { normalizeAuthResponse } from '@/core/utils/normalizeAuthResponse';

export function useVerifyOTP() {
  const email = useAuthStore((state) => state.email);

  const { mutate, ...mutation } = useApiMutation({
    mutationFn: (otp: string) => {
      if (!email) throw new Error('Email not found');
      return authApi.verifyOTP({ email, otp });
    },
    onSuccess: (response) => {
      const { user, session } = normalizeAuthResponse(response);
      useAuthStore.getState().setUserAndSession(user, session);
      // Clear email from store after successful login
      useAuthStore.getState().clearEmail();
    },
    errorMessage: 'Código inválido o expirado',
  });

  return { verifyOTP: mutate, ...mutation, email };
}
