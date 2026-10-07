import { describe, it, expect } from 'vitest';
import {
  entriesForDate,
  previousDay,
  renderDigestHtml,
  renderDigestSubject,
  renderDigestText,
  zonedDateHour,
} from '../../../src/features/changelog/changelog.digest.js';
import type { ChangelogEntry } from '../../../src/features/changelog/changelog.entries.js';

const entry = (overrides: Partial<ChangelogEntry> = {}): ChangelogEntry => ({
  id: 'e1',
  date: '2026-10-06',
  title: 'Página Estado',
  summary: 'Tu cartera de clientes.',
  published: true,
  changes: [{ category: 'nuevo', items: ['**Vistas** de <clientes>'] }],
  ...overrides,
});

const links = {
  webOrigin: 'https://dynainfo.com.co',
  unsubscribeUrl: 'https://api.dynainfo.com.co/api/changelog/unsubscribe?token=abc&x="y"',
};

describe('changelog digest helpers', () => {
  describe('entriesForDate', () => {
    it('returns only published entries for that exact day', () => {
      const entries = [
        entry({ id: 'a' }),
        entry({ id: 'b', published: false }),
        entry({ id: 'c', date: '2026-10-05' }),
      ];
      expect(entriesForDate('2026-10-06', entries).map((e) => e.id)).toEqual(['a']);
    });
  });

  describe('previousDay', () => {
    it('crosses month and year boundaries', () => {
      expect(previousDay('2026-10-01')).toBe('2026-09-30');
      expect(previousDay('2026-01-01')).toBe('2025-12-31');
      expect(previousDay('2028-03-01')).toBe('2028-02-29');
    });
  });

  describe('zonedDateHour', () => {
    it('resolves date and hour in Bogota (UTC-5)', () => {
      expect(zonedDateHour(new Date('2026-10-07T04:30:00Z'), 'America/Bogota')).toEqual({
        date: '2026-10-06',
        hour: 23,
      });
      expect(zonedDateHour(new Date('2026-10-07T13:00:00Z'), 'America/Bogota')).toEqual({
        date: '2026-10-07',
        hour: 8,
      });
    });

    it('reports midnight as hour 0, not 24', () => {
      expect(zonedDateHour(new Date('2026-10-07T05:00:00Z'), 'America/Bogota').hour).toBe(0);
    });
  });

  describe('renderDigestSubject', () => {
    it('uses the title for a single entry and a count otherwise', () => {
      expect(renderDigestSubject([entry()])).toBe('Novedades DynaInfo · Página Estado');
      expect(renderDigestSubject([entry(), entry({ id: 'e2' })])).toBe('Novedades DynaInfo · 2 novedades');
    });
  });

  describe('environment tag', () => {
    it('prefixes the subject and labels the body header outside production', () => {
      expect(renderDigestSubject([entry()], 'DEV')).toBe('[DEV] Novedades DynaInfo · Página Estado');
      const html = renderDigestHtml([entry()], { ...links, environmentTag: 'DEV' });
      expect(html).toContain('Novedades de DynaInfo · Entorno DEV');
      expect(renderDigestText([entry()], { ...links, environmentTag: 'DEV' })).toMatch(/^Novedades de DynaInfo · Entorno DEV/);
    });

    it('stays untagged in production', () => {
      expect(renderDigestSubject([entry()], null)).toBe('Novedades DynaInfo · Página Estado');
      expect(renderDigestHtml([entry()], links)).not.toContain('Entorno');
    });
  });

  describe('renderDigestHtml', () => {
    it('renders bold, escapes HTML and includes the category label', () => {
      const html = renderDigestHtml([entry()], links);
      expect(html).toContain('<strong>Vistas</strong> de &lt;clientes&gt;');
      expect(html).toContain('Nuevo');
      expect(html).toContain('Tu cartera de clientes.');
    });

    it('carries the changelog link and an escaped per-recipient unsubscribe link', () => {
      const html = renderDigestHtml([entry()], links);
      expect(html).toContain('href="https://dynainfo.com.co/novedades"');
      expect(html).toContain('token=abc&amp;x=&quot;y&quot;');
      expect(html).toContain('Darse de baja');
    });
  });

  it('renders the entry image with an absolute URL and alt text, and omits it when absent', () => {
    const withImage = renderDigestHtml(
      [entry({ image: { src: '/novedades/estado.png', alt: 'Página "Estado"' } })],
      links,
    );
    expect(withImage).toContain('<img src="https://dynainfo.com.co/novedades/estado.png" alt="Página &quot;Estado&quot;"');
    expect(renderDigestHtml([entry()], links)).not.toContain('<img');
  });

  describe('renderDigestText', () => {
    it('renders a plain-text part without markdown and with both links', () => {
      const text = renderDigestText([entry()], links);
      expect(text).toContain('NUEVO\n- Vistas de <clientes>');
      expect(text).not.toContain('**');
      expect(text).toContain('Ver todas las novedades: https://dynainfo.com.co/novedades');
      expect(text).toContain(`Darse de baja: ${links.unsubscribeUrl}`);
    });
  });
});
