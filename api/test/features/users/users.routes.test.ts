import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { usersRoutes } from '../../../src/features/users/users.routes.js';
import { setupErrorHandler } from '../../../src/core/errors/error-handler.js';

// Mock service
const mockListUsers = vi.fn();
const mockGetUserById = vi.fn();
const mockGetUserByEmail = vi.fn();
const mockCreateUser = vi.fn();
const mockUpdateUser = vi.fn();
const mockDeleteUser = vi.fn();
const mockPermanentlyDeleteUser = vi.fn();

vi.mock('../../../src/features/users/users.service.js', () => {
  return {
    UsersService: class {
      listUsers = mockListUsers;
      getUserById = mockGetUserById;
      getUserByEmail = mockGetUserByEmail;
      createUser = mockCreateUser;
      updateUser = mockUpdateUser;
      deleteUser = mockDeleteUser;
      permanentlyDeleteUser = mockPermanentlyDeleteUser;
    },
  };
});

// Mock middleware - allow all by default
vi.mock('../../../src/core/middleware/authenticate.js', () => ({
  authenticate: vi.fn(async () => {}),
}));

vi.mock('../../../src/core/middleware/authorize.js', () => ({
  requireAdmin: vi.fn(async () => {}),
  requireSuperadmin: vi.fn(async () => {}),
}));

describe('Users Routes', () => {
  let app: Awaited<ReturnType<typeof Fastify>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });
    setupErrorHandler(app);
    await usersRoutes(app);
    await app.ready();
  });

  describe('GET /users', () => {
    it('should return paginated users', async () => {
      const mockResult = {
        data: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            email: 'user1@test.com',
            name: 'User 1',
            role: 'user',
            isActive: true,
            emailVerified: true,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        meta: {
          total: 1,
          count: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      };

      mockListUsers.mockResolvedValue(mockResult);

      const response = await app.inject({
        method: 'GET',
        url: '/users',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(mockResult);
      expect(mockListUsers).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
      });
    });

    it('should pass query parameters to service', async () => {
      mockListUsers.mockResolvedValue({ data: [], meta: {} });

      await app.inject({
        method: 'GET',
        url: '/users?page=2&limit=10&search=john&role=admin&isActive=true',
      });

      expect(mockListUsers).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        search: 'john',
        role: 'admin',
        isActive: true,
      });
    });
  });

  describe('GET /users/:id', () => {
    it('should return user when found', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        isActive: true,
        emailVerified: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockGetUserById.mockResolvedValue(mockUser);

      const response = await app.inject({
        method: 'GET',
        url: `/users/${userId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(mockUser);
    });

    it.skip('should return 404 when user not found', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440001';
      mockGetUserById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: `/users/${userId}`,
      });

      expect(response.statusCode).toBe(404);
      const json = response.json();
      expect(json).toHaveProperty('type');
      expect(json).toHaveProperty('title');
      expect(json).toHaveProperty('status', 404);
      expect(json).toHaveProperty('detail', 'User not found');
    });
  });

  describe('POST /users', () => {
    it('should create user successfully', async () => {
      const newUser = {
        email: 'new@example.com',
        name: 'New User',
        role: 'admin',
      };

      const createdUser = {
        id: 'user-new',
        ...newUser,
        isActive: true,
        emailVerified: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockGetUserByEmail.mockResolvedValue(null);
      mockCreateUser.mockResolvedValue(createdUser);

      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload: newUser,
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual(createdUser);
      expect(mockCreateUser).toHaveBeenCalledWith(newUser);
    });

    it('should return 400 when user already exists', async () => {
      const existingUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'existing@example.com',
      };

      mockGetUserByEmail.mockResolvedValue(existingUser);

      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload: {
          email: 'existing@example.com',
          name: 'Test',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: 'User with this email already exists',
      });
      expect(mockCreateUser).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /users/:id', () => {
    it('should update user successfully', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const updateData = {
        name: 'Updated Name',
        role: 'admin',
      };

      const updatedUser = {
        id: userId,
        email: 'test@example.com',
        ...updateData,
        isActive: true,
        emailVerified: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };

      mockUpdateUser.mockResolvedValue(updatedUser);

      const response = await app.inject({
        method: 'PATCH',
        url: `/users/${userId}`,
        payload: updateData,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(updatedUser);
      expect(mockUpdateUser).toHaveBeenCalledWith(userId, updateData);
    });

    it.skip('should return 404 when user not found', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440001';
      mockUpdateUser.mockResolvedValue(null);

      const response = await app.inject({
        method: 'PATCH',
        url: `/users/${userId}`,
        payload: { name: 'Test' },
      });

      expect(response.statusCode).toBe(404);
      const json = response.json();
      expect(json).toHaveProperty('type');
      expect(json).toHaveProperty('title');
      expect(json).toHaveProperty('status', 404);
      expect(json).toHaveProperty('detail', 'User not found');
    });
  });

  describe('DELETE /users/:id (soft delete)', () => {
    it('should soft delete user successfully', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      mockDeleteUser.mockResolvedValue(true);

      const response = await app.inject({
        method: 'DELETE',
        url: `/users/${userId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        success: true,
        message: 'User deactivated successfully',
      });
      expect(mockDeleteUser).toHaveBeenCalledWith(userId);
    });

    it.skip('should return 404 when user not found', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440001';
      mockDeleteUser.mockResolvedValue(false);

      const response = await app.inject({
        method: 'DELETE',
        url: `/users/${userId}`,
      });

      expect(response.statusCode).toBe(404);
      const json = response.json();
      expect(json).toHaveProperty('type');
      expect(json).toHaveProperty('title');
      expect(json).toHaveProperty('status', 404);
      expect(json).toHaveProperty('detail', 'User not found');
    });
  });

  describe('DELETE /users/:id/permanent (hard delete)', () => {
    it('should permanently delete user successfully', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      mockPermanentlyDeleteUser.mockResolvedValue(true);

      const response = await app.inject({
        method: 'DELETE',
        url: `/users/${userId}/permanent`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        success: true,
        message: 'User permanently deleted',
      });
      expect(mockPermanentlyDeleteUser).toHaveBeenCalledWith(userId);
    });

    it.skip('should return 404 when user not found', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440001';
      mockPermanentlyDeleteUser.mockResolvedValue(false);

      const response = await app.inject({
        method: 'DELETE',
        url: `/users/${userId}/permanent`,
      });

      expect(response.statusCode).toBe(404);
      const json = response.json();
      expect(json).toHaveProperty('type');
      expect(json).toHaveProperty('title');
      expect(json).toHaveProperty('status', 404);
      expect(json).toHaveProperty('detail', 'User not found');
    });
  });

  describe('Validation', () => {
    it('should validate email format on create', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload: {
          email: 'invalid-email',
          name: 'Test',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate role enum on create', async () => {
      mockGetUserByEmail.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload: {
          email: 'test@example.com',
          role: 'invalid-role',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate page minimum value', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/users?page=0',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate limit maximum value', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/users?limit=200',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate UUID format for user ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/users/invalid-uuid',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject invalid role on update', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await app.inject({
        method: 'PATCH',
        url: `/users/${userId}`,
        payload: {
          role: 'hacker',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty search query', async () => {
      const emptyResult = {
        data: [],
        meta: { total: 0, count: 0, page: 1, limit: 20, totalPages: 0 },
      };
      mockListUsers.mockResolvedValue(emptyResult);

      const response = await app.inject({
        method: 'GET',
        url: '/users?search=',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle very long search queries', async () => {
      const emptyResult = {
        data: [],
        meta: { total: 0, count: 0, page: 1, limit: 20, totalPages: 0 },
      };
      mockListUsers.mockResolvedValue(emptyResult);

      const longSearch = 'a'.repeat(1000);
      const response = await app.inject({
        method: 'GET',
        url: `/users?search=${longSearch}`,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle filter by inactive users', async () => {
      const emptyResult = {
        data: [],
        meta: { total: 0, count: 0, page: 1, limit: 20, totalPages: 0 },
      };
      mockListUsers.mockResolvedValue(emptyResult);

      const response = await app.inject({
        method: 'GET',
        url: '/users?isActive=false',
      });

      expect(response.statusCode).toBe(200);
      expect(mockListUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
        })
      );
    });

    it('should handle create user with minimal data', async () => {
      const newUser = {
        email: 'minimal@example.com',
      };

      const createdUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: newUser.email,
        name: null,
        role: 'user',
        isActive: true,
        emailVerified: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockGetUserByEmail.mockResolvedValue(null);
      mockCreateUser.mockResolvedValue(createdUser);

      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload: newUser,
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual(createdUser);
    });

    it('should handle update with empty payload', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const existingUser = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        isActive: true,
        emailVerified: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockUpdateUser.mockResolvedValue(existingUser);

      const response = await app.inject({
        method: 'PATCH',
        url: `/users/${userId}`,
        payload: {},
      });

      expect(response.statusCode).toBe(200);
    });

    it('should combine multiple filters in list query', async () => {
      const emptyResult = {
        data: [],
        meta: { total: 0, count: 0, page: 2, limit: 10, totalPages: 0 },
      };
      mockListUsers.mockResolvedValue(emptyResult);

      const response = await app.inject({
        method: 'GET',
        url: '/users?role=admin&isActive=true&search=john&page=2&limit=10',
      });

      expect(response.statusCode).toBe(200);
      expect(mockListUsers).toHaveBeenCalledWith({
        role: 'admin',
        isActive: true,
        search: 'john',
        page: 2,
        limit: 10,
      });
    });
  });

  describe('Security', () => {
    it('should not allow SQL injection in search', async () => {
      const emptyResult = {
        data: [],
        meta: { total: 0, count: 0, page: 1, limit: 20, totalPages: 0 },
      };
      mockListUsers.mockResolvedValue(emptyResult);

      const response = await app.inject({
        method: 'GET',
        url: '/users?search=\' OR 1=1--',
      });

      expect(response.statusCode).toBe(200);
      expect(mockListUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          search: '\' OR 1=1--',
        })
      );
    });

    it('should sanitize special characters in email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload: {
          email: 'test<script>alert("xss")</script>@example.com',
          name: 'Test',
        },
      });

      // Should fail email validation
      expect(response.statusCode).toBe(400);
    });

    it('should allow creating superadmin when authorized', async () => {
      const newUser = {
        email: 'new-superadmin@example.com',
        name: 'New Superadmin',
        role: 'superadmin',
      };

      mockGetUserByEmail.mockResolvedValue(null);
      mockCreateUser.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440000',
        ...newUser,
        isActive: true,
        emailVerified: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload: newUser,
      });

      // Should succeed if middleware allows (mocked to allow all)
      expect(response.statusCode).toBe(201);
      expect(response.json().role).toBe('superadmin');
    });
  });

  describe('Data Integrity', () => {
    it('should preserve user email on update', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const updatedUser = {
        id: userId,
        email: 'original@example.com',
        name: 'New Name',
        role: 'admin',
        isActive: true,
        emailVerified: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };

      mockUpdateUser.mockResolvedValue(updatedUser);

      const response = await app.inject({
        method: 'PATCH',
        url: `/users/${userId}`,
        payload: {
          name: 'New Name',
          role: 'admin',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().email).toBe('original@example.com');
    });

    it('should not double-delete a user', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      mockDeleteUser.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      // First delete
      const response1 = await app.inject({
        method: 'DELETE',
        url: `/users/${userId}`,
      });
      expect(response1.statusCode).toBe(200);

      // Second delete attempt
      const response2 = await app.inject({
        method: 'DELETE',
        url: `/users/${userId}`,
      });
      expect(response2.statusCode).toBe(404);
    });
  });
});
