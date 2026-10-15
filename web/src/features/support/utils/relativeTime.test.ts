import { describe, it, expect } from 'vitest';
import { formatRelative } from './relativeTime';

const NOW = new Date('2026-10-15T12:00:00Z');

describe('formatRelative', () => {
  it('describes past moments in Spanish', () => {
    expect(formatRelative('2026-10-15T11:59:40Z', NOW)).toBe('ahora');
    expect(formatRelative('2026-10-15T11:55:00Z', NOW)).toBe('hace 5 minutos');
    expect(formatRelative('2026-10-15T10:00:00Z', NOW)).toBe('hace 2 horas');
    expect(formatRelative('2026-10-14T12:00:00Z', NOW)).toBe('ayer');
    expect(formatRelative('2026-08-01T12:00:00Z', NOW)).toBe('hace 2 meses');
  });
});
