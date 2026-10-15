/** A role and scope applied over the signed-in user's own. */
export interface RoleOverride {
  dynaRole: string | null;
  scope: string | null;
}

interface RoleOverrides {
  /** Support "view as": honored only when the real role is ADMIN. */
  viewAs: RoleOverride | null;
  /** Demo role switcher: honored only where the demo is enabled (not production). */
  demo: RoleOverride | null;
  demoEnabled: boolean;
}

/**
 * The user the UI should act as: the real session user with, in order of
 * precedence, the support "view as" override (real ADMIN only), then the demo
 * override (outside production), else unchanged. UX only: the API always checks
 * the real role from the session.
 */
export function applyRoleOverrides<T extends RoleOverride>(realUser: T, { viewAs, demo, demoEnabled }: RoleOverrides): T {
  if (viewAs && realUser.dynaRole === 'ADMIN') return { ...realUser, dynaRole: viewAs.dynaRole, scope: viewAs.scope };
  if (demo?.dynaRole && demoEnabled) return { ...realUser, dynaRole: demo.dynaRole, scope: demo.scope };
  return realUser;
}
