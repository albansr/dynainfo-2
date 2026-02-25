import { z } from 'zod';

/**
 * Environment variables schema with validation
 */
const envSchema = z.object({
  // Server configuration
  PORT: z
    .string()
    .default('3000')
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0 && val < 65536, {
      message: 'PORT must be between 1 and 65535',
    }),

  HOST: z.string().default('0.0.0.0'),

  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // CORS configuration
  ORIGIN_URL: z
    .string()
    .url('ORIGIN_URL must be a valid URL')
    .optional()
    .describe('Allowed CORS origin in production (e.g., https://dynainfo.com.co)'),

  // ClickHouse configuration
  CLICKHOUSE_HOST: z
    .string()
    .min(1, 'CLICKHOUSE_HOST is required')
    .refine((val) => {
      // Accept hostname, IP, or URL
      return val.length > 0 && !val.includes(' ');
    }, {
      message: 'CLICKHOUSE_HOST must be a valid hostname or IP address',
    }),

  CLICKHOUSE_PORT: z
    .string()
    .default('8123')
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0 && val < 65536, {
      message: 'CLICKHOUSE_PORT must be between 1 and 65535',
    }),

  CLICKHOUSE_DATABASE: z
    .string()
    .min(1, 'CLICKHOUSE_DATABASE is required')
    .default('default'),

  CLICKHOUSE_USERNAME: z
    .string()
    .min(1, 'CLICKHOUSE_USERNAME is required')
    .default('default'),

  CLICKHOUSE_PASSWORD: z
    .string()
    .refine((val) => val !== undefined, {
      message: 'CLICKHOUSE_PASSWORD must be set (use empty string if no password)',
    }),

  // Optional table prefix
  TABLE_PREFIX: z.string().optional().default(''),
});

/**
 * Validated environment variables type
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables
 * Throws error if validation fails
 */
export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(
        (err) => `${err.path.join('.')}: ${err.message}`
      );
      throw new Error(
        `Environment validation failed:\n${errors.join('\n')}`
      );
    }
    throw error;
  }
}

/**
 * Get validated environment configuration
 * Call this once at application startup
 */
export function getEnvConfig(): Env {
  return validateEnv();
}
