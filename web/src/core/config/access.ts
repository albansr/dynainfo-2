/**
 * Role-based access config (single source of truth).
 *
 * Access is driven by two fields synced from the Dyna SSO JWT:
 * - `dynaRole`: the access profile (this file's catalog).
 * - `scope`: a per-user scope, interpreted against `dynaRole`
 *   (regional group "1"|"2"|"3" for DISTRIBUTION, a seller_id for SELLER).
 *
 * Each role controls: which data it queries (`dataFilter` + `scope`), which
 * temporality presets and years it may pick (`allowedPresets`/`allowedYears`)
 * and whether it can export Excel (`allowExport`). Which views/pages a role
 * sees is resolved separately via `getRoleViewSections`/`resolveActiveView`.
 */
import { NAVIGATION_SECTIONS, type MenuSection } from './navigation';
import type { DateRangePreset } from './dateRangeConfig';
import {
  ANALYSIS_VIEW_SECTIONS,
  NEW_CHANNELS_VIEW_SECTIONS,
  ANALYSIS_VIEWS,
  type AnalysisViewSection,
  type AnalysisView,
} from './analysisViews';

export interface RoleAccess {
  /** Data filter applied to all data requests for this role. Values may be
   *  multi-valued (string[]) to express an IN filter (e.g. several channels). */
  dataFilter?: Record<string, string | string[]>;
  /** Selectable temporality presets, or 'all' for every preset + custom range. */
  allowedPresets?: DateRangePreset[] | 'all';
  /** Selectable years (closed complete years), or 'all'. */
  allowedYears?: number[] | 'all';
  /** Whether the role may export listings to Excel. Defaults to true. */
  allowExport?: boolean;
}

/** The four core temporality presets granted to most roles. */
const CORE_PRESETS: DateRangePreset[] = ['previous-month', 'current-month', 'accumulated', 'today'];

/** The year immediately before the current one (the only year SELLER may pick). */
const PREVIOUS_YEAR = new Date().getFullYear() - 1;

/**
 * Regional groups for the DISTRIBUTION role, keyed by `scope`. A DISTRIBUTION
 * user without a matching scope sees the whole distribution channel unfiltered.
 */
export const REGIONAL_GROUPS: Record<string, string[]> = {
  '1': ['0001', '0026'],
  '2': ['0002', '0004', '0019', '0018'],
  '3': ['0003', '0033'],
};

export const ROLE_ACCESS: Record<string, RoleAccess> = {
  // Gerencia General — full, unrestricted access (the super role).
  ADMIN: { allowedPresets: 'all', allowedYears: 'all', allowExport: true },
  // Gerencias — global read, standard temporality/years.
  MANAGER: { allowedPresets: CORE_PRESETS, allowedYears: 'all', allowExport: true },
  // Junta General — executive view, only prior-month and accumulated.
  BOARD: { allowedPresets: ['previous-month', 'accumulated'], allowedYears: 'all', allowExport: true },
  // Dirección Retail — Dynamica Retail.
  // dataFilter TODO: retail currently filters by IdRegional=RTL, not channel=RETAIL
  RETAIL: { allowedPresets: CORE_PRESETS, allowedYears: 'all', allowExport: true },
  // Dirección Nuevos Canales — Exportaciones + Cadenas. No role dataFilter: each
  // view carries its own channel filter (Todos = both, Exportaciones, Cadenas),
  // so a role-level channel filter would override the per-view narrowing.
  NEW_CHANNELS: { allowedPresets: CORE_PRESETS, allowedYears: 'all', allowExport: true },
  // Directores regionales — distribution scoped by regional group (scope).
  DISTRIBUTION: { dataFilter: { channel: 'DISTRIBUCION' }, allowedPresets: CORE_PRESETS, allowedYears: 'all', allowExport: true },
  // Vendedores — own zone (seller_id via scope), current year only, no export.
  SELLER: { allowedPresets: CORE_PRESETS, allowedYears: [PREVIOUS_YEAR], allowExport: false },
};

/**
 * Resolve the access config for a role. Empty/null/MANAGER get the standard
 * management access; unknown roles get an empty config (no data, safe default).
 */
export function resolveAccess(dynaRole: string | null | undefined): RoleAccess {
  if (!dynaRole || dynaRole === 'MANAGER') {
    return ROLE_ACCESS['MANAGER']!;
  }
  return ROLE_ACCESS[dynaRole] ?? {};
}

/**
 * Data filter to apply to all data requests, or undefined for full access.
 * Combines the role's static filter with the per-user `scope`.
 */
export function getRoleDataFilter(
  dynaRole: string | null | undefined,
  scope?: string | null,
): Record<string, string | string[]> | undefined {
  const access = resolveAccess(dynaRole);
  const base = access.dataFilter ? { ...access.dataFilter } : {};

  if (dynaRole === 'DISTRIBUTION' && scope && REGIONAL_GROUPS[scope]) {
    return { ...base, IdRegional: REGIONAL_GROUPS[scope] };
  }
  if (dynaRole === 'SELLER' && scope) {
    return { ...base, seller_id: scope };
  }
  return access.dataFilter ? base : undefined;
}

/** Selectable temporality presets for a role ('all' = every preset + custom). */
export function getAllowedPresets(dynaRole: string | null | undefined): DateRangePreset[] | 'all' {
  return resolveAccess(dynaRole).allowedPresets ?? 'all';
}

/** Selectable years for a role ('all' = every available closed year). */
export function getAllowedYears(dynaRole: string | null | undefined): number[] | 'all' {
  return resolveAccess(dynaRole).allowedYears ?? 'all';
}

/** Whether a role may export listings to Excel. */
export function canExport(dynaRole: string | null | undefined): boolean {
  return resolveAccess(dynaRole).allowExport ?? true;
}

/**
 * Sidebar menu sections for a role. Full-access roles get the whole app menu;
 * distribution roles get the table-only distribution menu; channel roles get
 * the app menu filtered to their allowed paths; unknown roles get none.
 */
export function getMenuSections(_dynaRole: string | null | undefined): MenuSection[] {
  // Same sidebar for every role for now (Análisis is rendered separately as the
  // dashboard item; here we only add Festival Virtual). Per-role differences TBD.
  return NAVIGATION_SECTIONS;
}

/**
 * View selector sections for a role. Only ADMIN, MANAGER and NEW_CHANNELS get a
 * selector; every other role sees a single role-managed default table (no
 * selector).
 */
export function getRoleViewSections(dynaRole: string | null | undefined): AnalysisViewSection[] {
  if (dynaRole === 'NEW_CHANNELS') return NEW_CHANNELS_VIEW_SECTIONS;
  if (!dynaRole || dynaRole === 'ADMIN' || dynaRole === 'MANAGER') return ANALYSIS_VIEW_SECTIONS;
  return [];
}

/**
 * Default table view id per role — the one listed first in /dashboard.
 * For selector roles it is the pre-selected view; for the rest it is the only
 * table shown. (BOARD/SELLER defaults are provisional, pending final rules.)
 */
const ROLE_DEFAULT_VIEW: Record<string, string> = {
  ADMIN: 'general',
  MANAGER: 'general',
  NEW_CHANNELS: 'todos-nuevos-canales',
  BOARD: 'general',
  RETAIL: 'retail',
  DISTRIBUTION: 'distribucion',
  SELLER: 'seller-default',
};

export function getDefaultViewId(dynaRole: string | null | undefined): string {
  return ROLE_DEFAULT_VIEW[dynaRole ?? 'MANAGER'] ?? 'general';
}

/**
 * Resolve the active view for /dashboard from the role and the requested `?v=`.
 * Unifies both change points: the view selector (ADMIN/MANAGER/NEW_CHANNELS) and
 * the per-role default — everything resolves to a single active view.
 */
export function resolveActiveView(
  dynaRole: string | null | undefined,
  requestedId: string | null,
): { view: AnalysisView; hasSelector: boolean } {
  const sections = getRoleViewSections(dynaRole);
  const allowed = sections.flatMap((s) => s.views);
  const hasSelector = allowed.length > 0;
  const byId = (id: string) => ANALYSIS_VIEWS.find((v) => v.id === id);
  const fallback = byId(getDefaultViewId(dynaRole)) ?? ANALYSIS_VIEWS[0]!;
  if (hasSelector) {
    const view = (requestedId && allowed.find((v) => v.id === requestedId)) || fallback;
    return { view, hasSelector };
  }
  return { view: fallback, hasSelector: false };
}
