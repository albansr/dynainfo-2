import { describe, it, expect } from 'vitest';
import { buildBalanceParams } from './useBalance';

describe('buildBalanceParams', () => {
  it('carries the period, the closed-period flag and the filters', () => {
    const params = buildBalanceParams(
      { startDate: '2026-09-01', endDate: '2026-09-30' },
      true,
      { channel: 'DISTRIBUCION', seller_id: ['CL01', 'CL02'] }
    );

    expect(params.get('startDate')).toBe('2026-09-01');
    expect(params.get('endDate')).toBe('2026-09-30');
    expect(params.get('facturadoOnly')).toBe('true');
    expect(params.get('channel')).toBe('DISTRIBUCION');
    expect(params.toString()).toContain('seller_id');
  });

  it('asks for the units aggregate only when requested', () => {
    expect(buildBalanceParams({}, false, undefined, true).get('includeUnits')).toBe('true');
    expect(buildBalanceParams({}, false).has('includeUnits')).toBe(false);
  });

  it('omits the flag for open periods and missing dates', () => {
    const params = buildBalanceParams({}, false);

    expect(params.toString()).toBe('');
  });
});
