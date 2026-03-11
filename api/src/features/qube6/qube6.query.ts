import { ALLOWED_DIMENSIONS } from '../../core/config/dimensions.config.js';
import { FilterBuilder, type FilterCondition } from '../../core/db/clickhouse/query/filter-builder.js';
import { sanitizeFieldName } from '../../core/utils/sanitization.js';

interface Qube6QueryParams {
  groupBy: string;
  id: string;
  currentFilters: FilterCondition[];
  previousFilters: FilterCondition[];
}

/**
 * Build the qube6 segment analysis query.
 *
 * Dedicated query builder — cannot use AnalyticsQueryBuilder because the logic
 * is fundamentally different (entity vs company comparison, rankings, composite indices).
 *
 * CTEs:
 * - company_data_last_year: COUNT DISTINCT entities from previous period
 * - company_data: Company-wide aggregates (sales, cost, customers, indices, averages)
 * - customers_data_last_year: Previous period sales & position per entity
 * - customers_data: Current period metrics per entity
 *
 * Final SELECT computes comparison indices and 4 analyses (Value, Sales, Profit, Quality).
 */
export function buildQube6Query(params: Qube6QueryParams): {
  query: string;
  queryParams: Record<string, string | string[]>;
} {
  const { groupBy, id, currentFilters, previousFilters } = params;

  const sanitizedGroupBy = sanitizeFieldName(groupBy);
  if (!ALLOWED_DIMENSIONS.includes(sanitizedGroupBy as typeof ALLOWED_DIMENSIONS[number])) {
    throw new Error(`Invalid groupBy dimension: ${sanitizedGroupBy}`);
  }

  const filterBuilder = new FilterBuilder();
  const queryParams: Record<string, string | string[]> = {};

  const currentWhere = filterBuilder.buildWhereClause(currentFilters, queryParams, 'cur');
  const previousWhere = filterBuilder.buildWhereClause(previousFilters, queryParams, 'prev');

  queryParams['entity_id'] = id;

  const tablePrefix = process.env['TABLE_PREFIX'] ?? '';
  const table = `${tablePrefix}transactions`;

  const query = `
    WITH
      company_data_last_year AS (
        SELECT
          COUNT(DISTINCT ${sanitizedGroupBy}) AS customers_last_year
        FROM ${table}
        ${previousWhere}
      ),

      company_data AS (
        SELECT
          SUM(sales_price) AS sales_price,
          SUM(cost_price) AS cost_price,
          COUNT(DISTINCT ${sanitizedGroupBy}) AS customers,

          SUM(list_price) / cost_price AS theorical_profit_index,
          sales_price / cost_price AS average_profit_index,

          sales_price / customers AS sales_price_avg,
          cost_price / customers AS cost_price_avg,
          (sales_price - cost_price) / customers AS gross_margin_avg,

          (SQRT(theorical_profit_index * average_profit_index) / 100) AS weighted_profit_index,

          (SELECT AVG(cs.c_wci)
            FROM (
              SELECT
                IF(
                  SUM(sales_price) / (SELECT SUM(sales_price) / COUNT(DISTINCT ${sanitizedGroupBy}) FROM ${table} ${currentWhere}) <= 0
                  OR (SUM(sales_price) - SUM(cost_price)) / (SELECT (SUM(sales_price) - SUM(cost_price)) / COUNT(DISTINCT ${sanitizedGroupBy}) FROM ${table} ${currentWhere}) <= 0,
                  0,
                  SQRT(
                    (SUM(sales_price) / (SELECT SUM(sales_price) / COUNT(DISTINCT ${sanitizedGroupBy}) FROM ${table} ${currentWhere}))
                    * ((SUM(sales_price) - SUM(cost_price)) / (SELECT (SUM(sales_price) - SUM(cost_price)) / COUNT(DISTINCT ${sanitizedGroupBy}) FROM ${table} ${currentWhere}))
                  )
                ) AS c_wci
              FROM ${table}
              ${currentWhere}
              GROUP BY ${sanitizedGroupBy}
            ) AS cs
          ) AS weighted_contribution_index_avg,

          (SELECT AVG(cs.s_idx)
            FROM (
              SELECT SUM(sales_price) / (SELECT SUM(sales_price) / COUNT(DISTINCT ${sanitizedGroupBy}) FROM ${table} ${currentWhere}) AS s_idx
              FROM ${table}
              ${currentWhere}
              GROUP BY ${sanitizedGroupBy}
            ) AS cs
          ) AS sales_con_idx_avg,

          (SELECT AVG(cs.gm_idx)
            FROM (
              SELECT (SUM(sales_price) - SUM(cost_price)) / (SELECT (SUM(sales_price) - SUM(cost_price)) / COUNT(DISTINCT ${sanitizedGroupBy}) FROM ${table} ${currentWhere}) AS gm_idx
              FROM ${table}
              ${currentWhere}
              GROUP BY ${sanitizedGroupBy}
            ) AS cs
          ) AS gross_margin_con_idx_avg

        FROM ${table}
        ${currentWhere}
      ),

      customers_data_last_year AS (
        SELECT
          ${sanitizedGroupBy} AS ${sanitizedGroupBy}_last_year,
          SUM(sales_price) AS sales_price_last_year,
          ROW_NUMBER() OVER (ORDER BY sales_price_last_year DESC) AS sales_position_last_year
        FROM ${table}
        ${previousWhere}
        GROUP BY ${sanitizedGroupBy}
      ),

      customers_data AS (
        SELECT
          ${sanitizedGroupBy},
          SUM(sales_price) AS sales_price,
          SUM(cost_price) AS cost_price,
          COUNT(*) AS transactions,
          ROW_NUMBER() OVER (ORDER BY sales_price DESC) AS sales_position,

          SUM(list_price) / cost_price AS theorical_profit_index,
          sales_price / cost_price AS average_profit_index,

          IF(sales_price = 0, 0, sales_price / transactions) AS sales_price_avg,
          IF(sales_price = 0, 0, (sales_price_avg / sales_price) * 100) AS sales_price_avg_con,

          (sales_price - cost_price) AS gross_margin,
          IF(gross_margin = 0, 0, gross_margin / transactions) AS gross_margin_avg,
          IF(gross_margin = 0, 0, (gross_margin_avg / gross_margin) * 100) AS gross_margin_avg_con,

          (SQRT(theorical_profit_index * average_profit_index) / 100) AS weighted_profit_index,
          (SQRT(sales_price_avg_con * gross_margin_avg_con) / 100) AS weighted_contribution_index
        FROM ${table}
        ${currentWhere}
        GROUP BY ${sanitizedGroupBy}
      )

    SELECT
      customer.sales_price / company.sales_price_avg AS sales_price_con_idx,
      customer.gross_margin / company.gross_margin_avg AS gross_margin_con_idx,

      SQRT(sales_price_con_idx * gross_margin_con_idx) AS weighted_contribution_index,
      customer.weighted_profit_index / company.weighted_profit_index AS weighted_profit_idx_cmp,

      customer.theorical_profit_index / company.theorical_profit_index AS theorical_profit_idx_cmp,
      customer.average_profit_index / company.average_profit_index AS average_profit_idx_cmp,

      IF(customers_last_year = 0, 100, ((customers - customers_last_year) / customers_last_year) * 100) AS customers_evolution,

      (sales_position_last_year / customers_last_year) * 100 AS sales_position_idx_last_year,
      (customer.sales_position / customers) * 100 AS sales_position_idx,
      (sales_position_idx_last_year - (sales_position_idx * (1 + customers_evolution))) / 100 AS weighted_sales_mobility_idx,

      ((customer.sales_price / sales_price_last_year) - 1) * 100 AS sales_evolution_idx,
      (sales_evolution_idx * (1 + weighted_sales_mobility_idx)) / 100 AS weighted_sales_evolution_idx,

      -- VALUE Analysis
      CASE
        WHEN weighted_contribution_index > (2 * weighted_contribution_index_avg) THEN 'A'
        WHEN weighted_contribution_index_avg <= weighted_contribution_index AND weighted_contribution_index <= (2 * weighted_contribution_index_avg) THEN 'B'
        WHEN (0.5 * weighted_contribution_index_avg) <= weighted_contribution_index AND weighted_contribution_index < weighted_contribution_index_avg THEN 'C'
        WHEN weighted_contribution_index < (0.5 * weighted_contribution_index_avg) THEN 'D'
        ELSE 'D'
      END AS value_fine_y,
      CASE
        WHEN (customer.weighted_profit_index / company.weighted_profit_index) > 1.2 THEN 'A'
        WHEN (customer.weighted_profit_index / company.weighted_profit_index) BETWEEN 1.0 AND 1.2 THEN 'B'
        WHEN (customer.weighted_profit_index / company.weighted_profit_index) BETWEEN 0.9 AND 1.0 THEN 'C'
        WHEN (customer.weighted_profit_index / company.weighted_profit_index) < 0.9 THEN 'D'
        ELSE 'D'
      END AS value_fine_x,
      CASE
        WHEN (value_fine_y IN ('A', 'B') AND value_fine_x IN ('A', 'B')) THEN 'Estrella'
        WHEN (value_fine_y IN ('A', 'B') AND value_fine_x IN ('C', 'D')) THEN 'Volumen'
        WHEN (value_fine_y IN ('C', 'D') AND value_fine_x IN ('A', 'B')) THEN 'Margen'
        WHEN (value_fine_y IN ('C', 'D') AND value_fine_x IN ('C', 'D')) THEN 'Duda'
        ELSE 'Unknown'
      END AS value_short,
      CASE
        WHEN value_fine_y = 'A' AND value_fine_x = 'A' THEN 16
        WHEN value_fine_y = 'A' AND value_fine_x = 'B' THEN 15
        WHEN value_fine_y = 'B' AND value_fine_x = 'A' THEN 14
        WHEN value_fine_y = 'B' AND value_fine_x = 'B' THEN 13
        WHEN value_fine_y = 'A' AND value_fine_x = 'C' THEN 12
        WHEN value_fine_y = 'A' AND value_fine_x = 'D' THEN 11
        WHEN value_fine_y = 'B' AND value_fine_x = 'C' THEN 10
        WHEN value_fine_y = 'B' AND value_fine_x = 'D' THEN 9
        WHEN value_fine_y = 'C' AND value_fine_x = 'A' THEN 8
        WHEN value_fine_y = 'C' AND value_fine_x = 'B' THEN 7
        WHEN value_fine_y = 'D' AND value_fine_x = 'A' THEN 6
        WHEN value_fine_y = 'D' AND value_fine_x = 'B' THEN 5
        WHEN value_fine_y = 'C' AND value_fine_x = 'C' THEN 4
        WHEN value_fine_y = 'C' AND value_fine_x = 'D' THEN 3
        WHEN value_fine_y = 'D' AND value_fine_x = 'C' THEN 2
        WHEN value_fine_y = 'D' AND value_fine_x = 'D' THEN 1
        ELSE 0
      END AS value_fine_id,

      -- SALES Analysis
      CASE
        WHEN customer_last_year.${sanitizedGroupBy}_last_year IS NULL OR customer_last_year.${sanitizedGroupBy}_last_year = '' THEN 'X'
        WHEN weighted_sales_evolution_idx > 1 THEN 'A'
        WHEN weighted_sales_evolution_idx >= 0 AND weighted_sales_evolution_idx <= 1 THEN 'B'
        WHEN weighted_sales_evolution_idx >= -0.5 AND weighted_sales_evolution_idx < 0 THEN 'C'
        WHEN weighted_sales_evolution_idx < -0.5 THEN 'D'
        ELSE 'D'
      END AS sales_fine_y,
      CASE
        WHEN sales_price_con_idx > (2 * sales_con_idx_avg) THEN 'A'
        WHEN sales_con_idx_avg <= sales_price_con_idx AND sales_price_con_idx <= (2 * sales_con_idx_avg) THEN 'B'
        WHEN (0.5 * sales_con_idx_avg) <= sales_price_con_idx AND sales_price_con_idx < sales_con_idx_avg THEN 'C'
        WHEN sales_price_con_idx < (0.5 * sales_con_idx_avg) THEN 'D'
        ELSE 'D'
      END AS sales_fine_x,
      CASE
        WHEN (sales_fine_y, sales_fine_x) IN (('A', 'A'), ('A', 'B'), ('B', 'A'), ('B', 'B')) THEN 'Top'
        WHEN (sales_fine_y, sales_fine_x) IN (('A', 'C'), ('A', 'D'), ('B', 'C'), ('B', 'D')) THEN 'Promesa'
        WHEN (sales_fine_y, sales_fine_x) IN (('C', 'A'), ('C', 'B'), ('D', 'A'), ('D', 'B')) THEN 'Riesgo'
        WHEN (sales_fine_y, sales_fine_x) IN (('C', 'C'), ('C', 'D'), ('D', 'C'), ('D', 'D')) THEN 'Coste'
        WHEN (sales_fine_y, sales_fine_x) IN (('X', 'A'), ('X', 'B'), ('X', 'C'), ('X', 'D')) THEN 'Nuevo'
        ELSE 'Unknown'
      END AS sales_short,
      CASE
        WHEN sales_fine_y = 'A' AND sales_fine_x = 'A' THEN 16
        WHEN sales_fine_y = 'A' AND sales_fine_x = 'B' THEN 15
        WHEN sales_fine_y = 'B' AND sales_fine_x = 'A' THEN 14
        WHEN sales_fine_y = 'B' AND sales_fine_x = 'B' THEN 13
        WHEN sales_fine_y = 'A' AND sales_fine_x = 'C' THEN 12
        WHEN sales_fine_y = 'A' AND sales_fine_x = 'D' THEN 11
        WHEN sales_fine_y = 'B' AND sales_fine_x = 'C' THEN 10
        WHEN sales_fine_y = 'B' AND sales_fine_x = 'D' THEN 9
        WHEN sales_fine_y = 'C' AND sales_fine_x = 'A' THEN 8
        WHEN sales_fine_y = 'C' AND sales_fine_x = 'B' THEN 7
        WHEN sales_fine_y = 'D' AND sales_fine_x = 'A' THEN 6
        WHEN sales_fine_y = 'D' AND sales_fine_x = 'B' THEN 5
        WHEN sales_fine_y = 'C' AND sales_fine_x = 'C' THEN 4
        WHEN sales_fine_y = 'C' AND sales_fine_x = 'D' THEN 3
        WHEN sales_fine_y = 'D' AND sales_fine_x = 'C' THEN 2
        WHEN sales_fine_y = 'D' AND sales_fine_x = 'D' THEN 1
        WHEN sales_fine_y = 'X' AND sales_fine_x = 'A' THEN -1
        WHEN sales_fine_y = 'X' AND sales_fine_x = 'B' THEN -2
        WHEN sales_fine_y = 'X' AND sales_fine_x = 'C' THEN -3
        WHEN sales_fine_y = 'X' AND sales_fine_x = 'D' THEN -4
        ELSE 0
      END AS sales_fine_id,

      -- PROFIT Analysis
      CASE
        WHEN weighted_profit_idx_cmp > 1.2 THEN 'A'
        WHEN weighted_profit_idx_cmp >= 1.0 AND weighted_profit_idx_cmp <= 1.2 THEN 'B'
        WHEN weighted_profit_idx_cmp >= 0.9 AND weighted_profit_idx_cmp < 1.0 THEN 'C'
        WHEN weighted_profit_idx_cmp < 0.9 THEN 'D'
        ELSE 'D'
      END AS profit_fine_y,
      CASE
        WHEN gross_margin_con_idx > (2 * gross_margin_con_idx_avg) THEN 'A'
        WHEN gross_margin_con_idx_avg <= gross_margin_con_idx AND gross_margin_con_idx <= (2 * gross_margin_con_idx_avg) THEN 'B'
        WHEN (0.5 * gross_margin_con_idx_avg) <= gross_margin_con_idx AND gross_margin_con_idx < gross_margin_con_idx_avg THEN 'C'
        WHEN gross_margin_con_idx < (0.5 * gross_margin_con_idx_avg) THEN 'D'
        ELSE 'D'
      END AS profit_fine_x,
      CASE
        WHEN (profit_fine_y, profit_fine_x) IN (('A', 'A'), ('A', 'B'), ('B', 'A')) THEN 'Alta'
        WHEN (profit_fine_y, profit_fine_x) IN (('A', 'C'), ('A', 'D'), ('B', 'B'), ('B', 'C'),
                                  ('B', 'D'), ('C', 'A'), ('C', 'B'), ('C', 'C'),
                                  ('D', 'A'), ('D', 'B')) THEN 'Media'
        WHEN (profit_fine_y, profit_fine_x) IN (('C', 'D'), ('D', 'C'), ('D', 'D')) THEN 'Baja'
      END AS profit_short,
      CASE
        WHEN profit_fine_y = 'A' AND profit_fine_x = 'A' THEN 16
        WHEN profit_fine_y = 'A' AND profit_fine_x = 'B' THEN 15
        WHEN profit_fine_y = 'B' AND profit_fine_x = 'A' THEN 14
        WHEN profit_fine_y = 'B' AND profit_fine_x = 'B' THEN 13
        WHEN profit_fine_y = 'A' AND profit_fine_x = 'C' THEN 12
        WHEN profit_fine_y = 'A' AND profit_fine_x = 'D' THEN 11
        WHEN profit_fine_y = 'B' AND profit_fine_x = 'C' THEN 10
        WHEN profit_fine_y = 'B' AND profit_fine_x = 'D' THEN 9
        WHEN profit_fine_y = 'C' AND profit_fine_x = 'A' THEN 8
        WHEN profit_fine_y = 'C' AND profit_fine_x = 'B' THEN 7
        WHEN profit_fine_y = 'D' AND profit_fine_x = 'A' THEN 6
        WHEN profit_fine_y = 'D' AND profit_fine_x = 'B' THEN 5
        WHEN profit_fine_y = 'C' AND profit_fine_x = 'C' THEN 4
        WHEN profit_fine_y = 'C' AND profit_fine_x = 'D' THEN 3
        WHEN profit_fine_y = 'D' AND profit_fine_x = 'C' THEN 2
        WHEN profit_fine_y = 'D' AND profit_fine_x = 'D' THEN 1
        ELSE 0
      END AS profit_fine_id,

      -- QUALITY Analysis
      CASE
        WHEN theorical_profit_idx_cmp > 1.2 THEN 'A'
        WHEN theorical_profit_idx_cmp >= 1.0 AND theorical_profit_idx_cmp <= 1.2 THEN 'B'
        WHEN theorical_profit_idx_cmp >= 0.9 AND theorical_profit_idx_cmp < 1.0 THEN 'C'
        WHEN theorical_profit_idx_cmp < 0.9 THEN 'D'
        ELSE 'D'
      END AS quality_fine_y,
      CASE
        WHEN average_profit_idx_cmp > 1.2 THEN 'A'
        WHEN average_profit_idx_cmp >= 1.0 AND average_profit_idx_cmp <= 1.2 THEN 'B'
        WHEN average_profit_idx_cmp >= 0.9 AND average_profit_idx_cmp < 1.0 THEN 'C'
        WHEN average_profit_idx_cmp < 0.9 THEN 'D'
        ELSE 'D'
      END AS quality_fine_x,
      CASE
        WHEN (quality_fine_y, quality_fine_x) IN (('A', 'A'), ('A', 'B'), ('B', 'A'), ('B', 'B')) THEN 'Óptima'
        WHEN (quality_fine_y, quality_fine_x) IN (('A', 'C'), ('A', 'D'), ('B', 'C'), ('B', 'D')) THEN 'De producto'
        WHEN (quality_fine_y, quality_fine_x) IN (('C', 'A'), ('C', 'B'), ('D', 'A'), ('D', 'B')) THEN 'De precio'
        WHEN (quality_fine_y, quality_fine_x) IN (('C', 'C'), ('C', 'D'), ('D', 'C'), ('D', 'D')) THEN 'Pésima'
      END AS quality_short,
      CASE
        WHEN quality_fine_y = 'A' AND quality_fine_x = 'A' THEN 16
        WHEN quality_fine_y = 'A' AND quality_fine_x = 'B' THEN 15
        WHEN quality_fine_y = 'B' AND quality_fine_x = 'A' THEN 14
        WHEN quality_fine_y = 'B' AND quality_fine_x = 'B' THEN 13
        WHEN quality_fine_y = 'A' AND quality_fine_x = 'C' THEN 12
        WHEN quality_fine_y = 'A' AND quality_fine_x = 'D' THEN 11
        WHEN quality_fine_y = 'B' AND quality_fine_x = 'C' THEN 10
        WHEN quality_fine_y = 'B' AND quality_fine_x = 'D' THEN 9
        WHEN quality_fine_y = 'C' AND quality_fine_x = 'A' THEN 8
        WHEN quality_fine_y = 'C' AND quality_fine_x = 'B' THEN 7
        WHEN quality_fine_y = 'D' AND quality_fine_x = 'A' THEN 6
        WHEN quality_fine_y = 'D' AND quality_fine_x = 'B' THEN 5
        WHEN quality_fine_y = 'C' AND quality_fine_x = 'C' THEN 4
        WHEN quality_fine_y = 'C' AND quality_fine_x = 'D' THEN 3
        WHEN quality_fine_y = 'D' AND quality_fine_x = 'C' THEN 2
        WHEN quality_fine_y = 'D' AND quality_fine_x = 'D' THEN 1
        ELSE 0
      END AS quality_fine_id

    FROM customers_data AS customer
    LEFT JOIN customers_data_last_year AS customer_last_year
      ON customer.${sanitizedGroupBy} = customer_last_year.${sanitizedGroupBy}_last_year
    CROSS JOIN company_data AS company
    CROSS JOIN company_data_last_year AS company_last_year
    WHERE customer.${sanitizedGroupBy} = {entity_id:String}
  `;

  return { query, queryParams };
}
