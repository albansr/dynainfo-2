import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { isAppError, ErrorCode } from './app-error.js';
import { ZodError } from 'zod';
import { createErrorResponse, sanitizeErrorMessage } from '../utils/error-response.js';

const BASE_URL = process.env['API_BASE_URL'] || 'https://api.dynainfo.com';

/**
 * Global error handler for Fastify (RFC 9457 compliant)
 * Logs full error details + returns sanitized responses
 */
export function setupErrorHandler(fastify: FastifyInstance): void {
  fastify.setErrorHandler(async (error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) => {
    const isProduction = process.env['NODE_ENV'] === 'production';
    // Log FULL error with all details (for debugging)
    request.log.error({
      type: 'request_error',
      err: error,
      stack: error.stack,
      reqId: request.id,
      url: request.url,
      method: request.method,
      statusCode: 'statusCode' in error ? error.statusCode : 500,
    }, 'Request error occurred');

    // AppError (custom errors with RFC 9457 support)
    if (isAppError(error)) {
      const response = error.toRFC9457(BASE_URL, request.url, request.id);
      // Sanitize message in production
      if (isProduction) {
        response.detail = sanitizeErrorMessage(response.detail);
      }
      return reply.code(error.statusCode).send(response);
    }

    // Zod validation errors
    if (error instanceof ZodError) {
      const errors = error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));
      return reply.code(400).send(
        createErrorResponse(request, 400, ErrorCode.VALIDATION_ERROR, 'Validation failed', errors)
      );
    }

    // Fastify validation errors
    if ('validation' in error && error.validation) {
      return reply.code(400).send(
        createErrorResponse(request, 400, ErrorCode.VALIDATION_ERROR, 'Validation failed', error.validation)
      );
    }

    // Rate limit errors
    if ('statusCode' in error && error.statusCode === 429) {
      return reply.code(429).send(
        createErrorResponse(request, 429, ErrorCode.RATE_LIMIT_EXCEEDED, 'Too many requests')
      );
    }

    // Other Fastify errors (sanitized)
    if ('statusCode' in error && error.statusCode) {
      const message = isProduction
        ? 'An error occurred'
        : sanitizeErrorMessage(error.message || 'An error occurred');
      return reply.code(error.statusCode).send(
        createErrorResponse(request, error.statusCode, ErrorCode.INTERNAL_ERROR, message)
      );
    }

    // Unknown errors (sanitized)
    const message = isProduction ? 'Internal server error' : sanitizeErrorMessage(error.message);
    return reply.code(500).send(
      createErrorResponse(request, 500, ErrorCode.INTERNAL_ERROR, message)
    );
  });

  // 404 Not Found handler
  fastify.setNotFoundHandler(async (request, reply) => {
    return reply.code(404).send(
      createErrorResponse(request, 404, ErrorCode.RESOURCE_NOT_FOUND, `Route ${request.method}:${request.url} not found`)
    );
  });
}
