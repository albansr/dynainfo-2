import { PRESET_LABELS, type DateRangePreset } from '@/core/config/dateRangeConfig';
import { formatDateRangeLabel } from '@/core/utils/formatDateRangeLabel';
import type { SupportContext } from '../hooks/useSupport';

const clip = (text: string, max: number) => text.slice(0, max);

interface CaptureInput {
  location: { pathname: string; search: string };
  dateRange: { startDate: Date; endDate: Date; preset: DateRangePreset | 'custom' };
  user: { dynaRole: string | null; scope: string | null } | null;
  pageTitle: string;
  userAgent: string;
  viewport: { width: number; height: number };
}

/**
 * Snapshot of what the user is looking at, sent with a support request: page,
 * filters (query string), date range, the role/scope the UI is using, browser
 * and screen size. Trimmed to the API limits. The real role is set by the API.
 */
export function captureContext({ location, dateRange, user, pageTitle, userAgent, viewport }: CaptureInput): SupportContext {
  return {
    path: clip(location.pathname, 300),
    search: clip(location.search, 2000),
    pageTitle: clip(pageTitle, 200),
    dateRange: {
      start: dateRange.startDate.toISOString(),
      end: dateRange.endDate.toISOString(),
      preset: dateRange.preset,
    },
    dynaRole: user?.dynaRole ?? null,
    scope: user?.scope ?? null,
    userAgent: clip(userAgent, 500),
    viewport: { width: Math.round(viewport.width), height: Math.round(viewport.height) },
  };
}

/** How to restore a stored date range: a preset (recomputed today) or the exact custom dates. */
export type DateRangeRestore =
  | { kind: 'preset'; preset: DateRangePreset }
  | { kind: 'custom'; start: Date; end: Date };

export function dateRangeRestore(dateRange: SupportContext['dateRange'] | undefined): DateRangeRestore | null {
  if (!dateRange) return null;
  const { preset, start, end } = dateRange;
  if (preset === null || preset === 'custom') {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
    return { kind: 'custom', start: startDate, end: endDate };
  }
  return { kind: 'preset', preset: preset as DateRangePreset };
}

/** The page URL a context points to (path + query string). */
export function contextUrl(context: Partial<SupportContext>): string {
  return `${context.path ?? '/dashboard'}${context.search ?? ''}`;
}

/** The context's query string as "key: value" pairs for display. */
export function contextFilters(search: string | undefined): { key: string; value: string }[] {
  return Array.from(new URLSearchParams(search ?? '').entries()).map(([key, value]) => ({ key, value }));
}

/** "Acumulado · 01/01/2026 - 14/10/2026" (a year preset reads "Año 2025"). */
export function dateRangeText(dateRange: SupportContext['dateRange']): string {
  const { preset, start, end } = dateRange;
  const range = formatDateRangeLabel(new Date(start), new Date(end));
  if (preset === null) return range;
  const label = typeof preset === 'number' ? `Año ${preset}` : (PRESET_LABELS[preset] ?? preset);
  return `${label} · ${range}`;
}
