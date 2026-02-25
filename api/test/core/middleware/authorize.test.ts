import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  authorize,
  requireSuperadmin,
  requireAdmin,
  requireUser,
} from '../../../src/core/middleware/authorize.js';

describe('Authorize Middleware', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    mockRequest = {
      user: undefined,
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('No User Attached', () => {
    it('should return 401 when user is not authenticated', async () => {
      const middleware = authorize('user');

      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply)
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('Role Hierarchy', () => {
    it('should allow user with exact required role', async () => {
      mockRequest.user = {
        id: 'user-1',
        email: 'admin@test.com',
        role: 'admin',
      } as any;

      const middleware = authorize('admin');
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should allow superadmin to access admin routes', async () => {
      mockRequest.user = {
        id: 'user-1',
        email: 'super@test.com',
        role: 'superadmin',
      } as any;

      const middleware = authorize('admin');
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it('should allow superadmin to access user routes', async () => {
      mockRequest.user = {
        id: 'user-1',
        email: 'super@test.com',
        role: 'superadmin',
      } as any;

      const middleware = authorize('user');
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it('should allow admin to access user routes', async () => {
      mockRequest.user = {
        id: 'user-1',
        email: 'admin@test.com',
        role: 'admin',
      } as any;

      const middleware = authorize('user');
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).not.toHaveBeenCalled();
    });
  });

  describe('Insufficient Permissions', () => {
    it('should deny user access to admin routes', async () => {
      mockRequest.user = {
        id: 'user-1',
        email: 'user@test.com',
        role: 'user',
      } as any;

      const middleware = authorize('admin');

      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply)
      ).rejects.toThrow('Access denied');
    });

    it('should deny user access to superadmin routes', async () => {
      mockRequest.user = {
        id: 'user-1',
        email: 'user@test.com',
        role: 'user',
      } as any;

      const middleware = authorize('superadmin');

      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply)
      ).rejects.toThrow('Access denied');
    });

    it('should deny admin access to superadmin routes', async () => {
      mockRequest.user = {
        id: 'user-1',
        email: 'admin@test.com',
        role: 'admin',
      } as any;

      const middleware = authorize('superadmin');

      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply)
      ).rejects.toThrow('Access denied');
    });
  });

  describe('Default Role', () => {
    it('should default to user role when role is undefined', async () => {
      mockRequest.user = {
        id: 'user-1',
        email: 'user@test.com',
        role: undefined,
      } as any;

      const middleware = authorize('user');
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it('should deny default role access to admin routes', async () => {
      mockRequest.user = {
        id: 'user-1',
        email: 'user@test.com',
        role: undefined,
      } as any;

      const middleware = authorize('admin');

      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply)
      ).rejects.toThrow('Access denied');
    });
  });

  describe('Exported Helper Functions', () => {
    it('requireSuperadmin should enforce superadmin role', async () => {
      mockRequest.user = {
        id: 'user-1',
        email: 'admin@test.com',
        role: 'admin',
      } as any;

      await expect(
        requireSuperadmin(mockRequest as FastifyRequest, mockReply as FastifyReply)
      ).rejects.toThrow('Access denied');
    });

    it('requireAdmin should allow admin role', async () => {
      mockRequest.user = {
        id: 'user-1',
        email: 'admin@test.com',
        role: 'admin',
      } as any;

      await requireAdmin(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it('requireUser should allow any authenticated user', async () => {
      mockRequest.user = {
        id: 'user-1',
        email: 'user@test.com',
        role: 'user',
      } as any;

      await requireUser(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).not.toHaveBeenCalled();
    });
  });
});
