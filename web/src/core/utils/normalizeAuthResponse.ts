import type { GetSessionResponse, VerifyOTPResponse } from '@/core/api/authApi';
import type { User, Session } from '@/core/store/authStore';

export function normalizeAuthResponse(
  response: GetSessionResponse | VerifyOTPResponse,
): { user: User; session: Session } {
  return {
    user: {
      ...response.user,
      createdAt: new Date(response.user.createdAt),
      updatedAt: new Date(response.user.updatedAt),
    },
    session: {
      ...response.session,
      expiresAt: new Date(response.session.expiresAt),
    },
  };
}
