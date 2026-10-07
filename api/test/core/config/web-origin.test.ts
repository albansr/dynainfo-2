import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  environmentTag,
  matchWebOrigin,
  primaryWebOrigin,
  resolveWebOrigin,
  webOrigins,
} from '../../../src/core/config/web-origin.js';

const PROD = 'https://dynainfo.com.co';
const DEV = 'https://dev.dynainfo.com.co';

describe('web-origin', () => {
  afterEach(() => vi.unstubAllEnvs());

  describe('in production', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('ORIGIN_URL', ` ${PROD}/ , ${DEV}`);
    });

    it('lists the configured origins (normalized) plus the local dev server', () => {
      expect(webOrigins()).toEqual([PROD, DEV, 'http://localhost:4000']);
    });

    it('uses the first configured origin as primary', () => {
      expect(primaryWebOrigin()).toBe(PROD);
    });

    it('matches only our origins, normalizing a trailing slash', () => {
      expect(matchWebOrigin(`${DEV}/`)).toBe(DEV);
      expect(matchWebOrigin('https://evil.example')).toBeNull();
      expect(matchWebOrigin(undefined)).toBeNull();
    });

    it('resolves unknown or missing origins to the primary one', () => {
      expect(resolveWebOrigin(DEV)).toBe(DEV);
      expect(resolveWebOrigin('https://evil.example')).toBe(PROD);
      expect(resolveWebOrigin(null)).toBe(PROD);
    });

    it('tags every origin except production', () => {
      expect(environmentTag(PROD)).toBeNull();
      expect(environmentTag(DEV)).toBe('DEV');
      expect(environmentTag('http://localhost:4000')).toBe('LOCAL');
    });
  });

  describe('outside production', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('ORIGIN_URL', '');
    });

    it('falls back to the local dev server and still tags it', () => {
      expect(primaryWebOrigin()).toBe('http://localhost:4000');
      expect(environmentTag('http://localhost:4000')).toBe('LOCAL');
    });
  });
});
