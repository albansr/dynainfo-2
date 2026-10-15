import { useAuthStore } from '@/core/store/authStore';
import { isDemoRoleEnabled } from '@/core/config/constants';
import { useViewAsStore } from '@/core/store/viewAsStore';
import { applyRoleOverrides } from '@/core/utils/roleOverrides';
import { authApi } from '@/core/api/authApi';
import { normalizeAuthResponse } from '@/core/utils/normalizeAuthResponse';

/**
 * Pull the full session from the server and apply it to the auth store, keeping
 * the role overrides (support "view as", demo role). The OTP verify response can omit name/role,
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
  // Role overrides over the real session: the support "view as" (real ADMIN
  // only, this tab only), then the demo role except on the production domain
  // (a role picked elsewhere never leaks in).
  const { demoRole, demoScope, setRealRole, setUserAndSession } = useAuthStore.getState();
  const finalUser = applyRoleOverrides(user, {
    viewAs: useViewAsStore.getState().viewAs,
    demo: { dynaRole: demoRole, scope: demoScope },
    demoEnabled: isDemoRoleEnabled(),
  });

  setRealRole(user.dynaRole, user.scope);
  setUserAndSession(finalUser, session);
  return true;
}
