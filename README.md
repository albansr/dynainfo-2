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
curl http://localhost:5002/health

# API info
curl http://localhost:5002/

# Balance sheet
curl "http://localhost:5002/api/v1/balance?startDate=2026-01-01&endDate=2026-12-31"

# List with grouping
curl "http://localhost:5002/api/v1/list?groupBy=region,product&limit=10"
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
curl "http://localhost:5002/api/v1/balance?startDate=2026-01-01&endDate=2026-12-31&region=EU,NA"
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
curl "http://localhost:5002/api/v1/list?startDate=2026-01-01&groupBy=region,product&limit=20&orderBy=total_amount&orderDirection=DESC"
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
curl "http://localhost:5002/api/v1/labels/region?table=sales"
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
PORT=5002
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

## Production Deployment

### TL;DR - Quick Start

```bash
# 1. Configure environment
cp api/.env.example api/.env
# Edit api/.env with production values

# 2. Ensure SSL certificates are in place
ls api/ssl/  # Should show: dynainfo.key, dynainfo.crt, ca.crt

# 3. Deploy everything
make deploy

# Done! ✅
```

### Prerequisites for Production

1. **SSL Certificates**: Required for HTTPS
   - Server certificate: `api/ssl/dynainfo.crt`
   - Private key: `api/ssl/dynainfo.key` (will be auto-fixed to 600 permissions)
   - CA chain: `api/ssl/ca.crt`

2. **Environment Variables**: Configure in `api/.env`
   ```bash
   NODE_ENV=production
   PORT=5002
   ORIGIN_URL=https://dynainfo.com.co
   POSTGRES_PASSWORD=strong_production_password
   CLICKHOUSE_HOST=your_clickhouse_host
   CLICKHOUSE_PASSWORD=your_clickhouse_password
   BETTER_AUTH_SECRET=generate-with-openssl-rand-base64-32
   RESEND_API_KEY=your_resend_api_key
   ```

> **Note**: The `make deploy` command automatically validates all these requirements before deploying.

### SSL Certificate Setup

#### Using Existing Certificates

If you already have SSL certificates (from Sectigo, Let's Encrypt, etc.):

```bash
# Copy certificates to the api/ssl/ directory
mkdir -p api/ssl
cp /path/to/your.key api/ssl/dynainfo.key
cp /path/to/your.crt api/ssl/dynainfo.crt
cp /path/to/ca-bundle.crt api/ssl/ca.crt

# Set restrictive permissions on private key
chmod 600 api/ssl/dynainfo.key
```

#### Certificate Requirements

- **Format**: PEM encoded
- **Key Type**: RSA 2048-bit or higher
- **Certificate Chain**: Must include intermediate certificates in ca.crt
- **Domain**: Must match your API domain (e.g., api.dynainfo.com.co)

#### Certificate Renewal

When your certificates expire, replace them in the `api/ssl/` directory:

```bash
# Stop the production server
make prod-down

# Replace certificates
cp /path/to/new-cert.crt api/ssl/dynainfo.crt
cp /path/to/new-key.key api/ssl/dynainfo.key
cp /path/to/new-ca.crt api/ssl/ca.crt

# Set permissions
chmod 600 api/ssl/dynainfo.key

# Rebuild and restart
make prod
```

### Production Commands

```bash
# Deployment
make deploy            # 🚀 Full automated deployment (recommended)
make deploy-check      # ✅ Check production requirements only
make deploy-db         # 💾 Setup database only

# Container management
make prod              # Build and start production environment
make prod-build        # Build production Docker image
make prod-up           # Start production services
make prod-down         # Stop production services
make prod-logs         # View production logs
make prod-restart      # Restart production services
```

### Quick Deployment (Recommended)

Use the automated deployment command that does everything:

```bash
make deploy
```

This single command will:
1. ✅ Check all requirements (.env, SSL certificates, Docker, etc.)
2. 🛑 Stop existing containers
3. 🔨 Build production image (clean build)
4. 🚀 Start PostgreSQL + API services
5. 💾 Setup database (schema + seed)
6. 🧪 Run health checks

The API will be available at:
- **HTTPS**: https://localhost (port 443)
- **Health**: https://localhost/health
- **API Docs**: https://localhost/docs

### Manual Deployment Steps

If you prefer to run steps individually:

```bash
make deploy-check      # Check all requirements
make prod-build        # Build production image
make prod-up           # Start services
make deploy-db         # Setup database
```

### Production Architecture

```
┌─────────────────┐
│   HTTPS Client  │
│  (Port 443)     │
└────────┬────────┘
         │
         │ TLS/SSL
         ▼
┌─────────────────┐
│  Docker Host    │
│  Port 443:5002  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  Fastify Container      │
│  - HTTPS Server         │
│  - Port 5002            │
│  - SSL Certificates     │
│  - NODE_ENV=production  │
└────────┬────────────────┘
         │
         ▼
┌─────────────────┐
│  PostgreSQL     │
│  (Auth DB)      │
└─────────────────┘
```

### Production vs Development Differences

| Feature | Development | Production |
|---------|-------------|------------|
| Protocol | HTTP | HTTPS |
| Port (Internal) | 5002 | 5002 |
| Port (External) | 5002 | 443 |
| SSL Certificates | Not required | Required |
| CORS Origin | All origins (`*`) | Single origin (ORIGIN_URL) |
| Rate Limiting | 1000 req/min | 100 req/min |
| Logging | Debug with colors | Info (JSON) |
| Hot Reload | Yes (tsx watch) | No (compiled) |
| Docker Compose | `docker-compose.yml` | `docker-compose.production.yml` |

### Security Considerations

1. **SSL/TLS**: Always use HTTPS in production (enabled by default)
2. **Certificate Permissions**: Private key must have 600 permissions
3. **CORS**: Configure ORIGIN_URL to your frontend domain only
4. **Secrets**: Never commit `.env` file to git
5. **Database Passwords**: Use strong, unique passwords
6. **Rate Limiting**: Adjust based on your needs (default: 100 req/min)
7. **Firewall**: Only expose port 443 (HTTPS)

### Monitoring Production

```bash
# View logs
make prod-logs

# Check health endpoint
curl -k https://localhost/health

# View specific service logs
docker compose -f api/docker-compose.production.yml logs -f api

# Check running containers
docker ps | grep dynainfo
```

### Troubleshooting Production

#### SSL Certificate Errors

```bash
# Verify certificate files exist
ls -la api/ssl/

# Check certificate details
openssl x509 -in api/ssl/dynainfo.crt -text -noout

# Verify certificate chain
openssl verify -CAfile api/ssl/ca.crt api/ssl/dynainfo.crt

# Test SSL connection
openssl s_client -connect localhost:443 -servername api.dynainfo.com.co
```

#### Container Issues

```bash
# Check container logs
make prod-logs

# Rebuild from scratch
make prod-down
docker system prune -f
make prod-build
make prod-up

# Access container shell
docker exec -it dynainfo-api-prod sh
```

#### Database Connection Issues

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Test database connection
docker exec -it dynainfo-postgres-prod psql -U dynainfo -d dynainfo

# Check database logs
docker compose -f api/docker-compose.production.yml logs postgres
```

### Backup and Recovery

```bash
# Backup PostgreSQL database
docker exec dynainfo-postgres-prod pg_dump -U dynainfo dynainfo > backup.sql

# Restore PostgreSQL database
cat backup.sql | docker exec -i dynainfo-postgres-prod psql -U dynainfo -d dynainfo

# Backup SSL certificates (recommended)
tar -czf ssl-backup.tar.gz api/ssl/
```

## Roadmap

- [x] Balance sheet endpoint
- [x] List endpoint with aggregations
- [x] Column labels endpoint
- [x] React frontend with data visualization
- [x] Authentication & authorization (Better Auth + Email OTP)
- [x] Production deployment with SSL/HTTPS
- [ ] WebSocket support for real-time updates
- [ ] Query result caching (Redis)
- [ ] Data export (CSV, JSON, Excel)

## License

MIT
