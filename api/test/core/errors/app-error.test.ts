import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  InvalidInputError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  RateLimitError,
  DatabaseError,
  QueryError,
  ServiceUnavailableError,
  isAppError,
  ErrorCode,
} from '../../../src/core/errors/app-error.js';

describe('AppError', () => {
  describe('Base AppError', () => {
    it('should create error with all properties', () => {
      const error = new AppError(
        ErrorCode.INTERNAL_ERROR,
        'Test error',
        500,
        { detail: 'test' }
      );

      expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.details).toEqual({ detail: 'test' });
      expect(error.name).toBe('AppError');
    });

    it('should capture stack trace', () => {
      const error = new AppError(ErrorCode.INTERNAL_ERROR, 'Test');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });

    it('should convert to JSON with details', () => {
      const error = new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Invalid data',
        400,
        { field: 'email' }
      );

      const json = error.toJSON();

      expect(json).toEqual({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Invalid data',
          details: { field: 'email' },
        },
      });
    });

    it('should convert to JSON without details', () => {
      const error = new AppError(ErrorCode.INTERNAL_ERROR, 'Server error');

      const json = error.toJSON();

      expect(json).toEqual({
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Server error',
        },
      });
      expect(json.error.details).toBeUndefined();
    });
  });

  describe('ValidationError', () => {
    it('should create 400 error with validation code', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.message).toBe('Invalid input');
      expect(error.details).toEqual({ field: 'email' });
    });
  });

  describe('InvalidInputError', () => {
    it('should create 400 error with invalid input code', () => {
      const error = new InvalidInputError('Bad data');

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(ErrorCode.INVALID_INPUT);
      expect(error.message).toBe('Bad data');
    });
  });

  describe('NotFoundError', () => {
    it('should create 404 error with default message', () => {
      const error = new NotFoundError();

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
      expect(error.message).toBe('Resource not found');
    });

    it('should create 404 error with custom message', () => {
      const error = new NotFoundError('User not found');

      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('User not found');
    });
  });

  describe('UnauthorizedError', () => {
    it('should create 401 error with default message', () => {
      const error = new UnauthorizedError();

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(error.message).toBe('Unauthorized');
    });

    it('should create 401 error with custom message', () => {
      const error = new UnauthorizedError('Invalid token');

      expect(error.message).toBe('Invalid token');
    });
  });

  describe('ForbiddenError', () => {
    it('should create 403 error with default message', () => {
      const error = new ForbiddenError();

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe(ErrorCode.FORBIDDEN);
      expect(error.message).toBe('Forbidden');
    });

    it('should create 403 error with custom message', () => {
      const error = new ForbiddenError('Access denied');

      expect(error.message).toBe('Access denied');
    });
  });

  describe('RateLimitError', () => {
    it('should create 429 error with default message', () => {
      const error = new RateLimitError();

      expect(error.statusCode).toBe(429);
      expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      expect(error.message).toBe('Too many requests');
    });

    it('should create 429 error with custom message', () => {
      const error = new RateLimitError('Slow down');

      expect(error.message).toBe('Slow down');
    });
  });

  describe('DatabaseError', () => {
    it('should create 500 error with database code', () => {
      const error = new DatabaseError('Connection failed', { host: 'localhost' });

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
      expect(error.message).toBe('Connection failed');
      expect(error.details).toEqual({ host: 'localhost' });
    });
  });

  describe('QueryError', () => {
    it('should create 500 error with query failed code', () => {
      const error = new QueryError('Invalid SQL', { query: 'SELECT *' });

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe(ErrorCode.QUERY_FAILED);
      expect(error.message).toBe('Invalid SQL');
      expect(error.details).toEqual({ query: 'SELECT *' });
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should create 503 error with default message', () => {
      const error = new ServiceUnavailableError();

      expect(error.statusCode).toBe(503);
      expect(error.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
      expect(error.message).toBe('Service temporarily unavailable');
    });

    it('should create 503 error with custom message', () => {
      const error = new ServiceUnavailableError('Maintenance mode');

      expect(error.message).toBe('Maintenance mode');
    });
  });

  describe('isAppError Type Guard', () => {
    it('should return true for AppError instances', () => {
      const error = new AppError(ErrorCode.INTERNAL_ERROR, 'Test');

      expect(isAppError(error)).toBe(true);
    });

    it('should return true for AppError subclasses', () => {
      const errors = [
        new ValidationError('test'),
        new NotFoundError(),
        new UnauthorizedError(),
        new DatabaseError('test'),
      ];

      errors.forEach((error) => {
        expect(isAppError(error)).toBe(true);
      });
    });

    it('should return false for regular Error', () => {
      const error = new Error('Regular error');

      expect(isAppError(error)).toBe(false);
    });

    it('should return false for non-error objects', () => {
      expect(isAppError({})).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
      expect(isAppError('error')).toBe(false);
      expect(isAppError(123)).toBe(false);
    });
  });

  describe('Error Inheritance', () => {
    it('should be instance of Error', () => {
      const error = new AppError(ErrorCode.INTERNAL_ERROR, 'Test');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('should maintain prototype chain', () => {
      const validation = new ValidationError('test');

      expect(validation).toBeInstanceOf(Error);
      expect(validation).toBeInstanceOf(AppError);
      expect(validation).toBeInstanceOf(ValidationError);
    });
  });
});
