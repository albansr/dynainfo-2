# DynaInfo 2.0 - Production Deployment Guide

## Quick Deployment (3 Steps)

```bash
# 1. Configure environment
cp api/.env.example api/.env
vim api/.env  # Edit with your production values

# 2. Deploy
make deploy

# 3. Test
curl -k https://localhost/health
```

That's it! 🎉

---

## What `make deploy` Does

The `make deploy` command is a complete automated deployment pipeline:

### Step 1: Pre-Deployment Checks ✅
- Validates `api/.env` exists
- Checks `NODE_ENV=production`
- Verifies `ORIGIN_URL` is configured
- Validates SSL certificates exist (dynainfo.key, dynainfo.crt, ca.crt)
- Auto-fixes certificate permissions (chmod 600)
- Checks certificate expiration date
- Validates all required environment variables
- Verifies Docker is installed and running

### Step 2: Container Management 🛑
- Stops existing production containers gracefully
- Cleans up old containers

### Step 3: Build 🔨
- Builds fresh production Docker image
- Includes SSL certificates
- Compiles TypeScript to JavaScript
- Optimizes for production (no dev dependencies)

### Step 4: Start Services 🚀
- Starts PostgreSQL database
- Starts API with HTTPS
- Waits for services to be healthy

### Step 5: Database Setup 💾
- Waits for PostgreSQL to be ready
- Applies database schema (Drizzle ORM)
- Seeds initial data (superadmin user)

### Step 6: Health Check 🧪
- Tests API endpoint (up to 30 attempts)
- Verifies HTTPS is working
- Confirms database connection

### Step 7: Success Report ✅
- Shows service information
- Displays URLs (health, docs)
- Shows CORS origin
- Shows certificate expiration
- Provides quick command reference

---

## Environment Configuration

### Required Variables

Create `api/.env` with these values:

```bash
# Server Configuration
PORT=5002
HOST=0.0.0.0
NODE_ENV=production

# CORS (Your Vercel frontend URL)
ORIGIN_URL=https://dynainfo.com.co

# Database Configuration
TABLE_PREFIX=dyna_
POSTGRES_URL=postgresql://dynainfo:STRONG_PASSWORD@localhost:5432/dynainfo
POSTGRES_PASSWORD=STRONG_PASSWORD

# ClickHouse (External)
CLICKHOUSE_HOST=10.10.20.12
CLICKHOUSE_PORT=8123
CLICKHOUSE_DATABASE=default
CLICKHOUSE_USERNAME=your_username
CLICKHOUSE_PASSWORD=your_password

# Authentication
BETTER_AUTH_SECRET=your-secret-here-use-openssl-rand-base64-32
BETTER_AUTH_URL=https://api.dynainfo.com.co

# Email Service
RESEND_API_KEY=re_your_key_here

# Seed Data (Optional)
SUPERADMIN_EMAIL=admin@dynainfo.com
SUPERADMIN_NAME=Super Admin
```

### Generate Secrets

```bash
# Generate BETTER_AUTH_SECRET
openssl rand -base64 32

# Generate POSTGRES_PASSWORD
openssl rand -hex 16
```

---

## SSL Certificates

### Certificate Files

The API expects three certificate files in `api/ssl/`:

```
api/ssl/
├── dynainfo.key        # Private key (RSA 2048-bit)
├── dynainfo.crt        # Server certificate
└── ca.crt              # CA chain (intermediate + root)
```

### Current Certificates

- **Domain**: api.dynainfo.com.co
- **Issuer**: Sectigo Public Server Authentication CA DV R36
- **Valid Until**: August 12, 2026
- **Type**: Domain Validated (DV)

### Certificate Renewal

When certificates expire (August 2026):

```bash
# 1. Obtain new certificates from Sectigo (or your provider)
# 2. Stop the API
make prod-down

# 3. Replace certificates
cp new-cert.key api/ssl/dynainfo.key
cp new-cert.crt api/ssl/dynainfo.crt
cp new-ca.crt api/ssl/ca.crt

# 4. Redeploy
make deploy
```

---

## Deployment Scenarios

### First-Time Deployment

```bash
# On production server
git clone <repository>
cd new-dynainfo

# Configure
cp api/.env.example api/.env
vim api/.env

# Ensure certificates exist
ls -la api/ssl/

# Deploy
make deploy
```

### Update Existing Deployment

```bash
# Pull latest changes
git pull origin main

# Redeploy (will rebuild everything)
make deploy
```

### Rollback

```bash
# Checkout previous version
git checkout <previous-commit>

# Redeploy
make deploy
```

---

## Manual Deployment Steps

If you need more control, run steps individually:

```bash
# 1. Check requirements
make deploy-check

# 2. Build image
make prod-build

# 3. Start services
make prod-up

# 4. Setup database (first time only)
make deploy-db

# 5. View logs
make prod-logs
```

---

## Verification & Testing

### Health Check

```bash
# From server
curl -k https://localhost/health

# From external
curl https://api.dynainfo.com.co/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-02-25T12:00:00.000Z",
  "uptime": 3600,
  "responseTime": "150ms",
  "database": {
    "connected": true,
    "responseTime": "50ms"
  },
  "memory": {
    "heapUsed": "45 MB",
    "heapTotal": "60 MB",
    "rss": "120 MB"
  }
}
```

### API Documentation

```bash
# Open in browser
https://api.dynainfo.com.co/docs
```

### Test Authentication

```bash
# Send OTP
curl -X POST https://api.dynainfo.com.co/api/auth/email-otp/send-verification-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dynainfo.com"}'

# Should return: { "success": true }
```

### Test Analytics Endpoint

```bash
# Balance sheet
curl "https://api.dynainfo.com.co/api/balance?startDate=2025-01-01&endDate=2025-12-31" \
  -H "Cookie: session_token=YOUR_TOKEN"
```

---

## Monitoring

### View Logs

```bash
# All logs
make prod-logs

# API logs only
docker compose -f api/docker-compose.production.yml logs -f api

# PostgreSQL logs
docker compose -f api/docker-compose.production.yml logs -f postgres

# Last 100 lines
docker compose -f api/docker-compose.production.yml logs --tail=100 api
```

### Check Running Containers

```bash
# List containers
docker ps | grep dynainfo

# Expected output:
# dynainfo-api-prod       (port 443:5002)
# dynainfo-postgres-prod  (port 5432)
```

### Container Shell Access

```bash
# Access API container
docker exec -it dynainfo-api-prod sh

# Access PostgreSQL
docker exec -it dynainfo-postgres-prod psql -U dynainfo -d dynainfo
```

---

## Troubleshooting

### Deployment Fails at Check Step

```bash
# Run checks to see what's missing
make deploy-check

# Fix issues and retry
make deploy
```

### SSL Certificate Errors

```bash
# Verify certificates
openssl x509 -in api/ssl/dynainfo.crt -text -noout
openssl rsa -in api/ssl/dynainfo.key -check

# Check certificate chain
openssl verify -CAfile api/ssl/ca.crt api/ssl/dynainfo.crt

# Test SSL connection
openssl s_client -connect localhost:443 -servername api.dynainfo.com.co
```

### Database Connection Errors

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check logs
make prod-logs

# Try connecting manually
docker exec -it dynainfo-postgres-prod psql -U dynainfo -d dynainfo

# Restart database
docker compose -f api/docker-compose.production.yml restart postgres
```

### API Not Responding

```bash
# Check logs for errors
make prod-logs

# Check if port 443 is bound
sudo lsof -i :443

# Restart API
make prod-restart

# Rebuild from scratch
make prod-down
docker system prune -f
make deploy
```

### ClickHouse Connection Errors

```bash
# Test connection from container
docker exec -it dynainfo-api-prod sh
curl http://10.10.20.12:8123/

# Check environment variables
docker exec dynainfo-api-prod env | grep CLICKHOUSE
```

---

## Backup & Recovery

### Backup Database

```bash
# PostgreSQL backup
docker exec dynainfo-postgres-prod pg_dump -U dynainfo dynainfo > backup-$(date +%Y%m%d).sql

# Backup SSL certificates
tar -czf ssl-backup-$(date +%Y%m%d).tar.gz api/ssl/

# Backup .env
cp api/.env api/.env.backup
```

### Restore Database

```bash
# Stop API
make prod-down

# Restore
cat backup-20250225.sql | docker exec -i dynainfo-postgres-prod psql -U dynainfo -d dynainfo

# Restart
make prod-up
```

---

## Performance Tuning

### PostgreSQL

Edit `docker-compose.production.yml`:

```yaml
environment:
  POSTGRES_MAX_CONNECTIONS: 100
  POSTGRES_SHARED_BUFFERS: 256MB
  POSTGRES_EFFECTIVE_CACHE_SIZE: 1GB
```

### API Rate Limiting

Edit `api/src/server.ts` rateLimitConfig:

```typescript
max: 200,  // Increase from 100
timeWindow: '1 minute'
```

---

## Security Checklist

Before going live:

- [ ] `NODE_ENV=production` in .env
- [ ] Strong `POSTGRES_PASSWORD` (16+ chars)
- [ ] `BETTER_AUTH_SECRET` generated with openssl
- [ ] `ORIGIN_URL` set to your actual frontend domain
- [ ] SSL certificates valid and not expired
- [ ] Firewall: Only port 443 exposed
- [ ] `.env` file not committed to git
- [ ] Database backups configured
- [ ] SSL certificate renewal reminder set

---

## Support

If deployment fails:

1. Check logs: `make prod-logs`
2. Run checks: `make deploy-check`
3. Review this guide
4. Check GitHub issues

---

## Architecture

```
Internet (Port 443)
        │
        ├─► Docker Host
        │   ├─► dynainfo-api-prod (HTTPS on 5002)
        │   │   ├─► Fastify Server
        │   │   ├─► SSL Certificates
        │   │   └─► Better Auth
        │   │
        │   └─► dynainfo-postgres-prod
        │       └─► Authentication DB
        │
        └─► External ClickHouse (10.10.20.12:8123)
            └─► Analytics Data
```

---

## FAQ

**Q: Do I need to install PostgreSQL separately?**
A: No, it's included in docker-compose.production.yml and starts automatically.

**Q: What's the difference between `make prod` and `make deploy`?**
A: `make deploy` includes pre-checks, database setup, and health verification. `make prod` just builds and starts.

**Q: Can I deploy without SSL?**
A: No, SSL is required in production. The API won't start without certificates when NODE_ENV=production.

**Q: How do I update just the API code?**
A: `git pull && make deploy`

**Q: Where is the frontend deployed?**
A: Frontend is on Vercel. This is only for the API backend.

**Q: How do I change the domain?**
A: Update `ORIGIN_URL` in .env and get new SSL certificates for your domain.

**Q: Can I use Let's Encrypt certificates?**
A: Yes! Just place the cert.pem as dynainfo.crt, privkey.pem as dynainfo.key, and chain.pem as ca.crt.

---

**Last Updated**: February 25, 2025
**API Version**: 2.0
**Certificate Expiry**: August 12, 2026
