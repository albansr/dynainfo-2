import { useAuthStore } from '@/core/store/authStore';
import { getRoleDataFilter } from '@/core/config/access';
import type { FilterMap } from '@/core/api/downloadExcel';

/**
 * Merge the caller's filters with the role's data filter (channel/scope),
 * resolved from the current session. The role filter wins on key collisions so
 * a role's scoping can't be widened by page filters. Single source of truth for
 * role-aware filtering across every data hook.
 */
export function useMergedFilters(filters?: FilterMap): FilterMap | undefined {
  const dynaRole = useAuthStore((s) => s.user?.dynaRole);
  const scope = useAuthStore((s) => s.user?.scope);
  const roleFilter = getRoleDataFilter(dynaRole, scope);
  return roleFilter ? { ...filters, ...roleFilter } : filters;
}
