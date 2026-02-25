import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { setupErrorHandler } from '../../../src/core/errors/error-handler.js';
import {
  AppError,
  ValidationError,
  NotFoundError,
  ErrorCode,
} from '../../../src/core/errors/app-error.js';
import { ZodError, z } from 'zod';

describe('Error Handler', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    setupErrorHandler(app);
  });

  describe('AppError Handling', () => {
    it('should handle ValidationError correctly', async () => {
      app.get('/test', async () => {
        throw new ValidationError('Invalid data', { field: 'email' });
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.status).toBe(400);
      expect(json.title).toBe('Validation Error');
      expect(json.detail).toBe('Invalid data');
      expect(json.errors).toEqual({ field: 'email' });
      expect(json.traceId).toBeDefined();
      expect(json.instance).toBe('/test');
    });

    it('should handle NotFoundError correctly', async () => {
      app.get('/test', async () => {
        throw new NotFoundError('User not found');
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(404);
      const json = response.json();
      expect(json.status).toBe(404);
      expect(json.title).toBe('Resource Not Found');
      expect(json.detail).toBe('User not found');
      expect(json.traceId).toBeDefined();
      expect(json.instance).toBe('/test');
    });
  });

  describe('Zod Validation Errors', () => {
    it('should handle ZodError with formatted details', async () => {
      app.get('/test', async () => {
        const schema = z.object({
          email: z.string().email(),
          age: z.number().min(18),
        });

        schema.parse({ email: 'invalid', age: 10 });
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.status).toBe(400);
      expect(json.title).toBe('Validation Error');
      expect(json.detail).toBe('Validation failed');
      expect(json.errors).toBeInstanceOf(Array);
    });
  });

  describe('Fastify Validation Errors', () => {
    it('should handle Fastify validation errors', async () => {
      app.get('/test', async () => {
        const error: any = new Error('Validation failed');
        error.validation = [{ field: 'email', message: 'Invalid' }];
        throw error;
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.status).toBe(400);
      expect(json.title).toBe('Validation Error');
    });
  });

  describe('Rate Limit Errors', () => {
    it('should handle 429 rate limit errors', async () => {
      app.get('/test', async () => {
        const error: any = new Error('Too many requests');
        error.statusCode = 429;
        throw error;
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(429);
      const json = response.json();
      expect(json.status).toBe(429);
      expect(json.title).toBe('Rate Limit Exceeded');
    });
  });

  describe('Generic Fastify Errors', () => {
    it('should handle errors with statusCode', async () => {
      app.get('/test', async () => {
        const error: any = new Error('Bad request');
        error.statusCode = 400;
        throw error;
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.status).toBe(400);
      expect(json.title).toBe('Internal Error');
    });
  });

  describe('Unknown Errors', () => {
    it('should handle unknown errors as 500 in production', async () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';

      app.get('/test', async () => {
        throw new Error('Something went wrong');
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(500);
      const json = response.json();
      expect(json.status).toBe(500);
      expect(json.title).toBe('Internal Error');
      expect(json.detail).toBe('Internal server error');

      process.env['NODE_ENV'] = originalEnv;
    });

    it('should expose error message in non-production', async () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';

      app.get('/test', async () => {
        throw new Error('Detailed error');
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(500);
      const json = response.json();
      expect(json.status).toBe(500);
      expect(json.detail).toBe('Detailed error');

      process.env['NODE_ENV'] = originalEnv;
    });
  });

  describe('Not Found Handler', () => {
    it('should handle 404 for non-existent routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/nonexistent',
      });

      expect(response.statusCode).toBe(404);
      const json = response.json();
      expect(json.status).toBe(404);
      expect(json.title).toBe('Resource Not Found');
      expect(json.detail).toContain('Route GET:/nonexistent not found');
    });

    it('should include method and URL in 404 message', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/missing',
      });

      expect(response.json().detail).toContain('POST:/api/missing');
    });
  });
});
