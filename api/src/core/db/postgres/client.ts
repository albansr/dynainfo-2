import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

/**
 * PostgreSQL client for authentication database
 * Uses postgres.js for connection pooling
 */
const connectionString = process.env['POSTGRES_URL']!;

if (!connectionString) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

// Create postgres connection
const queryClient = postgres(connectionString);

// Initialize Drizzle with schema
export const db = drizzle(queryClient, { schema });

// Export types
export type Database = typeof db;
