import pino from 'pino';

/**
 * Centralized logger configuration for DynaInfo API
 *
 * Best Practices 2026:
 * - Structured JSON logging for machine-readable logs
 * - pino-pretty only in development (5x faster than Winston)
 * - Redaction of sensitive fields (GDPR compliance)
 * - Request ID correlation for distributed tracing
 * - Async logging for minimal performance impact
 */

const isDevelopment = process.env['NODE_ENV'] !== 'production';
const isTest = process.env['NODE_ENV'] === 'test';

export const logger = pino({
  level: isTest ? 'silent' : (process.env['LOG_LEVEL'] || (isDevelopment ? 'debug' : 'info')),

  // Development: pretty print with colors
  // Production: structured JSON
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss.l',
      ignore: 'pid,hostname',
      singleLine: false,
      messageFormat: '{levelLabel} - {msg}',
    },
  } : undefined,

  // Redact sensitive fields (GDPR compliance)
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'password',
      'token',
      'secret',
      'apiKey',
      '*.password',
      '*.token',
      '*.secret',
    ],
    censor: '[REDACTED]',
  },

  // Serializers for req/res/err objects
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },

  // Format options
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
      node_version: process.version,
    }),
  },

  // Timestamp
  timestamp: () => `,"time":"${new Date().toISOString()}"`,

  // Base context (added to all logs)
  base: {
    env: process.env['NODE_ENV'] || 'development',
    service: 'dynainfo-api',
  },
});

/**
 * Child logger with additional context
 */
export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Log database query (with performance tracking)
 */
export function logQuery(query: string, duration: number, params?: Record<string, unknown>) {
  logger.debug({
    type: 'db_query',
    query: query.substring(0, 200), // Truncate long queries
    duration_ms: duration,
    params,
    slow: duration > 1000, // Flag slow queries (>1s)
  }, 'Database query executed');
}

/**
 * Log HTTP request (called from Fastify hooks)
 */
export function logRequest(req: {
  id: string;
  method: string;
  url: string;
  ip: string;
  userAgent?: string;
}) {
  logger.info({
    type: 'http_request',
    reqId: req.id,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.userAgent,
  }, 'Incoming request');
}

/**
 * Log HTTP response (called from Fastify hooks)
 */
export function logResponse(req: {
  id: string;
  url: string;
}, res: {
  statusCode: number;
}, duration: number) {
  const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

  logger[level]({
    type: 'http_response',
    reqId: req.id,
    url: req.url,
    statusCode: res.statusCode,
    duration_ms: duration,
    slow: duration > 3000, // Flag slow responses (>3s)
  }, 'Request completed');
}

/**
 * Log authentication events
 */
export function logAuth(event: 'login' | 'logout' | 'failed_login' | 'token_refresh', userId?: string, metadata?: Record<string, unknown>) {
  logger.info({
    type: 'auth_event',
    event,
    userId,
    ...metadata,
  }, `Authentication: ${event}`);
}

/**
 * Log error with stack trace
 */
export function logError(error: Error, context?: Record<string, unknown>) {
  logger.error({
    type: 'error',
    err: error,
    stack: error.stack,
    ...context,
  }, error.message);
}

export default logger;
