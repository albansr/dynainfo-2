import { useState } from 'react';
import { AuthApiError } from '@/core/api/authApi';

interface UseApiMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error) => void;
  errorMessage?: string;
}

export function useApiMutation<TData = unknown, TVariables = void>({
  mutationFn,
  onSuccess,
  onError,
  errorMessage = 'Ha ocurrido un error',
}: UseApiMutationOptions<TData, TVariables>) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TData | null>(null);

  const mutate = async (variables: TVariables) => {
    setIsLoading(true);
    setError(null);
    setData(null); // Clear previous data on new request

    try {
      const result = await mutationFn(variables);
      setData(result);
      onSuccess?.(result, variables);
      return result;
    } catch (err) {
      const message = err instanceof AuthApiError ? err.message : errorMessage;
      setError(message);
      setData(null); // Clear data on error
      onError?.(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { mutate, isLoading, error, data };
}
