import 'dotenv/config';
import Fastify from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseClient, type ClickHouseConfig } from './core/db/clickhouse/client.js';
import { balanceRoutes } from './features/balance/balance.routes.js';
import { listRoutes } from './features/list/list.routes.js';
import { labelsRoutes } from './features/labels/labels.routes.js';
import { authRoutes } from './features/auth/auth.routes.js';
import { usersRoutes } from './features/users/users.routes.js';
import { getEnvConfig } from './core/config/env.js';
import { setupErrorHandler } from './core/errors/error-handler.js';
import {
  HealthCheckResponseSchema,
  ApiInfoResponseSchema,
} from './core/schemas/common.schemas.js';

// ES modules __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extended Fastify instance with custom decorators
 */
declare module 'fastify' {
  interface FastifyInstance {
    db: DatabaseClient;
  }
}

/**
 * Build the Fastify server
 */
async function buildServer() {
  const config = getEnvConfig();

  // Prepare HTTPS options for production
  let httpsOptions;
  if (config.NODE_ENV === 'production') {
    const sslDir = path.join(__dirname, '../ssl');

    try {
      httpsOptions = {
        key: fs.readFileSync(path.join(sslDir, 'dynainfo.key')),
        cert: fs.readFileSync(path.join(sslDir, 'dynainfo.crt')),
        ca: fs.readFileSync(path.join(sslDir, 'ca.crt')),
      };
    } catch (error) {
      console.error('Failed to load SSL certificates:', error);
      throw new Error('SSL certificates are required in production mode');
    }
  }

  // Initialize Fastify with TypeBox type provider
  const fastify = Fastify({
    https: httpsOptions, // Will be undefined in development (uses HTTP)
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        config.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
    requestIdLogLabel: 'reqId',
    disableRequestLogging: false,
    requestIdHeader: 'x-request-id',
    // Generate request IDs for tracking
    genReqId: () => {
      return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Register security plugins with enhanced headers
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Required for Swagger UI
        styleSrc: ["'self'", "'unsafe-inline'"], // Required for Swagger UI
        imgSrc: ["'self'", 'data:', 'validator.swagger.io'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: config.NODE_ENV === 'production',
    hsts: {
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: 'deny', // Prevent clickjacking
    },
    noSniff: true, // Prevent MIME type sniffing
    xssFilter: true, // Enable XSS filter
  });

  await fastify.register(cors, {
    origin: config.NODE_ENV === 'production'
      ? (config.ORIGIN_URL || false)
      : true,
    credentials: true,
  });

  // Register rate limiting
  const rateLimitConfig = {
    max: config.NODE_ENV === 'production' ? 100 : 1000,
    timeWindow: '1 minute',
    cache: 10000,
    errorResponseBuilder: () => {
      return {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
        },
      };
    },
    ...(config.NODE_ENV === 'development' && {
      allowList: ['127.0.0.1'],
    }),
  };

  await fastify.register(rateLimit, rateLimitConfig);

  // Register Swagger for API documentation
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'DynaInfo API',
        description: 'Data visualization API with Fastify 5 and ClickHouse',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://${config.HOST}:${config.PORT}`,
          description: config.NODE_ENV,
        },
      ],
      tags: [
        { name: 'Authentication', description: 'Email OTP authentication endpoints' },
        { name: 'Users', description: 'User management endpoints' },
        { name: 'balance', description: 'Balance sheet endpoints' },
        { name: 'list', description: 'List endpoints' },
        { name: 'labels', description: 'Column values endpoints' },
        { name: 'health', description: 'Health check endpoints' },
      ],
    },
  });

  // Register Swagger UI
  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  // Initialize database client
  const clickhouseConfig: ClickHouseConfig = {
    host: config.CLICKHOUSE_HOST,
    port: config.CLICKHOUSE_PORT,
    database: config.CLICKHOUSE_DATABASE,
    username: config.CLICKHOUSE_USERNAME,
    password: config.CLICKHOUSE_PASSWORD,
    request_timeout: 30000,
    max_open_connections: 10,
  };

  const dbClient = DatabaseClient.getInstance(clickhouseConfig);

  // Decorate Fastify instance with database client
  fastify.decorate('db', dbClient);

  // Setup global error handler
  setupErrorHandler(fastify);

  // Health check endpoints with detailed information
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Detailed health check with metrics',
        tags: ['health'],
        response: {
          200: HealthCheckResponseSchema,
          503: HealthCheckResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const startTime = Date.now();

      try {
        // Test database connection
        const dbStart = Date.now();
        await dbClient.getClient().ping();
        const dbResponseTime = Date.now() - dbStart;

        // Memory metrics
        const memUsage = process.memoryUsage();
        const memoryInMB = {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024),
        };

        const totalTime = Date.now() - startTime;

        return reply.code(200).send({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: Math.floor(process.uptime()),
          responseTime: `${totalTime}ms`,
          database: {
            connected: true,
            responseTime: `${dbResponseTime}ms`,
          },
          memory: {
            heapUsed: `${memoryInMB.heapUsed} MB`,
            heapTotal: `${memoryInMB.heapTotal} MB`,
            rss: `${memoryInMB.rss} MB`,
          },
        });
      } catch (error) {
        request.log.error({ err: error }, 'Health check failed');

        return reply.code(503).send({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          database: 'disconnected',
        });
      }
    }
  );

  // API info endpoint
  fastify.get(
    '/',
    {
      schema: {
        description: 'API information endpoint',
        tags: ['health'],
        response: {
          200: ApiInfoResponseSchema,
        },
      },
    },
    async (request, reply) => {
      return reply.code(200).send({
        name: 'DynaInfo API',
        version: '1.0.0',
        description: 'Data visualization API with ClickHouse',
        endpoints: {
          health: '/health',
          balance: '/api/balance',
          list: '/api/list',
          labels: '/api/labels',
        },
      });
    }
  );

  // Register feature routes
  await fastify.register(authRoutes);
  await fastify.register(
    async (instance) => {
      balanceRoutes(instance, dbClient);
      listRoutes(instance, dbClient);
      labelsRoutes(instance, dbClient);
      await usersRoutes(instance);
    },
    { prefix: '/api' }
  );

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    await fastify.close();
    await dbClient.close();
    if (signal === 'SIGUSR2') process.kill(process.pid, 'SIGUSR2');
    else process.exit(0);
  };

  ['SIGUSR2', 'SIGINT', 'SIGTERM'].forEach((signal) => {
    process.once(signal, () => shutdown(signal));
  });

  return { fastify, config };
}

/**
 * Start the server
 */
async function start() {
  try {
    const { fastify, config } = await buildServer();

    await fastify.listen({
      port: config.PORT,
      host: config.HOST,
      listenTextResolver: (address) => `Server listening at ${address}`,
    });

    const protocol = config.NODE_ENV === 'production' ? 'https' : 'http';
    fastify.log.info(`Server running on ${protocol}://${config.HOST}:${config.PORT}`);
    fastify.log.info(`Environment: ${config.NODE_ENV}`);
    fastify.log.info(`API Documentation: ${protocol}://${config.HOST}:${config.PORT}/docs`);
    fastify.log.info(`ClickHouse: ${config.CLICKHOUSE_HOST}`);
    if (config.NODE_ENV === 'production') {
      fastify.log.info(`SSL/TLS: Enabled with certificates from ssl/ directory`);
      fastify.log.info(`CORS Origin: ${config.ORIGIN_URL || 'Not set'}`);
    }
  } catch (error) {
    // Use standalone logger since Fastify may not be initialized
    const { logger } = await import('./core/logger/logger.js');
    logger.error({
      type: 'server_startup_error',
      err: error,
    }, 'Failed to start server');
    process.exit(1);
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  void start();
}

export { buildServer, start };
