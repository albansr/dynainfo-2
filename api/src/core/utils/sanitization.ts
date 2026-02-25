import { InvalidInputError } from '../errors/app-error.js';

/**
 * Input sanitization utilities
 * Prevents SQL injection, XSS, and other injection attacks
 */

/**
 * Sanitize string input
 * Removes potentially dangerous characters
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    throw new InvalidInputError('Input must be a string');
  }

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Limit length to prevent DoS
  if (sanitized.length > 1000) {
    throw new InvalidInputError('Input too long (max 1000 characters)');
  }

  return sanitized;
}

/**
 * Sanitize array of strings
 */
export function sanitizeStringArray(input: string[]): string[] {
  if (!Array.isArray(input)) {
    throw new InvalidInputError('Input must be an array');
  }

  if (input.length > 100) {
    throw new InvalidInputError('Array too long (max 100 items)');
  }

  return input.map(sanitizeString);
}

/**
 * Sanitize date string (ISO 8601 format)
 */
export function sanitizeDateString(input: string): string {
  const sanitized = sanitizeString(input);

  // Validate ISO date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(sanitized)) {
    throw new InvalidInputError('Invalid date format (expected YYYY-MM-DD)');
  }

  // Validate actual date
  const date = new Date(sanitized);
  if (isNaN(date.getTime())) {
    throw new InvalidInputError('Invalid date');
  }

  return sanitized;
}

/**
 * Sanitize field name for SQL queries
 * Only allows alphanumeric characters and underscores
 */
export function sanitizeFieldName(input: string): string {
  const sanitized = sanitizeString(input);

  // Only allow alphanumeric and underscore
  const fieldRegex = /^[a-zA-Z0-9_]+$/;
  if (!fieldRegex.test(sanitized)) {
    throw new InvalidInputError('Invalid field name (only alphanumeric and underscore allowed)');
  }

  // Limit length
  if (sanitized.length > 50) {
    throw new InvalidInputError('Field name too long (max 50 characters)');
  }

  return sanitized;
}

/**
 * Sanitize comma-separated string to array
 * Used for query parameters like ?region=north,south
 */
export function sanitizeCommaSeparated(input?: string): string[] | undefined {
  if (!input) return undefined;

  const sanitized = sanitizeString(input);
  const items = sanitized.split(',').map((item) => item.trim()).filter((item) => item.length > 0);

  return sanitizeStringArray(items);
}

/**
 * Sanitize numeric input
 */
export function sanitizeNumber(input: unknown): number {
  const num = Number(input);

  if (isNaN(num) || !isFinite(num)) {
    throw new InvalidInputError('Invalid number');
  }

  return num;
}

/**
 * Sanitize integer input with optional min/max
 */
export function sanitizeInteger(input: unknown, min?: number, max?: number): number {
  const num = sanitizeNumber(input);

  if (!Number.isInteger(num)) {
    throw new InvalidInputError('Value must be an integer');
  }

  if (min !== undefined && num < min) {
    throw new InvalidInputError(`Value must be at least ${min}`);
  }

  if (max !== undefined && num > max) {
    throw new InvalidInputError(`Value must be at most ${max}`);
  }

  return num;
}
