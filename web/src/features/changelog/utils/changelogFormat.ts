import type { ChangelogCategory } from '../hooks/useChangelog';

export interface TextSegment {
  text: string;
  bold: boolean;
}

/** Split one level of `**bold**` markup into plain/bold segments (no HTML involved). */
export function splitBold(text: string): TextSegment[] {
  return text
    .split('**')
    .map((part, i) => ({ text: part, bold: i % 2 === 1 }))
    .filter((segment) => segment.text !== '');
}

const ENTRY_DATE_FORMAT = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "2026-09-28" → "28 de septiembre de 2026" (plain calendar date, timezone-safe). */
export function formatEntryDate(date: string): string {
  return ENTRY_DATE_FORMAT.format(new Date(`${date}T00:00:00Z`));
}

export const CATEGORY_DISPLAY: Record<
  ChangelogCategory,
  { label: string; color: 'success' | 'primary' | 'warning' }
> = {
  nuevo: { label: 'Nuevo', color: 'success' },
  mejorado: { label: 'Mejorado', color: 'primary' },
  corregido: { label: 'Corregido', color: 'warning' },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Light client-side check; the API validates for real. */
export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}
