/**
 * Role-based access config (single source of truth).
 *
 * Controls which sidebar pages a user sees based on their Dyna profile role
 * (`dynaRole`). MANAGER (and empty/null role) has full access; every other
 * role sees only the paths listed here (empty for now — to be defined later).
 *
 * `dataFilter` is applied globally to data requests for channel roles.
 */
import { NAVIGATION_SECTIONS, DISTRIBUTION_MENU, type MenuSection } from './navigation';

export interface RoleAccess {
  /** Allowed route paths, or 'all' for full access. */
  paths: string[] | 'all';
  /** Channel data filter applied to all data requests for this role. */
  dataFilter?: Record<string, string>;
  /** Human-readable channel label (chip next to page titles). */
  channelLabel?: string;
}

/** Route always visible/accessible to every authenticated user. */
export const ALWAYS_VISIBLE_PATHS = ['/dashboard'];

export const DISTRIBUTION_PATHS = [
  '/distribucion/regionales',
  '/distribucion/comerciales',
  '/distribucion/clientes',
];

export const ROLE_ACCESS: Record<string, RoleAccess> = {
  MANAGER: { paths: 'all' },
  MANAGER_DISTRIBUTION: { paths: DISTRIBUTION_PATHS, dataFilter: { channel: 'DISTRIBUCION' }, channelLabel: 'Distribución' },
  MANAGER_CADENAS: { paths: [], dataFilter: { channel: 'CADENAS' }, channelLabel: 'Cadenas' },
  MANAGER_EXPORTATION: { paths: [], dataFilter: { channel: 'EXPORTACIONES' }, channelLabel: 'Exportación' },
  // dataFilter TODO: retail currently filters by IdRegional=RTL, not channel=RETAIL
  MANAGER_RETAIL: { paths: [], channelLabel: 'Retail' },
};

/**
 * Resolve the access config for a role. Empty/null/MANAGER get full access;
 * unknown roles are denied everything (safe default).
 */
export function resolveAccess(dynaRole: string | null | undefined): RoleAccess {
  if (!dynaRole || dynaRole === 'MANAGER') {
    return ROLE_ACCESS['MANAGER']!;
  }
  return ROLE_ACCESS[dynaRole] ?? { paths: [] };
}

/** Whether a role may access a given route path. */
export function canAccessPath(dynaRole: string | null | undefined, path: string): boolean {
  if (ALWAYS_VISIBLE_PATHS.includes(path)) return true;
  const access = resolveAccess(dynaRole);
  return access.paths === 'all' || access.paths.includes(path);
}

/** Channel data filter to apply to all data requests, or undefined for full access. */
export function getRoleDataFilter(dynaRole: string | null | undefined): Record<string, string> | undefined {
  return resolveAccess(dynaRole).dataFilter;
}

/** Channel label for chips next to titles, or null for MANAGER/full access. */
export function getRoleChannelLabel(dynaRole: string | null | undefined): string | null {
  return resolveAccess(dynaRole).channelLabel ?? null;
}

/**
 * Sidebar menu sections for a role. MANAGER/empty gets the full app menu;
 * the distribution role gets its own table-only menu; unknown roles get none.
 */
export function getMenuSections(dynaRole: string | null | undefined): MenuSection[] {
  if (!dynaRole || dynaRole === 'MANAGER') {
    return NAVIGATION_SECTIONS.filter((section) => section.title !== 'General');
  }
  if (dynaRole === 'MANAGER_DISTRIBUTION') {
    return DISTRIBUTION_MENU;
  }
  return [];
}
