import { API_URL } from '@/core/config/constants';
import { useAuthStore } from '@/core/store/authStore';

export class APIError extends Error {
  status: number;
  data?: unknown;

  constructor(
    message: string,
    status: number,
    data?: unknown
  ) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Fetch an API endpoint with the session cookie. Throws APIError on non-2xx;
 * a 401 means the session is invalid → the user is treated as logged out.
 */
async function request(endpoint: string, options?: RequestInit): Promise<Response> {
  const url = `${API_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    // 401 = the session is invalid → treat the user as logged out. RouteGuard
    // then redirects to /login (the real gate is the API, not the client store).
    if (response.status === 401) {
      useAuthStore.getState().clearAuth();
    }
    const errorData = await response.json().catch(() => null);
    throw new APIError(
      errorData?.detail || `HTTP error ${response.status}`,
      response.status,
      errorData
    );
  }

  return response;
}

export async function apiClient<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await request(endpoint, options);
  return response.json();
}

/** Binary response (e.g. an image) from an authenticated endpoint. */
export async function apiBlob(endpoint: string): Promise<Blob> {
  const response = await request(endpoint);
  return response.blob();
}
