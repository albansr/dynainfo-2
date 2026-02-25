import { useApiMutation } from '@/core/hooks/useApiMutation';
import { useAuthStore } from '@/core/store/authStore';
import { authApi } from '@/core/api/authApi';

export function useSendOTP() {
  const setEmail = useAuthStore((state) => state.setEmail);

  const { mutate: sendOTP, ...mutation } = useApiMutation({
    mutationFn: (email: string) => authApi.sendOTP({ email, type: 'sign-in' }),
    onSuccess: (_, email) => setEmail(email),
    errorMessage: 'Error al enviar el código de verificación',
  });

  return { sendOTP, ...mutation, success: !!mutation.data };
}
