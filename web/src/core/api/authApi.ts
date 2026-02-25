import { API_URL } from '@/core/config/constants';
import type {
  SendOTPRequest,
  SendOTPResponse,
  VerifyOTPRequest,
  VerifyOTPResponse,
  GetSessionResponse,
  ApiError,
} from './types';

class AuthApiError extends Error {
  status?: number;
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'AuthApiError';
    this.status = statusCode;
    this.statusCode = statusCode;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      message: 'Error de conexión con el servidor',
    }));
    throw new AuthApiError(error.message, response.status);
  }

  return response.json();
}

export const authApi = {
  async sendOTP(data: SendOTPRequest): Promise<SendOTPResponse> {
    const response = await fetch(`${API_URL}/api/auth/email-otp/send-verification-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    return handleResponse<SendOTPResponse>(response);
  },

  async verifyOTP(data: VerifyOTPRequest): Promise<VerifyOTPResponse> {
    const response = await fetch(`${API_URL}/api/auth/sign-in/email-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      credentials: 'include', // Important for cookies
    });

    return handleResponse<VerifyOTPResponse>(response);
  },

  async getSession(): Promise<GetSessionResponse> {
    const response = await fetch(`${API_URL}/api/auth/get-session`, {
      method: 'GET',
      credentials: 'include', // Important for cookies
    });

    return handleResponse<GetSessionResponse>(response);
  },

  async signOut(): Promise<void> {
    const response = await fetch(`${API_URL}/api/auth/sign-out`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new AuthApiError('Failed to sign out', response.status);
    }
  },
};

export { AuthApiError };

// Re-export types for convenience
export type {
  SendOTPRequest,
  SendOTPResponse,
  VerifyOTPRequest,
  VerifyOTPResponse,
  GetSessionResponse,
  ApiError,
} from './types';
