import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyRequest } from 'fastify';
import {
  sanitizeErrorMessage,
  createErrorResponse,
  formatTitle,
  getGenericMessage,
} from '../../../src/core/utils/error-response.js';

describe('Error Response Utilities', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env['NODE_ENV'];
  });

  afterEach(() => {
    process.env['NODE_ENV'] = originalEnv;
  });

  describe('sanitizeErrorMessage', () => {
    it('should redact IPv4 addresses when combined with network keywords', () => {
      const message = 'Connection failed to 192.168.1.1';
      const result = sanitizeErrorMessage(message);
      expect(result).toBe('Service temporarily unavailable');
    });

    it('should redact multiple IP addresses when combined with network keywords', () => {
      const message = 'Connection from 10.0.0.1 to 172.16.0.5 failed';
      const result = sanitizeErrorMessage(message);
      expect(result).toBe('Service temporarily unavailable');
    });

    it('should redact port numbers when combined with network keywords', () => {
      const message = 'Connection failed on port :8123';
      const result = sanitizeErrorMessage(message);
      expect(result).toBe('Service temporarily unavailable');
    });

    it('should redact password credentials', () => {
      const message = 'Auth failed: password=secret123';
      const result = sanitizeErrorMessage(message);
      expect(result).toBe('Auth failed: [REDACTED]');
    });

    it('should redact token credentials', () => {
      const message = 'Invalid token: bearer_token=abc123xyz';
      const result = sanitizeErrorMessage(message);
      expect(result).toBe('Invalid [REDACTED]');
    });

    it('should redact secret keys', () => {
      const message = 'API key=sk_live_1234567890';
      const result = sanitizeErrorMessage(message);
      expect(result).toBe('API [REDACTED]');
    });

    it('should redact file paths', () => {
      const message = 'Error in /app/src/config/database.ts';
      const result = sanitizeErrorMessage(message);
      expect(result).toBe('Error in [REDACTED]');
    });

    it('should redact PostgreSQL connection strings with connection keyword', () => {
      const message = 'Connection failed: postgres://user:pass@host:5432/db';
      const result = sanitizeErrorMessage(message);
      expect(result).toBe('Service temporarily unavailable');
    });

    it('should redact MongoDB connection strings with connection keyword', () => {
      const message = 'Network error: mongodb://localhost:27017/mydb';
      const result = sanitizeErrorMessage(message);
      expect(result).toBe('Service temporarily unavailable');
    });

    it('should redact MySQL connection strings with connection keyword', () => {
      const message = 'Connection refused: mysql://root:password@localhost:3306/db';
      const result = sanitizeErrorMessage(message);
      expect(result).toBe('Service temporarily unavailable');
    });

    it('should redact ClickHouse connection strings with connection keyword', () => {
      const message = 'Connection timeout: clickhouse://default:password@localhost:8123/analytics';
      const result = sanitizeErrorMessage(message);
      expect(result).toBe('Service temporarily unavailable');
    });

    it('should redact hostnames with connection keyword', () => {
      const message = 'Connection failed to Host: api.example.com';
      const result = sanitizeErrorMessage(message);
      expect(result).toBe('Service temporarily unavailable');
    });

    it('should replace network error codes with generic message', () => {
      const tests = [
        { input: 'connect EHOSTUNREACH 0.0.31.187:8123', expected: 'Service temporarily unavailable' },
        { input: 'connect ECONNREFUSED 127.0.0.1:5432', expected: 'Service temporarily unavailable' },
        { input: 'connect ETIMEDOUT at server', expected: 'Service temporarily unavailable' },
      ];

      tests.forEach(({ input, expected }) => {
        const result = sanitizeErrorMessage(input);
        expect(result).toBe(expected);
      });
    });

    it('should replace connection-related messages with generic message', () => {
      const tests = [
        { input: 'Network connection failed to 192.168.1.1', expected: 'Service temporarily unavailable' },
        { input: 'Connection refused by host 10.0.0.1:8080', expected: 'Service temporarily unavailable' },
        { input: 'Host timeout occurred at :3000', expected: 'Service temporarily unavailable' },
      ];

      tests.forEach(({ input, expected }) => {
        const result = sanitizeErrorMessage(input);
        expect(result).toBe(expected);
      });
    });

    it('should handle complex error messages with multiple sensitive data', () => {
      const message =
        'connect EHOSTUNREACH 10.0.31.187:8123 - Local (192.168.0.101:52452) using password=abc123 at /config/db.ts';
      const result = sanitizeErrorMessage(message);
      expect(result).toBe('Service temporarily unavailable');
    });

    it('should not modify safe error messages', () => {
      const message = 'Validation failed: Email is required';
      const result = sanitizeErrorMessage(message);
      expect(result).toBe(message);
    });

    it('should handle empty strings', () => {
      const result = sanitizeErrorMessage('');
      expect(result).toBe('');
    });
  });

  describe('formatTitle', () => {
    it('should format VALIDATION_ERROR correctly', () => {
      const result = formatTitle('VALIDATION_ERROR');
      expect(result).toBe('Validation Error');
    });

    it('should format INTERNAL_ERROR correctly', () => {
      const result = formatTitle('INTERNAL_ERROR');
      expect(result).toBe('Internal Error');
    });

    it('should format NOT_FOUND correctly', () => {
      const result = formatTitle('NOT_FOUND');
      expect(result).toBe('Not Found');
    });

    it('should format UNAUTHORIZED correctly', () => {
      const result = formatTitle('UNAUTHORIZED');
      expect(result).toBe('Unauthorized');
    });

    it('should format FORBIDDEN correctly', () => {
      const result = formatTitle('FORBIDDEN');
      expect(result).toBe('Forbidden');
    });

    it('should format DATABASE_ERROR correctly', () => {
      const result = formatTitle('DATABASE_ERROR');
      expect(result).toBe('Database Error');
    });

    it('should handle single word codes', () => {
      const result = formatTitle('ERROR');
      expect(result).toBe('Error');
    });

    it('should handle multiple underscores', () => {
      const result = formatTitle('RATE_LIMIT_EXCEEDED');
      expect(result).toBe('Rate Limit Exceeded');
    });
  });

  describe('createErrorResponse', () => {
    const mockRequest = {
      id: 'req-123',
      url: '/api/users/123',
    } as FastifyRequest;

    it('should create RFC 9457 compliant error response in development', () => {
      process.env['NODE_ENV'] = 'development';
      process.env['API_BASE_URL'] = 'https://api.test.com';

      const result = createErrorResponse(
        mockRequest,
        400,
        'VALIDATION_ERROR',
        'Invalid email format'
      );

      expect(result).toEqual({
        type: 'https://api.test.com/errors/validation-error',
        title: 'Validation Error',
        status: 400,
        detail: 'Invalid email format',
        instance: '/api/users/123',
        traceId: 'req-123',
      });
    });

    it('should sanitize error message in production', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['API_BASE_URL'] = 'https://api.test.com';

      const result = createErrorResponse(
        mockRequest,
        500,
        'INTERNAL_ERROR',
        'connect EHOSTUNREACH 192.168.1.1:5432'
      );

      expect(result.detail).toBe('Service temporarily unavailable');
      expect(result.status).toBe(500);
    });

    it('should include errors field when provided', () => {
      process.env['NODE_ENV'] = 'development';

      const validationErrors = [
        { field: 'email', message: 'Invalid format' },
        { field: 'password', message: 'Too short' },
      ];

      const result = createErrorResponse(
        mockRequest,
        400,
        'VALIDATION_ERROR',
        'Validation failed',
        validationErrors
      );

      expect(result.errors).toEqual(validationErrors);
    });

    it('should not include errors field when not provided', () => {
      process.env['NODE_ENV'] = 'development';

      const result = createErrorResponse(
        mockRequest,
        404,
        'NOT_FOUND',
        'User not found'
      );

      expect(result.errors).toBeUndefined();
    });

    it('should use default base URL when not configured', () => {
      process.env['NODE_ENV'] = 'development';
      delete process.env['API_BASE_URL'];

      const result = createErrorResponse(
        mockRequest,
        404,
        'NOT_FOUND',
        'Resource not found'
      );

      expect(result.type).toBe('https://api.dynainfo.com/errors/not-found');
    });

    it('should convert error code to kebab-case for type URL', () => {
      process.env['NODE_ENV'] = 'development';
      process.env['API_BASE_URL'] = 'https://api.test.com';

      const result = createErrorResponse(
        mockRequest,
        429,
        'RATE_LIMIT_EXCEEDED',
        'Too many requests'
      );

      expect(result.type).toBe('https://api.test.com/errors/rate-limit-exceeded');
    });

    it('should handle authorization errors', () => {
      process.env['NODE_ENV'] = 'production';
      delete process.env['API_BASE_URL'];

      const result = createErrorResponse(
        mockRequest,
        403,
        'FORBIDDEN',
        'Access denied'
      );

      expect(result).toEqual({
        type: 'https://api.dynainfo.com/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Access denied',
        instance: '/api/users/123',
        traceId: 'req-123',
      });
    });

    it('should handle authentication errors', () => {
      process.env['NODE_ENV'] = 'production';
      delete process.env['API_BASE_URL'];

      const result = createErrorResponse(
        mockRequest,
        401,
        'UNAUTHORIZED',
        'Invalid credentials'
      );

      expect(result).toEqual({
        type: 'https://api.dynainfo.com/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid credentials',
        instance: '/api/users/123',
        traceId: 'req-123',
      });
    });

    it('should preserve safe error messages in production', () => {
      process.env['NODE_ENV'] = 'production';

      const result = createErrorResponse(
        mockRequest,
        400,
        'VALIDATION_ERROR',
        'Email is required'
      );

      expect(result.detail).toBe('Email is required');
    });

    it('should handle database errors with sanitization', () => {
      process.env['NODE_ENV'] = 'production';

      const result = createErrorResponse(
        mockRequest,
        500,
        'DATABASE_ERROR',
        'Connection failed: postgres://user:pass@localhost:5432/db'
      );

      expect(result.detail).toBe('Service temporarily unavailable');
    });
  });

  describe('getGenericMessage', () => {
    it('should return generic message for 400', () => {
      const result = getGenericMessage(400);
      expect(result).toBe('The request contains invalid data');
    });

    it('should return generic message for 401', () => {
      const result = getGenericMessage(401);
      expect(result).toBe('Authentication is required');
    });

    it('should return generic message for 403', () => {
      const result = getGenericMessage(403);
      expect(result).toBe('Access to this resource is forbidden');
    });

    it('should return generic message for 404', () => {
      const result = getGenericMessage(404);
      expect(result).toBe('The requested resource was not found');
    });

    it('should return generic message for 409', () => {
      const result = getGenericMessage(409);
      expect(result).toBe('The request conflicts with the current state');
    });

    it('should return generic message for 422', () => {
      const result = getGenericMessage(422);
      expect(result).toBe('The request contains invalid data');
    });

    it('should return generic message for 429', () => {
      const result = getGenericMessage(429);
      expect(result).toBe('Too many requests, please try again later');
    });

    it('should return generic message for 500', () => {
      const result = getGenericMessage(500);
      expect(result).toBe('An unexpected error occurred');
    });

    it('should return generic message for 503', () => {
      const result = getGenericMessage(503);
      expect(result).toBe('Service temporarily unavailable');
    });

    it('should return default message for unknown status code', () => {
      const result = getGenericMessage(418);
      expect(result).toBe('An error occurred');
    });
  });

  describe('Integration: Full Error Flow', () => {
    const mockRequest = {
      id: 'trace-abc-123',
      url: '/api/analytics/query',
    } as FastifyRequest;

    it('should handle ClickHouse connection error in production', () => {
      process.env['NODE_ENV'] = 'production';
      delete process.env['API_BASE_URL'];

      const originalError =
        'connect EHOSTUNREACH 0.0.31.187:8123 - Local (192.168.0.101:52452)';
      const result = createErrorResponse(
        mockRequest,
        503,
        'SERVICE_UNAVAILABLE',
        originalError
      );

      expect(result).toEqual({
        type: 'https://api.dynainfo.com/errors/service-unavailable',
        title: 'Service Unavailable',
        status: 503,
        detail: 'Service temporarily unavailable',
        instance: '/api/analytics/query',
        traceId: 'trace-abc-123',
      });
    });

    it('should preserve detailed error in development', () => {
      process.env['NODE_ENV'] = 'development';
      process.env['API_BASE_URL'] = 'https://api.dynainfo.com';

      const originalError =
        'connect EHOSTUNREACH 0.0.31.187:8123 - Local (192.168.0.101:52452)';
      const result = createErrorResponse(
        mockRequest,
        503,
        'SERVICE_UNAVAILABLE',
        originalError
      );

      // In development, the exact error is preserved (not sanitized for production)
      expect(result.detail).toBe(originalError);
    });
  });
});
