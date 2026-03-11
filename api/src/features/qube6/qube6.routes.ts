import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { DatabaseClient } from '../../core/db/clickhouse/client.js';
import { Qube6Service } from './qube6.service.js';
import {
  Qube6QueryStringSchema,
  Qube6ResponseSchema,
  Qube6DistributionResponseSchema,
  parseQueryParamsToDateFilters,
} from './qube6.schemas.js';
import { SuccessResponseSchema } from '../../core/schemas/common.schemas.js';
import { parseDynamicFilters, combineFilters } from '../../core/utils/filter-parser.js';
import { sanitizeFieldName, sanitizeDateString } from '../../core/utils/sanitization.js';

export function qube6Routes(
  fastify: FastifyInstance,
  dbClient: DatabaseClient
): void {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const service = new Qube6Service(dbClient.getClient());

  server.get(
    '/qube6',
    {
      schema: {
        description: 'Segment analysis (Value, Sales, Profit, Quality). With id: single entity. Without id: distribution aggregation.',
        tags: ['qube6'],
        querystring: Qube6QueryStringSchema,
        response: {
          200: SuccessResponseSchema(Type.Union([Qube6ResponseSchema, Qube6DistributionResponseSchema])),
        },
      },
    },
    async (request, reply) => {
      const query = request.query;

      const groupBy = sanitizeFieldName(query.groupBy);

      const dateFilters = parseQueryParamsToDateFilters({
        ...(query.startDate && { startDate: sanitizeDateString(query.startDate) }),
        ...(query.endDate && { endDate: sanitizeDateString(query.endDate) }),
      });

      const { id: _, ...restQuery } = query as Record<string, unknown>;
      const dynamicFilters = parseDynamicFilters(restQuery);

      const allFilters = combineFilters(dynamicFilters, dateFilters);

      if (query.id) {
        const result = await service.getAnalysis({
          groupBy,
          id: query.id,
          filters: allFilters,
        });
        return reply.code(200).send({ data: result });
      }

      const result = await service.getDistribution({
        groupBy,
        filters: allFilters,
      });
      return reply.code(200).send({ data: result });
    }
  );
}
