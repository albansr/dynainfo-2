import { createClient, type ClickHouseClient } from '@clickhouse/client';
import { logger } from '../../logger/logger.js';

interface ClickHouseConfig {
  host: string;
  port?: number;
  username?: string;
  password?: string;
  database: string;
  request_timeout?: number;
  max_open_connections?: number;
}

class DatabaseClient {
  private static instance: DatabaseClient;
  private client: ClickHouseClient;

  private constructor(config: ClickHouseConfig) {
    // Build URL with database (new recommended format)
    const url = `http://${config.host}:${config.port ?? 8123}/${config.database}`;

    this.client = createClient({
      url,
      username: config.username ?? 'default',
      password: config.password ?? '',
      request_timeout: config.request_timeout ?? 30000,
      max_open_connections: config.max_open_connections ?? 10,
      compression: {
        request: true,
        response: true,
      },
      clickhouse_settings: {
        // Optimizations for analytics workload
        max_execution_time: 60,
        enable_http_compression: 1,
        output_format_json_quote_64bit_integers: 0,
      },
    });
  }

  public static getInstance(config?: ClickHouseConfig): DatabaseClient {
    if (!DatabaseClient.instance) {
      if (!config) {
        throw new Error('Database configuration is required for first initialization');
      }
      DatabaseClient.instance = new DatabaseClient(config);
    }
    return DatabaseClient.instance;
  }

  public getClient(): ClickHouseClient {
    return this.client;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.query({ query: 'SELECT 1' });
      await result.json();
      return true;
    } catch (error) {
      logger.error({
        type: 'db_health_check_error',
        err: error,
      }, 'ClickHouse health check failed');
      return false;
    }
  }

  public async close(): Promise<void> {
    await this.client.close();
  }
}

export { DatabaseClient, type ClickHouseConfig };
