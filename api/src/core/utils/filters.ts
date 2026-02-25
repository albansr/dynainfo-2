import { z } from 'zod';

/**
 * Filter operators supported by the dynamic filter system
 */
export enum FilterOperator {
  EQ = 'eq',           // Equal
  NEQ = 'neq',         // Not equal
  GT = 'gt',           // Greater than
  GTE = 'gte',         // Greater than or equal
  LT = 'lt',           // Less than
  LTE = 'lte',         // Less than or equal
  IN = 'in',           // In array
  NOT_IN = 'not_in',   // Not in array
  LIKE = 'like',       // Like (case-sensitive)
  ILIKE = 'ilike',     // Like (case-insensitive)
  BETWEEN = 'between', // Between two values
  IS_NULL = 'is_null', // Is null
  IS_NOT_NULL = 'is_not_null', // Is not null
}

/**
 * Aggregation functions
 */
export enum AggregationFunction {
  COUNT = 'count',
  SUM = 'sum',
  AVG = 'avg',
  MIN = 'min',
  MAX = 'max',
  UNIQ = 'uniq',       // ClickHouse unique count
  UNIQ_EXACT = 'uniqExact', // ClickHouse exact unique count
}

/**
 * Time interval for time-series grouping
 */
export enum TimeInterval {
  MINUTE = 'minute',
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

/**
 * Filter condition structure
 */
export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value?: unknown;
}

/**
 * Aggregation structure
 */
export interface Aggregation {
  function: AggregationFunction;
  field: string;
  alias: string;
}

/**
 * Time grouping configuration
 */
export interface TimeGrouping {
  field: string;
  interval: TimeInterval;
  alias?: string;
}

/**
 * Query parameters for dynamic queries
 */
export interface QueryParams {
  filters?: FilterCondition[];
  groupBy?: string[];
  aggregations?: Aggregation[];
  timeGrouping?: TimeGrouping;
  orderBy?: Array<{ field: string; direction: 'ASC' | 'DESC' }>;
  limit?: number;
  offset?: number;
}

/**
 * Builds WHERE clause from filter conditions
 */
export class FilterBuilder {
  private conditions: string[] = [];
  private params: Record<string, unknown> = {};
  private paramCounter = 0;

  /**
   * Add a filter condition
   */
  public addCondition(condition: FilterCondition): this {
    const paramName = this.getNextParamName();
    let clause: string;

    switch (condition.operator) {
      case FilterOperator.EQ:
        clause = `${condition.field} = {${paramName}:String}`;
        this.params[paramName] = condition.value;
        break;

      case FilterOperator.NEQ:
        clause = `${condition.field} != {${paramName}:String}`;
        this.params[paramName] = condition.value;
        break;

      case FilterOperator.GT:
        clause = `${condition.field} > {${paramName}:String}`;
        this.params[paramName] = condition.value;
        break;

      case FilterOperator.GTE:
        clause = `${condition.field} >= {${paramName}:String}`;
        this.params[paramName] = condition.value;
        break;

      case FilterOperator.LT:
        clause = `${condition.field} < {${paramName}:String}`;
        this.params[paramName] = condition.value;
        break;

      case FilterOperator.LTE:
        clause = `${condition.field} <= {${paramName}:String}`;
        this.params[paramName] = condition.value;
        break;

      case FilterOperator.IN:
        clause = `${condition.field} IN {${paramName}:Array(String)}`;
        this.params[paramName] = condition.value;
        break;

      case FilterOperator.NOT_IN:
        clause = `${condition.field} NOT IN {${paramName}:Array(String)}`;
        this.params[paramName] = condition.value;
        break;

      case FilterOperator.LIKE:
        clause = `${condition.field} LIKE {${paramName}:String}`;
        this.params[paramName] = condition.value;
        break;

      case FilterOperator.ILIKE:
        clause = `${condition.field} ILIKE {${paramName}:String}`;
        this.params[paramName] = condition.value;
        break;

      case FilterOperator.BETWEEN:
        if (!Array.isArray(condition.value) || condition.value.length !== 2) {
          throw new Error('BETWEEN operator requires array of 2 values');
        }
        const param1 = this.getNextParamName();
        clause = `${condition.field} BETWEEN {${paramName}:String} AND {${param1}:String}`;
        this.params[paramName] = condition.value[0];
        this.params[param1] = condition.value[1];
        break;

      case FilterOperator.IS_NULL:
        clause = `${condition.field} IS NULL`;
        break;

      case FilterOperator.IS_NOT_NULL:
        clause = `${condition.field} IS NOT NULL`;
        break;

      default:
        throw new Error(`Unsupported operator: ${condition.operator}`);
    }

    this.conditions.push(clause);
    return this;
  }

  /**
   * Get the WHERE clause
   */
  public getWhereClause(): string {
    if (this.conditions.length === 0) return '';
    return `WHERE ${this.conditions.join(' AND ')}`;
  }

  /**
   * Get all parameters
   */
  public getParams(): Record<string, unknown> {
    return this.params;
  }

  private getNextParamName(): string {
    return `param_${this.paramCounter++}`;
  }
}

/**
 * Builds GROUP BY clause with time grouping support
 */
export class GroupByBuilder {
  /**
   * Build GROUP BY clause
   */
  public static build(
    groupBy?: string[],
    timeGrouping?: TimeGrouping
  ): string {
    const groups: string[] = [];

    if (timeGrouping) {
      const timeFunc = this.getTimeFunction(
        timeGrouping.field,
        timeGrouping.interval
      );
      groups.push(timeFunc);
    }

    if (groupBy) {
      groups.push(...groupBy);
    }

    if (groups.length === 0) return '';
    return `GROUP BY ${groups.join(', ')}`;
  }

  /**
   * Get ClickHouse time grouping function
   */
  private static getTimeFunction(field: string, interval: TimeInterval): string {
    const functionMap: Record<TimeInterval, string> = {
      [TimeInterval.MINUTE]: `toStartOfMinute(${field})`,
      [TimeInterval.HOUR]: `toStartOfHour(${field})`,
      [TimeInterval.DAY]: `toStartOfDay(${field})`,
      [TimeInterval.WEEK]: `toStartOfWeek(${field})`,
      [TimeInterval.MONTH]: `toStartOfMonth(${field})`,
      [TimeInterval.YEAR]: `toStartOfYear(${field})`,
    };

    return functionMap[interval] ?? `toStartOfDay(${field})`;
  }
}

/**
 * Builds aggregation SELECT clause
 */
export class AggregationBuilder {
  /**
   * Build SELECT clause with aggregations
   */
  public static build(
    aggregations: Aggregation[],
    groupBy?: string[],
    timeGrouping?: TimeGrouping
  ): string {
    const selects: string[] = [];

    // Add time grouping to SELECT if present
    if (timeGrouping) {
      const timeFunc = GroupByBuilder['getTimeFunction'](
        timeGrouping.field,
        timeGrouping.interval
      );
      const alias = timeGrouping.alias ?? 'time_bucket';
      selects.push(`${timeFunc} AS ${alias}`);
    }

    // Add GROUP BY fields to SELECT
    if (groupBy) {
      selects.push(...groupBy);
    }

    // Add aggregations
    for (const agg of aggregations) {
      const aggFunc = this.getAggregationFunction(agg.function, agg.field);
      selects.push(`${aggFunc} AS ${agg.alias}`);
    }

    return selects.join(', ');
  }

  /**
   * Get ClickHouse aggregation function
   */
  private static getAggregationFunction(
    func: AggregationFunction,
    field: string
  ): string {
    switch (func) {
      case AggregationFunction.COUNT:
        return field === '*' ? 'count()' : `count(${field})`;
      case AggregationFunction.SUM:
        return `sum(${field})`;
      case AggregationFunction.AVG:
        return `avg(${field})`;
      case AggregationFunction.MIN:
        return `min(${field})`;
      case AggregationFunction.MAX:
        return `max(${field})`;
      case AggregationFunction.UNIQ:
        return `uniq(${field})`;
      case AggregationFunction.UNIQ_EXACT:
        return `uniqExact(${field})`;
      default:
        throw new Error(`Unsupported aggregation function: ${func}`);
    }
  }
}

/**
 * Zod schema for validating filter conditions
 */
export const FilterConditionSchema = z.object({
  field: z.string().min(1),
  operator: z.nativeEnum(FilterOperator),
  value: z.unknown().optional(),
});

/**
 * Zod schema for validating query parameters
 */
export const QueryParamsSchema = z.object({
  filters: z.array(FilterConditionSchema).optional(),
  groupBy: z.array(z.string()).optional(),
  aggregations: z
    .array(
      z.object({
        function: z.nativeEnum(AggregationFunction),
        field: z.string(),
        alias: z.string(),
      })
    )
    .optional(),
  timeGrouping: z
    .object({
      field: z.string(),
      interval: z.nativeEnum(TimeInterval),
      alias: z.string().optional(),
    })
    .optional(),
  orderBy: z
    .array(
      z.object({
        field: z.string(),
        direction: z.enum(['ASC', 'DESC']),
      })
    )
    .optional(),
  limit: z.number().int().positive().max(10000).optional(),
  offset: z.number().int().nonnegative().optional(),
});
