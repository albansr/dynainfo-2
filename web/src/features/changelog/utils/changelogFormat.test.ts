import { describe, it, expect } from 'vitest';
import { formatEntryDate, isValidEmail, splitBold } from './changelogFormat';

describe('changelogFormat', () => {
  describe('splitBold', () => {
    it('splits a leading bold phrase from the explanation', () => {
      expect(splitBold('**Página Estado**: tu cartera')).toEqual([
        { text: 'Página Estado', bold: true },
        { text: ': tu cartera', bold: false },
      ]);
    });

    it('keeps text without markup as a single plain segment', () => {
      expect(splitBold('sin negrita')).toEqual([{ text: 'sin negrita', bold: false }]);
    });

    it('keeps markup-looking content as plain text (no HTML injection path)', () => {
      expect(splitBold('<b>x</b> **y**')).toEqual([
        { text: '<b>x</b> ', bold: false },
        { text: 'y', bold: true },
      ]);
    });
  });

  describe('formatEntryDate', () => {
    it('formats a plain date in Spanish without shifting the day', () => {
      expect(formatEntryDate('2026-09-28')).toBe('28 de septiembre de 2026');
      expect(formatEntryDate('2026-10-01')).toBe('1 de octubre de 2026');
    });
  });

  describe('isValidEmail', () => {
    it('accepts a trimmed address and rejects malformed ones', () => {
      expect(isValidEmail('  ana@ejemplo.com ')).toBe(true);
      expect(isValidEmail('ana@ejemplo')).toBe(false);
      expect(isValidEmail('ana ejemplo.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });
});
