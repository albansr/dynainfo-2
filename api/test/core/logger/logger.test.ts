import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  logger,
  createChildLogger,
  logQuery,
  logRequest,
  logResponse,
  logAuth,
  logError,
} from '../../../src/core/logger/logger.js';

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createChildLogger', () => {
    it('should create child logger with context', () => {
      const context = { userId: 'user-123', requestId: 'req-456' };
      const childLogger = createChildLogger(context);

      expect(childLogger).toBeDefined();
      expect(typeof childLogger.info).toBe('function');
      expect(typeof childLogger.error).toBe('function');
    });
  });

  describe('logQuery', () => {
    it('should log database query with duration', () => {
      const debugSpy = vi.spyOn(logger, 'debug');
      const query = 'SELECT * FROM users WHERE id = ?';
      const duration = 150;
      const params = { id: 'user-123' };

      logQuery(query, duration, params);

      expect(debugSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'db_query',
          query: expect.any(String),
          duration_ms: duration,
          params,
          slow: false,
        }),
        'Database query executed'
      );
    });

    it('should flag slow queries (>1s)', () => {
      const debugSpy = vi.spyOn(logger, 'debug');
      const query = 'SELECT * FROM large_table';
      const duration = 1500;

      logQuery(query, duration);

      expect(debugSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          slow: true,
        }),
        'Database query executed'
      );
    });

    it('should truncate long queries to 200 chars', () => {
      const debugSpy = vi.spyOn(logger, 'debug');
      const longQuery = 'SELECT ' + 'col,'.repeat(100) + ' FROM users';
      const duration = 100;

      logQuery(longQuery, duration);

      const loggedQuery = debugSpy.mock.calls[0][0].query;
      expect(loggedQuery.length).toBeLessThanOrEqual(200);
    });
  });

  describe('logRequest', () => {
    it('should log incoming HTTP request', () => {
      const infoSpy = vi.spyOn(logger, 'info');
      const req = {
        id: 'req-123',
        method: 'GET',
        url: '/api/users',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      };

      logRequest(req);

      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'http_request',
          reqId: req.id,
          method: req.method,
          url: req.url,
          ip: req.ip,
          userAgent: req.userAgent,
        }),
        'Incoming request'
      );
    });
  });

  describe('logResponse', () => {
    it('should log successful response at info level', () => {
      const infoSpy = vi.spyOn(logger, 'info');
      const req = { id: 'req-123', url: '/api/users' };
      const res = { statusCode: 200 };
      const duration = 250;

      logResponse(req, res, duration);

      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'http_response',
          reqId: req.id,
          url: req.url,
          statusCode: 200,
          duration_ms: duration,
          slow: false,
        }),
        'Request completed'
      );
    });

    it('should log 4xx response at warn level', () => {
      const warnSpy = vi.spyOn(logger, 'warn');
      const req = { id: 'req-123', url: '/api/users' };
      const res = { statusCode: 404 };
      const duration = 100;

      logResponse(req, res, duration);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
        }),
        'Request completed'
      );
    });

    it('should log 5xx response at error level', () => {
      const errorSpy = vi.spyOn(logger, 'error');
      const req = { id: 'req-123', url: '/api/users' };
      const res = { statusCode: 500 };
      const duration = 100;

      logResponse(req, res, duration);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
        }),
        'Request completed'
      );
    });

    it('should flag slow responses (>3s)', () => {
      const infoSpy = vi.spyOn(logger, 'info');
      const req = { id: 'req-123', url: '/api/slow-endpoint' };
      const res = { statusCode: 200 };
      const duration = 3500;

      logResponse(req, res, duration);

      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          slow: true,
        }),
        'Request completed'
      );
    });
  });

  describe('logAuth', () => {
    it('should log login event', () => {
      const infoSpy = vi.spyOn(logger, 'info');
      const userId = 'user-123';
      const metadata = { ip: '127.0.0.1' };

      logAuth('login', userId, metadata);

      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'auth_event',
          event: 'login',
          userId,
          ip: metadata.ip,
        }),
        'Authentication: login'
      );
    });

    it('should log logout event', () => {
      const infoSpy = vi.spyOn(logger, 'info');
      const userId = 'user-456';

      logAuth('logout', userId);

      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'logout',
          userId,
        }),
        'Authentication: logout'
      );
    });

    it('should log failed login event', () => {
      const infoSpy = vi.spyOn(logger, 'info');
      const metadata = { email: 'test@example.com', reason: 'invalid password' };

      logAuth('failed_login', undefined, metadata);

      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'failed_login',
          email: metadata.email,
          reason: metadata.reason,
        }),
        'Authentication: failed_login'
      );
    });

    it('should log token refresh event', () => {
      const infoSpy = vi.spyOn(logger, 'info');
      const userId = 'user-789';

      logAuth('token_refresh', userId);

      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'token_refresh',
          userId,
        }),
        'Authentication: token_refresh'
      );
    });
  });

  describe('logError', () => {
    it('should log error with stack trace', () => {
      const errorSpy = vi.spyOn(logger, 'error');
      const error = new Error('Something went wrong');
      const context = { userId: 'user-123', requestId: 'req-456' };

      logError(error, context);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          err: error,
          stack: expect.any(String),
          userId: context.userId,
          requestId: context.requestId,
        }),
        error.message
      );
    });

    it('should log error without context', () => {
      const errorSpy = vi.spyOn(logger, 'error');
      const error = new Error('Database connection failed');

      logError(error);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          err: error,
          stack: expect.any(String),
        }),
        error.message
      );
    });
  });
});
