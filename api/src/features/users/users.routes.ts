import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { UsersService, type ListUsersParams } from './users.service.js';
import { authenticate } from '../../core/middleware/authenticate.js';
import { requireAdmin, requireSuperadmin } from '../../core/middleware/authorize.js';
import { NotFoundError } from '../../core/errors/app-error.js';

/**
 * User management routes
 *
 * All routes require authentication
 * Create/Update/Delete require admin role
 * Hard delete requires superadmin role
 */
export async function usersRoutes(fastify: FastifyInstance) {
  const service = new UsersService();

  // List users (admin+)
  fastify.get(
    '/users',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        description: 'List users with pagination and filters',
        tags: ['Users'],
        querystring: Type.Object({
          page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
          search: Type.Optional(Type.String()),
          role: Type.Optional(Type.Union([
            Type.Literal('superadmin'),
            Type.Literal('admin'),
            Type.Literal('user'),
          ])),
          isActive: Type.Optional(Type.Boolean()),
        }),
        response: {
          200: Type.Object({
            data: Type.Array(Type.Object({
              id: Type.String(),
              email: Type.String(),
              name: Type.Union([Type.String(), Type.Null()]),
              role: Type.String(),
              isActive: Type.Boolean(),
              emailVerified: Type.Boolean(),
              createdAt: Type.String(),
              updatedAt: Type.String(),
            })),
            meta: Type.Object({
              total: Type.Integer(),
              count: Type.Integer(),
              page: Type.Integer(),
              limit: Type.Integer(),
              totalPages: Type.Integer(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const result = await service.listUsers(request.query as ListUsersParams);
      return reply.send(result);
    }
  );

  // Get user by ID (admin+)
  fastify.get(
    '/users/:id',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        description: 'Get user by ID',
        tags: ['Users'],
        params: Type.Object({
          id: Type.String({ format: 'uuid' }),
        }),
        response: {
          200: Type.Object({
            id: Type.String(),
            email: Type.String(),
            name: Type.Union([Type.String(), Type.Null()]),
            role: Type.String(),
            isActive: Type.Boolean(),
            emailVerified: Type.Boolean(),
            createdAt: Type.String(),
            updatedAt: Type.String(),
          }),
          404: Type.Object({
            error: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = await service.getUserById(id);

      if (!user) {
        throw new NotFoundError('User not found');
      }

      return reply.send(user);
    }
  );

  // Create user (admin+)
  fastify.post(
    '/users',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        description: 'Create new user',
        tags: ['Users'],
        body: Type.Object({
          email: Type.String({ format: 'email' }),
          name: Type.Optional(Type.String()),
          role: Type.Optional(Type.Union([
            Type.Literal('superadmin'),
            Type.Literal('admin'),
            Type.Literal('user'),
          ])),
          isActive: Type.Optional(Type.Boolean()),
        }),
        response: {
          201: Type.Object({
            id: Type.String(),
            email: Type.String(),
            name: Type.Union([Type.String(), Type.Null()]),
            role: Type.String(),
            isActive: Type.Boolean(),
            emailVerified: Type.Boolean(),
            createdAt: Type.String(),
            updatedAt: Type.String(),
          }),
          400: Type.Object({
            error: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        email: string;
        name?: string;
        role?: 'user' | 'admin' | 'superadmin';
        isActive?: boolean;
      };

      // Check if user already exists
      const existing = await service.getUserByEmail(body.email);
      if (existing) {
        return reply.status(400).send({ error: 'User with this email already exists' });
      }

      const user = await service.createUser(body);
      return reply.status(201).send(user);
    }
  );

  // Update user (admin+)
  fastify.patch(
    '/users/:id',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        description: 'Update user',
        tags: ['Users'],
        params: Type.Object({
          id: Type.String({ format: 'uuid' }),
        }),
        body: Type.Object({
          name: Type.Optional(Type.String()),
          role: Type.Optional(Type.Union([
            Type.Literal('superadmin'),
            Type.Literal('admin'),
            Type.Literal('user'),
          ])),
          isActive: Type.Optional(Type.Boolean()),
        }),
        response: {
          200: Type.Object({
            id: Type.String(),
            email: Type.String(),
            name: Type.Union([Type.String(), Type.Null()]),
            role: Type.String(),
            isActive: Type.Boolean(),
            emailVerified: Type.Boolean(),
            createdAt: Type.String(),
            updatedAt: Type.String(),
          }),
          404: Type.Object({
            error: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        name?: string;
        role?: 'user' | 'admin' | 'superadmin';
        isActive?: boolean;
      };

      const user = await service.updateUser(id, body);

      if (!user) {
        throw new NotFoundError('User not found');
      }

      return reply.send(user);
    }
  );

  // Soft delete user (admin+)
  fastify.delete(
    '/users/:id',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        description: 'Soft delete user (set isActive to false)',
        tags: ['Users'],
        params: Type.Object({
          id: Type.String({ format: 'uuid' }),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            message: Type.String(),
          }),
          404: Type.Object({
            error: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const deleted = await service.deleteUser(id);

      if (!deleted) {
        throw new NotFoundError('User not found');
      }

      return reply.send({
        success: true,
        message: 'User deactivated successfully',
      });
    }
  );

  // Hard delete user (superadmin only)
  fastify.delete(
    '/users/:id/permanent',
    {
      preHandler: [authenticate, requireSuperadmin],
      schema: {
        description: 'Permanently delete user (superadmin only)',
        tags: ['Users'],
        params: Type.Object({
          id: Type.String({ format: 'uuid' }),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            message: Type.String(),
          }),
          404: Type.Object({
            error: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const deleted = await service.permanentlyDeleteUser(id);

      if (!deleted) {
        throw new NotFoundError('User not found');
      }

      return reply.send({
        success: true,
        message: 'User permanently deleted',
      });
    }
  );
}
