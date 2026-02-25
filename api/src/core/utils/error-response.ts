import type { FastifyRequest } from 'fastify';

/**
 * RFC 9457 Problem Details for HTTP APIs
 * https://www.rfc-editor.org/rfc/rfc9457.html
 *
 * Centralized error response utility following 2026 best practices:
 * - Sanitize sensitive information (never expose to clients)
 * - Structured, machine-readable format
 * - User-friendly messages
 * - Correlation IDs for support/debugging
 */

/**
 * RFC 9457 Error Response format
 */
export interface ErrorResponse {
  type: string;          // URI identifying the problem type
  title: string;         // Short, human-readable summary
  status: number;        // HTTP status code
  detail: string;        // Human-readable explanation
  instance: string;      // Request path
  traceId: string;       // Request ID for correlation
  errors?: unknown;      // Optional validation errors
}

/**
 * Patterns to sanitize from error messages
 */
const SENSITIVE_PATTERNS = [
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,           // IP addresses
  /:\d{2,5}\b/g,                                        // Ports
  /(?:password|token|secret|key)[:=]\s*\S+/gi,         // Credentials
  /\/[a-z0-9_\-./]+\.(ts|js|json|env)/gi,              // File paths
  /(?:postgres|mysql|mongodb|clickhouse):\/\/\S+/gi,   // Connection strings
  /Host:\s*\S+/gi,                                      // Hostnames
  /EHOSTUNREACH|ECONNREFUSED|ETIMEDOUT/g,              // Network errors
];

/**
 * Sanitize error message by removing sensitive information
 */
export function sanitizeErrorMessage(message: string): string {
  let sanitized = message;
  let hadSensitiveData = false;

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(message)) {
      hadSensitiveData = true;
    }
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  // If message contains BOTH sensitive data AND connection/network keywords, use generic message
  if (hadSensitiveData && /connect|connection|network|host|refused|timeout/i.test(message)) {
    return 'Service temporarily unavailable';
  }

  return sanitized;
}

/**
 * Create RFC 9457 compliant error response
 * @param request - Fastify request object
 * @param status - HTTP status code
 * @param code - Machine-readable error code
 * @param message - Error message (will be sanitized in production)
 * @param errors - Optional validation errors or additional context
 */
export function createErrorResponse(
  request: FastifyRequest,
  status: number,
  code: string,
  message: string,
  errors?: unknown
): ErrorResponse {
  const baseUrl = process.env['API_BASE_URL'] || 'https://api.dynainfo.com';
  const errorType = code.toLowerCase().replace(/_/g, '-');
  const isProduction = process.env['NODE_ENV'] === 'production';

  return {
    type: `${baseUrl}/errors/${errorType}`,
    title: formatTitle(code),
    status,
    detail: isProduction ? sanitizeErrorMessage(message) : message,
    instance: request.url,
    traceId: request.id,
    ...(errors ? { errors } : {}),
  };
}

/**
 * Convert ERROR_CODE to Title Case
 */
export function formatTitle(code: string): string {
  return code
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get generic message for error type (used in production)
 */
export function getGenericMessage(status: number): string {
  const messages: Record<number, string> = {
    400: 'The request contains invalid data',
    401: 'Authentication is required',
    403: 'Access to this resource is forbidden',
    404: 'The requested resource was not found',
    409: 'The request conflicts with the current state',
    422: 'The request contains invalid data',
    429: 'Too many requests, please try again later',
    500: 'An unexpected error occurred',
    503: 'Service temporarily unavailable',
  };

  return messages[status] || 'An error occurred';
}
