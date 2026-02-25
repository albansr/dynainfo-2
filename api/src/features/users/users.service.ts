import { eq, ilike, or, and, desc } from 'drizzle-orm';
import { db } from '../../core/db/postgres/client.js';
import { users, type User, type NewUser } from '../../core/db/postgres/schema.js';

export interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  isActive?: boolean;
}

export interface ListUsersResult {
  data: User[];
  meta: {
    total: number;
    count: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Users service - Business logic for user management
 */
export class UsersService {
  /**
   * List users with pagination and filters
   */
  async listUsers(params: ListUsersParams): Promise<ListUsersResult> {
    const { page = 1, limit = 20, search, role, isActive } = params;
    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(users.email, `%${search}%`),
          ilike(users.name, `%${search}%`)
        )
      );
    }

    if (role) {
      conditions.push(eq(users.role, role));
    }

    if (isActive !== undefined) {
      conditions.push(eq(users.isActive, isActive));
    }

    // Get total count
    const [{ count: totalCount }] = await db
      .select({ count: db.$count() })
      .from(users)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Get paginated results
    const data = await db
      .select()
      .from(users)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data,
      meta: {
        total: Number(totalCount),
        count: data.length,
        page,
        limit,
        totalPages: Math.ceil(Number(totalCount) / limit),
      },
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user || null;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user || null;
  }

  /**
   * Create new user (admin only)
   */
  async createUser(data: Partial<NewUser>): Promise<User> {
    const [newUser] = await db
      .insert(users)
      .values({
        email: data.email!,
        name: data.name,
        role: data.role || 'user',
        isActive: data.isActive ?? true,
        emailVerified: false,
      })
      .returning();

    return newUser;
  }

  /**
   * Update user
   */
  async updateUser(id: string, data: Partial<User>): Promise<User | null> {
    const [updated] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    return updated || null;
  }

  /**
   * Delete user (soft delete - set isActive to false)
   */
  async deleteUser(id: string): Promise<boolean> {
    const [deleted] = await db
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    return !!deleted;
  }

  /**
   * Permanently delete user (hard delete - superadmin only)
   */
  async permanentlyDeleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount > 0;
  }
}
