import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersService } from '../../../src/features/users/users.service.js';

// Mock functions defined outside
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();
const mockOrderBy = vi.fn();
const mockValues = vi.fn();
const mockSet = vi.fn();
const mockReturning = vi.fn();

vi.mock('../../../src/core/db/postgres/client.js', () => {
  return {
    db: {
      select: () => mockSelect(),
      insert: () => mockInsert(),
      update: () => mockUpdate(),
      delete: () => mockDelete(),
      $count: () => 'COUNT(*)',
    },
  };
});

vi.mock('../../../src/core/db/postgres/schema.js', () => {
  return {
    users: {
      id: 'id',
      email: 'email',
      name: 'name',
      role: 'role',
      isActive: 'isActive',
      createdAt: 'createdAt',
    },
  };
});

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UsersService();

    // Default chain setup - create fresh instances for each chain
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit, orderBy: mockOrderBy, returning: mockReturning });
    mockLimit.mockReturnValue({ offset: mockOffset });
    mockOffset.mockResolvedValue([]);
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: vi.fn().mockReturnValue({ returning: mockReturning }) });
    mockDelete.mockReturnValue({ where: mockWhere });
    mockReturning.mockResolvedValue([]);
  });

  describe('listUsers', () => {
    it('should return paginated users with default params', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@test.com',
          name: 'User 1',
          role: 'user',
          isActive: true,
        },
      ];

      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      });

      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(mockUsers),
              }),
            }),
          }),
        }),
      });

      const result = await service.listUsers({});

      expect(result).toEqual({
        data: mockUsers,
        meta: {
          total: 1,
          count: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      });
    });

    it('should apply search filter', async () => {
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      await service.listUsers({ search: 'john' });

      // Verify where was called (with search filter)
      expect(mockSelect).toHaveBeenCalled();
    });

    it('should calculate correct pagination', async () => {
      const totalCount = 55;
      const limit = 10;
      const page = 3;

      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: totalCount }]),
        }),
      });

      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      const result = await service.listUsers({ page, limit });

      expect(result.meta.totalPages).toBe(6); // ceil(55 / 10)
      expect(result.meta.page).toBe(page);
      expect(result.meta.limit).toBe(limit);
    });

    it('should apply role filter', async () => {
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      await service.listUsers({ role: 'admin' });

      expect(mockSelect).toHaveBeenCalled();
    });

    it('should apply isActive filter', async () => {
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      await service.listUsers({ isActive: false });

      expect(mockSelect).toHaveBeenCalled();
    });

    it('should apply multiple filters together', async () => {
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      await service.listUsers({ role: 'admin', isActive: true, search: 'john' });

      expect(mockSelect).toHaveBeenCalled();
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      const result = await service.getUserById('user-123');

      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.getUserById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      const result = await service.getUserByEmail('test@example.com');

      expect(result).toEqual(mockUser);
    });
  });

  describe('createUser', () => {
    it('should create user with provided data', async () => {
      const newUserData = {
        email: 'new@example.com',
        name: 'New User',
        role: 'admin',
      };

      const createdUser = {
        id: 'user-new',
        ...newUserData,
        isActive: true,
        emailVerified: false,
      };

      mockReturning.mockResolvedValue([createdUser]);

      const result = await service.createUser(newUserData);

      expect(result).toEqual(createdUser);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          email: newUserData.email,
          name: newUserData.name,
          role: newUserData.role,
        })
      );
    });

    it('should default role to user when not provided', async () => {
      const newUserData = {
        email: 'new@example.com',
      };

      const createdUser = {
        id: 'user-new',
        email: newUserData.email,
        role: 'user',
        isActive: true,
        emailVerified: false,
      };

      mockReturning.mockResolvedValue([createdUser]);

      await service.createUser(newUserData);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'user',
        })
      );
    });
  });

  describe('updateUser', () => {
    it('should update user and return updated data', async () => {
      const updateData = {
        name: 'Updated Name',
        role: 'admin',
      };

      const updatedUser = {
        id: 'user-123',
        email: 'test@example.com',
        ...updateData,
      };

      mockReturning.mockResolvedValue([updatedUser]);

      const result = await service.updateUser('user-123', updateData);

      expect(result).toEqual(updatedUser);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          ...updateData,
          updatedAt: expect.any(Date),
        })
      );
    });

    it('should return null when user not found', async () => {
      mockReturning.mockResolvedValue([]);

      const result = await service.updateUser('nonexistent', { name: 'Test' });

      expect(result).toBeNull();
    });
  });

  describe('deleteUser (soft delete)', () => {
    it('should set isActive to false', async () => {
      const deletedUser = {
        id: 'user-123',
        isActive: false,
      };

      mockReturning.mockResolvedValue([deletedUser]);

      const result = await service.deleteUser('user-123');

      expect(result).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
          updatedAt: expect.any(Date),
        })
      );
    });

    it('should return false when user not found', async () => {
      mockReturning.mockResolvedValue([]);

      const result = await service.deleteUser('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('permanentlyDeleteUser (hard delete)', () => {
    it('should permanently delete user', async () => {
      mockWhere.mockResolvedValue({ rowCount: 1 });

      const result = await service.permanentlyDeleteUser('user-123');

      expect(result).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should return false when user not found', async () => {
      mockWhere.mockResolvedValue({ rowCount: 0 });

      const result = await service.permanentlyDeleteUser('nonexistent');

      expect(result).toBe(false);
    });
  });
});
