import { describe, it, expect } from 'vitest';
import { isDemoRoleEnabled } from './constants';

describe('isDemoRoleEnabled', () => {
  it('is off on the production domain', () => {
    expect(isDemoRoleEnabled('dynainfo.com.co')).toBe(false);
    expect(isDemoRoleEnabled('www.dynainfo.com.co')).toBe(false);
  });

  it('stays on for dev, preview and local sites', () => {
    expect(isDemoRoleEnabled('dev.dynainfo.com.co')).toBe(true);
    expect(isDemoRoleEnabled('localhost')).toBe(true);
  });
});
