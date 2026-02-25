import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../../src/core/middleware/authenticate.js';

// Mock Better Auth
vi.mock('../../../src/core/auth/auth.js', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

describe('Authenticate Middleware', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      headers: {},
      log: {
        error: vi.fn(),
      } as any,
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('Missing Authorization Header', () => {
    it('should return 401 when authorization header is missing', async () => {
      await authenticate(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Missing or invalid authorization header',
      });
    });

    it('should return 401 when authorization header does not start with Bearer', async () => {
      mockRequest.headers = { authorization: 'Basic token123' };

      await authenticate(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Missing or invalid authorization header',
      });
    });
  });

  describe('Valid Token', () => {
    it('should attach user to request when session is valid', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        emailVerified: true,
      };

      const { auth } = await import('../../../src/core/auth/auth.js');
      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: mockUser,
        session: { id: 'session-123' },
      } as any);

      mockRequest.headers = { authorization: 'Bearer valid-token' };

      await authenticate(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect((mockRequest as any).user).toEqual(mockUser);
      expect(mockReply.status).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });
  });

  describe('Invalid Token', () => {
    it('should return 401 when session is null', async () => {
      const { auth } = await import('../../../src/core/auth/auth.js');
      vi.mocked(auth.api.getSession).mockResolvedValue(null as any);

      mockRequest.headers = { authorization: 'Bearer invalid-token' };

      await authenticate(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Invalid or expired session',
      });
    });

    it('should return 401 when session has no user', async () => {
      const { auth } = await import('../../../src/core/auth/auth.js');
      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: null,
        session: { id: 'session-123' },
      } as any);

      mockRequest.headers = { authorization: 'Bearer invalid-token' };

      await authenticate(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Invalid or expired session',
      });
    });

    it('should return 401 when getSession throws error', async () => {
      const { auth } = await import('../../../src/core/auth/auth.js');
      vi.mocked(auth.api.getSession).mockRejectedValue(new Error('Token expired'));

      mockRequest.headers = { authorization: 'Bearer expired-token' };

      await authenticate(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRequest.log?.error).toHaveBeenCalledWith(
        'Authentication failed:',
        expect.any(Error)
      );
      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Authentication failed',
      });
    });
  });

  describe('Token Extraction', () => {
    it('should correctly extract token from Bearer authorization', async () => {
      const { auth } = await import('../../../src/core/auth/auth.js');
      const mockGetSession = vi.mocked(auth.api.getSession).mockResolvedValue({
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);

      mockRequest.headers = { authorization: 'Bearer my-jwt-token-123' };

      await authenticate(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockGetSession).toHaveBeenCalledWith({
        headers: { authorization: 'Bearer my-jwt-token-123' },
      });
    });
  });
});
