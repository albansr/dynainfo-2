/**
 * Custom application error classes
 * Provides type-safe error handling with error codes
 *
 * RFC 9457 compliant (Problem Details for HTTP APIs)
 */

import type { ErrorResponse as RFC9457ErrorResponse } from '../utils/error-response.js';

export enum ErrorCode {
  // Client errors (400-499)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Server errors (500-599)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  QUERY_FAILED = 'QUERY_FAILED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): ErrorResponse {
    const errorObj: ErrorResponse = {
      error: {
        code: this.code,
        message: this.message,
      },
    };

    if (this.details !== undefined) {
      errorObj.error.details = this.details;
    }

    return errorObj;
  }

  /**
   * Convert to RFC 9457 format (used by error handler)
   * @internal
   */
  toRFC9457(baseUrl: string, instance: string, traceId: string): RFC9457ErrorResponse {
    const errorType = this.code.toLowerCase().replace(/_/g, '-');
    const title = this.code
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    return {
      type: `${baseUrl}/errors/${errorType}`,
      title,
      status: this.statusCode,
      detail: this.message,
      instance,
      traceId,
      ...(this.details ? { errors: this.details } : {}),
    };
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.VALIDATION_ERROR, message, 400, details);
  }
}

/**
 * Invalid input error (400)
 */
export class InvalidInputError extends AppError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.INVALID_INPUT, message, 400, details);
  }
}

/**
 * Resource not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(ErrorCode.RESOURCE_NOT_FOUND, message, 404);
  }
}

/**
 * Unauthorized error (401)
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(ErrorCode.UNAUTHORIZED, message, 401);
  }
}

/**
 * Forbidden error (403)
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(ErrorCode.FORBIDDEN, message, 403);
  }
}

/**
 * Rate limit exceeded error (429)
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(ErrorCode.RATE_LIMIT_EXCEEDED, message, 429);
  }
}

/**
 * Database error (500)
 */
export class DatabaseError extends AppError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.DATABASE_ERROR, message, 500, details);
  }
}

/**
 * Query failed error (500)
 */
export class QueryError extends AppError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.QUERY_FAILED, message, 500, details);
  }
}

/**
 * Service unavailable error (503)
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(ErrorCode.SERVICE_UNAVAILABLE, message, 503);
  }
}

/**
 * Type guard to check if error is AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
