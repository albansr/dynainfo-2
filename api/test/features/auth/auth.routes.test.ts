import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { authRoutes } from '../../../src/features/auth/auth.routes.js';

vi.mock('../../../src/core/auth/auth.js', () => {
  const mockHandlerFn = vi.fn().mockResolvedValue({ status: 200 });
  return {
    auth: { handler: mockHandlerFn },
    getMockHandler: () => mockHandlerFn,
  };
});

const { getMockHandler } = await import('../../../src/core/auth/auth.js');
const mockHandler = (getMockHandler as any)();

describe('Auth Routes', () => {
  let app: Awaited<ReturnType<typeof Fastify>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await authRoutes(app);
  });

  it('should forward POST requests to Better Auth', async () => {
    await app.inject({ method: 'POST', url: '/api/auth/test' });
    expect(mockHandler).toHaveBeenCalled();
  });

  it('should forward GET requests to Better Auth', async () => {
    await app.inject({ method: 'GET', url: '/api/auth/session' });
    expect(mockHandler).toHaveBeenCalled();
  });
});
