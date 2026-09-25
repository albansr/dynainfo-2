import { useAuthStore } from '@/core/store/authStore';
import { authApi } from '@/core/api/authApi';
import { normalizeAuthResponse } from '@/core/utils/normalizeAuthResponse';
import { DEMO_ROLE_EMAIL } from '@/core/config/constants';

/**
 * Pull the full session from the server and apply it to the auth store, keeping
 * the persisted demo-role override. The OTP verify response can omit name/role,
 * so both app mount and a fresh login hydrate the complete profile through here.
 *
 * Returns true when a valid session was applied (false on an empty session, so
 * the caller can keep any persisted state). Throws on network/HTTP errors so the
 * caller can decide whether to clear or keep the persisted session.
 */
export async function hydrateSessionFromServer(): Promise<boolean> {
  const response = await authApi.getSession();
  if (!response?.user || !response.session) return false;

  const { user, session } = normalizeAuthResponse(response);
  // Demo role override: apply the persisted override over the real session.
  const { demoRole, demoScope } = useAuthStore.getState();
  const finalUser =
    demoRole && user.email === DEMO_ROLE_EMAIL
      ? { ...user, dynaRole: demoRole, scope: demoScope }
      : user;

  useAuthStore.getState().setUserAndSession(finalUser, session);
  return true;
}
