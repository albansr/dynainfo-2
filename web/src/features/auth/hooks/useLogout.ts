import { useNavigate } from 'react-router-dom';
import { useApiMutation } from '@/core/hooks/useApiMutation';
import { useAuthStore } from '@/core/store/authStore';
import { authApi } from '@/core/api/authApi';

export function useLogout() {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const { mutate: logout, isLoading } = useApiMutation({
    mutationFn: () => authApi.signOut(),
    onSuccess: () => {
      clearAuth();
      navigate('/login', { replace: true });
    },
    onError: () => {
      clearAuth();
      navigate('/login', { replace: true });
    },
  });

  return { logout, isLoading };
}
