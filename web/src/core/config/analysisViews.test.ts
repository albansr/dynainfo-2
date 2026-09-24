import { describe, it, expect } from 'vitest';
import { ANALYSIS_VIEWS, ANALYSIS_VIEW_SECTIONS, NEW_CHANNELS_VIEW_SECTIONS } from './analysisViews';

describe('analysis views registry', () => {
  it('has unique view ids', () => {
    const ids = ANALYSIS_VIEWS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('Compañía General is overview-only (no drillable table)', () => {
    const general = ANALYSIS_VIEWS.find((v) => v.id === 'general');
    expect(general?.type).toBe('overview');
  });

  it('GMROI and Vera are "coming soon"', () => {
    expect(ANALYSIS_VIEWS.find((v) => v.id === 'gmroi')?.type).toBe('soon');
    expect(ANALYSIS_VIEWS.find((v) => v.id === 'vera')?.type).toBe('soon');
  });

  it('Cadenas groups by client, Exportaciones by country', () => {
    const cadenas = ANALYSIS_VIEW_SECTIONS.flatMap((s) => s.views).find((v) => v.id === 'cadenas');
    const exp = ANALYSIS_VIEW_SECTIONS.flatMap((s) => s.views).find((v) => v.id === 'exportaciones');
    expect(cadenas?.config?.groupBy).toBe('customer_id');
    expect(cadenas?.config?.filters).toEqual({ channel: 'CADENAS' });
    expect(exp?.config?.groupBy).toBe('customer_country');
  });

  it('NEW_CHANNELS "Todos" filters both channels', () => {
    const todos = NEW_CHANNELS_VIEW_SECTIONS[0].views.find((v) => v.id === 'todos-nuevos-canales');
    expect(todos?.config?.filters).toEqual({ channel: ['EXPORTACIONES', 'CADENAS'] });
  });

  it('every analytics view carries a config with a groupBy', () => {
    for (const v of ANALYSIS_VIEWS) {
      if (v.type === 'analytics') expect(v.config?.groupBy).toBeTruthy();
    }
  });
});
