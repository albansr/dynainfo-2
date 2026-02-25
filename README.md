# DynaInfo - Data Visualization Platform

Modern data visualization application built with React, Fastify, and ClickHouse.

## Architecture

```
new-dynainfo/
├── api/                    # Fastify API (Node.js 22 + TypeScript)
│   ├── src/
│   │   ├── db/            # Database client & query builder
│   │   ├── repositories/  # Data access layer
│   │   ├── services/      # Business logic
│   │   ├── routes/        # API endpoints
│   │   ├── types/         # TypeScript types
│   │   └── utils/         # Utilities & filters
│   └── Dockerfile
├── web/                    # React frontend (coming soon)
├── docker-compose.yml
└── Makefile
```

## Tech Stack

### Backend
- **Fastify 5** - High-performance web framework
- **ClickHouse** - Columnar database for analytics (external)
- **TypeScript 5.7** - Type-safe development
- **Zod** - Runtime validation
- **Custom Query Builder** - Dynamic query generation with type safety

### Architecture Pattern
- **Service Layer**: Business logic and data combination
- **Repository Layer**: Database queries with QueryBuilder
- **Routes Layer**: HTTP endpoints (GET only)

### Features
- ✅ Dynamic filters with multiple operators (eq, in, between, like, etc.)
- ✅ Aggregations (count, sum, avg, min, max, uniq)
- ✅ Multi-dimensional GROUP BY
- ✅ Parallel query execution for performance
- ✅ Type-safe query building
- ✅ Performance optimized for analytics workloads
- ✅ Docker-based development environment

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 22+ (for local development)
- Make
- ClickHouse database (external, configured via .env)

### 1. Configure environment

Copy `.env.example` to `.env` in the `api/` directory and configure your ClickHouse connection:

```bash
cd api
cp .env.example .env
# Edit .env with your ClickHouse credentials
```

### 2. Install dependencies

```bash
make install
```

### 3. Start the API

```bash
# With Docker
make dev

# Or locally
make api-dev
```

### 4. Test the API

```bash
# Health check
curl http://localhost:3000/health

# API info
curl http://localhost:3000/

# Balance sheet
curl "http://localhost:3000/api/v1/balance?startDate=2026-01-01&endDate=2026-12-31"

# List with grouping
curl "http://localhost:3000/api/v1/list?groupBy=region,product&limit=10"
```

## API Documentation

### Endpoints

#### Health Check
```bash
GET /health
```

Returns server and database health status.

#### API Info
```bash
GET /
```

Returns API information and available endpoints.

#### Balance Sheet
```bash
GET /api/v1/balance
```

Get balance sheet with sales, budget, and orders data.

**Query Parameters:**
- `startDate` (optional): Start date filter (ISO date string)
- `endDate` (optional): End date filter (ISO date string)
- `region` (optional): Comma-separated regions filter
- `product` (optional): Comma-separated products filter
- `category` (optional): Comma-separated categories filter

**Example:**
```bash
curl "http://localhost:3000/api/v1/balance?startDate=2026-01-01&endDate=2026-12-31&region=EU,NA"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total_sales": 100000,
    "total_budget": 120000,
    "total_orders": 95000,
    "sales_plus_orders": 195000,
    "variance": -20000,
    "variance_pct": -16.67,
    "budget_achievement": 83.33,
    "order_fulfillment": 95.0
  }
}
```

#### List with Aggregations
```bash
GET /api/v1/list
```

Get aggregated list with grouping and filtering.

**Query Parameters:**
- `startDate` (optional): Start date filter
- `endDate` (optional): End date filter
- `region` (optional): Comma-separated regions
- `product` (optional): Comma-separated products
- `category` (optional): Comma-separated categories
- `groupBy` (optional): Comma-separated fields to group by (default: region)
- `limit` (optional): Number of results (default: 100, max: 1000)
- `offset` (optional): Pagination offset (default: 0)
- `orderBy` (optional): Field to order by (default: total_amount)
- `orderDirection` (optional): ASC or DESC (default: DESC)

**Example:**
```bash
curl "http://localhost:3000/api/v1/list?startDate=2026-01-01&groupBy=region,product&limit=20&orderBy=total_amount&orderDirection=DESC"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "region": "EU",
      "product": "Product A",
      "total_amount": 50000,
      "total_quantity": 1000,
      "avg_amount": 50,
      "count": 500
    },
    ...
  ],
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

#### Column Labels
```bash
GET /api/v1/labels/:column
```

Get unique values for a specific column (useful for filter dropdowns).

**Query Parameters:**
- `table` (optional): Table to query (sales, budget, orders) - default: sales

**Example:**
```bash
curl "http://localhost:3000/api/v1/labels/region?table=sales"
```

**Response:**
```json
{
  "success": true,
  "column": "region",
  "table": "sales",
  "values": ["EU", "NA", "APAC", "LATAM"],
  "count": 4
}
```

## Database Schema (Expected)

The API expects the following tables in your external ClickHouse database.

**Note**: If your tables have a prefix (e.g., `dyna_sales`, `dyna_budget`, `dyna_orders`), configure it in the `TABLE_PREFIX` environment variable.

### sales (or {prefix}sales)
```sql
CREATE TABLE dyna_sales (
    date Date,
    region String,
    product String,
    category String,
    amount Float32,
    quantity Int32
) ENGINE = MergeTree()
ORDER BY date;
```

### budget (or {prefix}budget)
```sql
CREATE TABLE dyna_budget (
    date Date,
    region String,
    product String,
    category String,
    amount Float32,
    quantity Int32
) ENGINE = MergeTree()
ORDER BY date;
```

### orders (or {prefix}orders)
```sql
CREATE TABLE dyna_orders (
    date Date,
    region String,
    product String,
    category String,
    amount Float32,
    quantity Int32
) ENGINE = MergeTree()
ORDER BY date;
```

## Development

### Local development (without Docker)

```bash
# Install dependencies
make install

# Run API in development mode with hot reload
make api-dev
```

### Available Make commands

```bash
make help              # Show all available commands
make install           # Install dependencies
make dev               # Start development environment
make build             # Build Docker images
make up                # Start all services
make down              # Stop all services
make logs              # Show logs from all services
make logs-api          # Show API logs
make clean             # Clean up everything
make api-dev           # Run API locally (without Docker)
make api-build         # Build API TypeScript
make api-type-check    # Type check API code
make restart           # Restart all services
make status            # Show status of all services
```

## Environment Variables

Copy `.env.example` to `.env` in the `api/` directory:

```bash
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

TABLE_PREFIX=dyna_

CLICKHOUSE_HOST=http://your-clickhouse-host:8123
CLICKHOUSE_PORT=8123
CLICKHOUSE_DATABASE=your_database
CLICKHOUSE_USERNAME=your_username
CLICKHOUSE_PASSWORD=your_password
```

**TABLE_PREFIX**: Prefix for table names in ClickHouse. For example, if `TABLE_PREFIX=dyna_`, the API will query `dyna_sales`, `dyna_budget`, and `dyna_orders` tables. Leave empty if tables don't have a prefix.

## Performance

The API uses **parallel query execution** for balance sheet calculations:
- 3 queries executed in parallel (sales, budget, orders)
- Typical response time: ~150-250ms for 10M+ rows per table
- All calculations (variance, percentages) done in-memory after queries

## Query Builder

The custom query builder supports:
- Dynamic filters with 12 operators
- Aggregations (sum, count, avg, min, max, uniq, uniqExact)
- Multi-dimensional grouping
- Time-series grouping
- Parameterized queries (SQL injection safe)
- Type-safe operations

**Example:**
```typescript
const result = await new QueryBuilder(client)
  .table('sales')
  .filter([
    { field: 'date', operator: 'gte', value: '2026-01-01' },
    { field: 'region', operator: 'in', value: ['EU', 'NA'] }
  ])
  .aggregate([
    { function: 'sum', field: 'amount', alias: 'total' }
  ])
  .execute();
```

## Project Structure

```
api/src/
├── types/
│   └── balance.types.ts      # TypeScript types and interfaces
├── repositories/
│   └── balance.repository.ts # Database queries
├── services/
│   └── balance.service.ts    # Business logic
├── routes/
│   └── balance.routes.ts     # HTTP endpoints
├── db/
│   ├── client.ts            # ClickHouse client
│   └── query-builder.ts     # Query builder
└── utils/
    └── filters.ts           # Filter utilities
```

## Best Practices

1. **Filters**: Always use the filter system, never string concatenation
2. **Parallel Queries**: Use Promise.all() for independent queries
3. **Business Logic**: Keep it in services, not repositories
4. **Type Safety**: Use TypeScript types for all data structures
5. **Error Handling**: Always catch and log errors properly

## Roadmap

- [x] Balance sheet endpoint
- [x] List endpoint with aggregations
- [x] Column labels endpoint
- [ ] React frontend with data visualization
- [ ] WebSocket support for real-time updates
- [ ] Query result caching (Redis)
- [ ] Authentication & authorization
- [ ] Data export (CSV, JSON, Excel)

## License

MIT
