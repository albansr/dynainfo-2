# Colors for fancy output
RED := \033[31m
GREEN := \033[32m
YELLOW := \033[33m
BLUE := \033[34m
MAGENTA := \033[35m
CYAN := \033[36m
WHITE := \033[37m
BOLD := \033[1m
RESET := \033[0m

# Docker Compose configuration
COMPOSE := docker compose

# Project configuration
PROJECT_NAME := DynaInfo API

.PHONY: help setup dev up down logs logs-api logs-web restart test test-coverage db-push db-studio db-seed lint clean status prod prod-build prod-up prod-down prod-logs prod-restart deploy deploy-check deploy-db setup-prod

# Default target
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "$(BOLD)$(CYAN)$(PROJECT_NAME) - Development Environment$(RESET)"
	@echo "$(BLUE)═══════════════════════════════════════════════════$(RESET)"
	@echo ""
	@echo "$(BOLD)Available commands:$(RESET)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z0-9_-]+:.*##/ { \
		printf "  $(GREEN)%-16s$(RESET) %s\n", $$1, $$2 \
	}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(YELLOW)Quick Start:$(RESET)"
	@echo "  $(WHITE)make setup$(RESET)           # First time setup (install deps + db setup)"
	@echo "  $(WHITE)make dev$(RESET)             # Start local dev (DB in Docker, API local)"
	@echo "  $(WHITE)make up$(RESET)              # Start all services in Docker"
	@echo "  $(WHITE)make test$(RESET)            # Run tests"
	@echo ""
	@echo "$(YELLOW)Examples:$(RESET)"
	@echo "  $(WHITE)make dev$(RESET)             # Local dev with hot reload (access ClickHouse)"
	@echo "  $(WHITE)make up$(RESET)              # All services in Docker"
	@echo "  $(WHITE)make test-coverage$(RESET)   # Run tests with coverage report"
	@echo "  $(WHITE)make db-studio$(RESET)       # Open Drizzle Studio for DB management"
	@echo ""

setup: ## 🔧 Initial setup (install deps + setup .env + db setup + seed)
	@echo "$(BOLD)$(CYAN)🔧 Setting up $(PROJECT_NAME)...$(RESET)"
	@if [ ! -f api/.env ]; then \
		echo "$(YELLOW)Creating api/.env from api/.env.example...$(RESET)"; \
		cp api/.env.example api/.env; \
		echo "$(YELLOW)⚠️  Please update api/.env with your ClickHouse credentials$(RESET)"; \
	else \
		echo "$(GREEN)✓ api/.env already exists$(RESET)"; \
	fi
	@echo "$(YELLOW)Installing dependencies...$(RESET)"
	@cd api && npm install
	@echo "$(GREEN)✓ Dependencies installed$(RESET)"
	@echo "$(YELLOW)Starting Docker services...$(RESET)"
	@$(COMPOSE) up -d postgres
	@echo "$(YELLOW)Waiting for PostgreSQL to be ready...$(RESET)"
	@sleep 3
	@echo "$(YELLOW)Pushing database schema...$(RESET)"
	@cd api && npm run db:push
	@echo "$(GREEN)✓ Database schema pushed$(RESET)"
	@echo "$(YELLOW)Seeding database...$(RESET)"
	@cd api && npm run db:seed
	@echo "$(GREEN)✓ Database seeded$(RESET)"
	@echo "$(GREEN)✓ Setup completed successfully!$(RESET)"
	@echo "$(CYAN)Next step: make up$(RESET)"

dev: ## 💻 Start local development (DB + Frontend in Docker, API local with hot reload)
	@echo "$(BOLD)$(CYAN)💻 Starting local development environment...$(RESET)"
	@if [ ! -f api/.env ]; then \
		echo "$(RED)✗ api/.env not found$(RESET)"; \
		echo "$(YELLOW)Run 'make setup' first$(RESET)"; \
		exit 1; \
	fi
	@echo "$(YELLOW)Stopping API container if running...$(RESET)"
	@$(COMPOSE) stop api 2>/dev/null || true
	@echo "$(YELLOW)Starting PostgreSQL and Frontend...$(RESET)"
	@$(COMPOSE) up -d postgres
	@$(COMPOSE) up -d --no-deps web
	@echo "$(YELLOW)Waiting for services to be ready...$(RESET)"
	@sleep 3
	@echo "$(GREEN)✓ PostgreSQL started$(RESET)"
	@echo "$(GREEN)✓ Frontend started at http://localhost:4000$(RESET)"
	@echo "$(YELLOW)Starting API locally with hot reload...$(RESET)"
	@cd api && npm run dev

up: ## 🚀 Start all services (API + Frontend + DB with hot reload)
	@echo "$(BOLD)$(CYAN)🚀 Starting development environment...$(RESET)"
	@if [ ! -f api/.env ]; then \
		echo "$(RED)✗ api/.env not found$(RESET)"; \
		echo "$(YELLOW)Run 'make setup' first$(RESET)"; \
		exit 1; \
	fi
	@$(COMPOSE) up -d
	@echo "$(YELLOW)Waiting for services to be ready...$(RESET)"
	@sleep 3
	@echo "$(GREEN)✓ Development environment started$(RESET)"
	@echo "$(YELLOW)Frontend: http://localhost:4000$(RESET)"
	@echo "$(YELLOW)API:      http://localhost:5002$(RESET)"
	@echo "$(YELLOW)API Docs: http://localhost:5002/docs$(RESET)"
	@echo "$(YELLOW)Health:   http://localhost:5002/health$(RESET)"
	@echo "$(CYAN)View logs: make logs (all) | make logs-api | make logs-web$(RESET)"

build: ## 🔨 Build all services
	@echo "$(BOLD)$(CYAN)🔨 Building services...$(RESET)"
	@$(COMPOSE) build
	@echo "$(GREEN)✓ Build completed$(RESET)"

down: ## 🛑 Stop all services
	@echo "$(BOLD)$(RED)🛑 Stopping all services...$(RESET)"
	@$(COMPOSE) down
	@echo "$(GREEN)✓ All services stopped$(RESET)"

logs: ## 📋 View logs from all services
	@echo "$(BOLD)$(BLUE)📋 Viewing logs (Ctrl+C to exit)...$(RESET)"
	@$(COMPOSE) logs -f

logs-api: ## 📋 Show API logs only
	@echo "$(BOLD)$(BLUE)📋 Viewing API logs (Ctrl+C to exit)...$(RESET)"
	@$(COMPOSE) logs -f api

logs-web: ## 📋 Show Frontend logs only
	@echo "$(BOLD)$(BLUE)📋 Viewing Frontend logs (Ctrl+C to exit)...$(RESET)"
	@$(COMPOSE) logs -f web

restart: ## 🔄 Restart all services
	@echo "$(BOLD)$(CYAN)🔄 Restarting all services...$(RESET)"
	@$(MAKE) down
	@$(MAKE) up

status: ## 📊 Show status of all services
	@echo "$(BOLD)$(BLUE)📊 Service status:$(RESET)"
	@$(COMPOSE) ps

test: ## 🧪 Run test suite
	@echo "$(BOLD)$(BLUE)🧪 Running tests...$(RESET)"
	@cd api && npm test
	@echo "$(GREEN)✓ Tests completed$(RESET)"

test-coverage: ## 📊 Run tests with coverage report
	@echo "$(BOLD)$(BLUE)📊 Running tests with coverage...$(RESET)"
	@cd api && npm run test:coverage
	@echo "$(GREEN)✓ Coverage report generated$(RESET)"
	@echo "$(YELLOW)HTML report: api/coverage/index.html$(RESET)"

test-watch: ## 👀 Run tests in watch mode
	@echo "$(BOLD)$(BLUE)👀 Running tests in watch mode...$(RESET)"
	@cd api && npm run test:watch

# Database commands
db-up: ## 💾 Start PostgreSQL only
	@echo "$(BOLD)$(MAGENTA)💾 Starting PostgreSQL...$(RESET)"
	@$(COMPOSE) up -d postgres
	@echo "$(GREEN)✓ PostgreSQL is running on port 5432$(RESET)"

db-down: ## 🛑 Stop PostgreSQL
	@echo "$(BOLD)$(RED)🛑 Stopping PostgreSQL...$(RESET)"
	@$(COMPOSE) stop postgres
	@echo "$(GREEN)✓ PostgreSQL stopped$(RESET)"

db-logs: ## 📋 Show PostgreSQL logs
	@echo "$(BOLD)$(BLUE)📋 PostgreSQL logs:$(RESET)"
	@$(COMPOSE) logs -f postgres

db-shell: ## 🐚 Open psql interactive shell
	@echo "$(BOLD)$(MAGENTA)🐚 Opening PostgreSQL shell...$(RESET)"
	@$(COMPOSE) exec postgres psql -U dynainfo -d dynainfo_auth

db-push: ## 💾 Push database schema changes
	@echo "$(BOLD)$(MAGENTA)💾 Pushing database schema...$(RESET)"
	@cd api && npm run db:push
	@echo "$(GREEN)✓ Schema pushed to database$(RESET)"

db-generate: ## 📝 Generate SQL migration (production)
	@echo "$(BOLD)$(MAGENTA)📝 Generating migration...$(RESET)"
	@cd api && npm run db:generate
	@echo "$(GREEN)✓ Migration generated$(RESET)"

db-migrate: ## 🚀 Run migrations (production)
	@echo "$(BOLD)$(MAGENTA)🚀 Running migrations...$(RESET)"
	@cd api && npm run db:migrate
	@echo "$(GREEN)✓ Migrations applied$(RESET)"

db-studio: ## 🎨 Open Drizzle Studio (database UI)
	@echo "$(BOLD)$(MAGENTA)🎨 Opening Drizzle Studio...$(RESET)"
	@echo "$(YELLOW)Drizzle Studio will open at: https://local.drizzle.studio$(RESET)"
	@cd api && npm run db:studio

db-seed: ## 🌱 Seed database with initial data
	@echo "$(BOLD)$(MAGENTA)🌱 Seeding database...$(RESET)"
	@cd api && npm run db:seed
	@echo "$(GREEN)✓ Database seeded$(RESET)"

db-reset: ## ⚠️  Reset database (WARNING: deletes all data)
	@echo "$(BOLD)$(RED)⚠️  WARNING: This will delete all data!$(RESET)"
	@read -p "Type 'yes' to continue: " confirm && [ "$$confirm" = "yes" ] || (echo "$(YELLOW)Cancelled$(RESET)" && exit 1)
	@echo "$(YELLOW)Resetting database...$(RESET)"
	@$(COMPOSE) down postgres
	@docker volume rm new-dynainfo_postgres_data 2>/dev/null || true
	@$(COMPOSE) up -d postgres
	@echo "$(YELLOW)Waiting for PostgreSQL to be ready...$(RESET)"
	@sleep 5
	@$(MAKE) db-push
	@$(MAKE) db-seed
	@echo "$(GREEN)✓ Database reset complete$(RESET)"

# Production commands
prod-build: ## 🏭 Build production Docker image
	@echo "$(BOLD)$(CYAN)🏭 Building production image...$(RESET)"
	@cd api && docker compose -f docker-compose.production.yml build
	@echo "$(GREEN)✓ Production image built$(RESET)"

prod-up: ## 🚀 Start production environment (HTTPS on port 443)
	@echo "$(BOLD)$(CYAN)🚀 Starting production environment...$(RESET)"
	@if [ ! -f api/.env ]; then \
		echo "$(RED)✗ api/.env not found$(RESET)"; \
		echo "$(YELLOW)Create .env file with NODE_ENV=production and ORIGIN_URL$(RESET)"; \
		exit 1; \
	fi
	@if [ ! -f api/ssl/dynainfo.key ]; then \
		echo "$(RED)✗ SSL certificates not found in api/ssl/$(RESET)"; \
		echo "$(YELLOW)Required files: dynainfo.key, dynainfo.crt, ca.crt$(RESET)"; \
		exit 1; \
	fi
	@cd api && docker compose -f docker-compose.production.yml up -d
	@echo "$(YELLOW)Waiting for services to be ready...$(RESET)"
	@sleep 5
	@echo "$(GREEN)✓ Production environment started$(RESET)"
	@echo "$(YELLOW)HTTPS API: https://localhost (port 443)$(RESET)"
	@echo "$(YELLOW)Health:    https://localhost/health$(RESET)"
	@echo "$(YELLOW)API Docs:  https://localhost/docs$(RESET)"
	@echo "$(CYAN)View logs: make prod-logs$(RESET)"

prod-down: ## 🛑 Stop production environment
	@echo "$(BOLD)$(RED)🛑 Stopping production environment...$(RESET)"
	@cd api && docker compose -f docker-compose.production.yml down
	@echo "$(GREEN)✓ Production environment stopped$(RESET)"

prod-logs: ## 📋 View production logs
	@echo "$(BOLD)$(BLUE)📋 Production logs (Ctrl+C to exit)...$(RESET)"
	@cd api && docker compose -f docker-compose.production.yml logs -f

prod-restart: ## 🔄 Restart production environment
	@echo "$(BOLD)$(CYAN)🔄 Restarting production environment...$(RESET)"
	@$(MAKE) prod-down
	@$(MAKE) prod-up

prod: ## 🏭 Full production setup (build + up)
	@echo "$(BOLD)$(CYAN)🏭 Setting up production environment...$(RESET)"
	@$(MAKE) prod-build
	@$(MAKE) prod-up

setup-prod: ## 🔧 Interactive production environment setup
	@echo "$(BOLD)$(CYAN)╔════════════════════════════════════════════╗$(RESET)"
	@echo "$(BOLD)$(CYAN)║   🔧 PRODUCTION SETUP WIZARD              ║$(RESET)"
	@echo "$(BOLD)$(CYAN)╚════════════════════════════════════════════╝$(RESET)"
	@echo ""
	@if [ -f api/.env ]; then \
		echo "$(YELLOW)⚠️  Warning: api/.env already exists$(RESET)"; \
		echo "$(YELLOW)Current configuration will be backed up to api/.env.backup$(RESET)"; \
		read -p "$(BOLD)Continue? (y/N): $(RESET)" confirm; \
		if [ "$$confirm" != "y" ] && [ "$$confirm" != "Y" ]; then \
			echo "$(RED)Setup cancelled$(RESET)"; \
			exit 0; \
		fi; \
		cp api/.env api/.env.backup; \
		echo "$(GREEN)✓ Backup created: api/.env.backup$(RESET)"; \
		echo ""; \
	fi
	@echo "$(BOLD)$(CYAN)This wizard will help you configure production environment.$(RESET)"
	@echo "$(YELLOW)Press Enter to use default values shown in [brackets]$(RESET)"
	@echo ""
	@echo "$(BOLD)$(MAGENTA)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(BOLD)$(MAGENTA)  1. Server Configuration$(RESET)"
	@echo "$(BOLD)$(MAGENTA)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@read -p "$(BOLD)Port [5002]: $(RESET)" PORT; \
	PORT=$${PORT:-5002}; \
	read -p "$(BOLD)Host [0.0.0.0]: $(RESET)" HOST; \
	HOST=$${HOST:-0.0.0.0}; \
	echo ""; \
	echo "$(BOLD)$(MAGENTA)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"; \
	echo "$(BOLD)$(MAGENTA)  2. Frontend CORS Configuration$(RESET)"; \
	echo "$(BOLD)$(MAGENTA)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"; \
	echo "$(YELLOW)Enter your Vercel frontend URL (e.g., https://dynainfo.com.co)$(RESET)"; \
	read -p "$(BOLD)ORIGIN_URL [https://dynainfo.com.co]: $(RESET)" ORIGIN_URL; \
	ORIGIN_URL=$${ORIGIN_URL:-https://dynainfo.com.co}; \
	echo ""; \
	echo "$(BOLD)$(MAGENTA)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"; \
	echo "$(BOLD)$(MAGENTA)  3. Database Configuration$(RESET)"; \
	echo "$(BOLD)$(MAGENTA)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"; \
	read -p "$(BOLD)Table prefix [dyna_]: $(RESET)" TABLE_PREFIX; \
	TABLE_PREFIX=$${TABLE_PREFIX:-dyna_}; \
	echo "$(YELLOW)PostgreSQL will run in Docker (user: dynainfo, db: dynainfo)$(RESET)"; \
	read -p "$(BOLD)PostgreSQL password (will be auto-generated if empty): $(RESET)" POSTGRES_PASSWORD; \
	if [ -z "$$POSTGRES_PASSWORD" ]; then \
		POSTGRES_PASSWORD=$$(openssl rand -hex 16); \
		echo "$(GREEN)✓ Generated password: $$POSTGRES_PASSWORD$(RESET)"; \
	fi; \
	POSTGRES_URL="postgresql://dynainfo:$$POSTGRES_PASSWORD@postgres:5432/dynainfo"; \
	echo ""; \
	echo "$(BOLD)$(MAGENTA)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"; \
	echo "$(BOLD)$(MAGENTA)  4. ClickHouse Configuration$(RESET)"; \
	echo "$(BOLD)$(MAGENTA)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"; \
	read -p "$(BOLD)ClickHouse Host [10.10.20.12]: $(RESET)" CLICKHOUSE_HOST; \
	CLICKHOUSE_HOST=$${CLICKHOUSE_HOST:-10.10.20.12}; \
	read -p "$(BOLD)ClickHouse Port [8123]: $(RESET)" CLICKHOUSE_PORT; \
	CLICKHOUSE_PORT=$${CLICKHOUSE_PORT:-8123}; \
	read -p "$(BOLD)ClickHouse Database [default]: $(RESET)" CLICKHOUSE_DATABASE; \
	CLICKHOUSE_DATABASE=$${CLICKHOUSE_DATABASE:-default}; \
	read -p "$(BOLD)ClickHouse Username: $(RESET)" CLICKHOUSE_USERNAME; \
	read -sp "$(BOLD)ClickHouse Password: $(RESET)" CLICKHOUSE_PASSWORD; \
	echo ""; \
	echo ""; \
	echo "$(BOLD)$(MAGENTA)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"; \
	echo "$(BOLD)$(MAGENTA)  5. Authentication Configuration$(RESET)"; \
	echo "$(BOLD)$(MAGENTA)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"; \
	read -p "$(BOLD)Better Auth URL [https://api.dynainfo.com.co]: $(RESET)" BETTER_AUTH_URL; \
	BETTER_AUTH_URL=$${BETTER_AUTH_URL:-https://api.dynainfo.com.co}; \
	echo "$(YELLOW)Generating Better Auth secret...$(RESET)"; \
	BETTER_AUTH_SECRET=$$(openssl rand -base64 32); \
	echo "$(GREEN)✓ Secret generated$(RESET)"; \
	echo ""; \
	echo "$(BOLD)$(MAGENTA)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"; \
	echo "$(BOLD)$(MAGENTA)  6. Email Service (Resend)$(RESET)"; \
	echo "$(BOLD)$(MAGENTA)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"; \
	echo "$(YELLOW)Get your API key from: https://resend.com/api-keys$(RESET)"; \
	read -p "$(BOLD)Resend API Key: $(RESET)" RESEND_API_KEY; \
	echo ""; \
	echo "$(BOLD)$(MAGENTA)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"; \
	echo "$(BOLD)$(MAGENTA)  7. SSO Configuration (Dyna System)$(RESET)"; \
	echo "$(BOLD)$(MAGENTA)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"; \
	echo "$(YELLOW)Enter the SSO secret key provided by the Dyna system$(RESET)"; \
	read -p "$(BOLD)SSO Secret Key: $(RESET)" SSO_SECRET_KEY; \
	echo ""; \
	echo "$(BOLD)$(MAGENTA)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"; \
	echo "$(BOLD)$(MAGENTA)  8. Superadmin Account$(RESET)"; \
	echo "$(BOLD)$(MAGENTA)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"; \
	read -p "$(BOLD)Superadmin Email [admin@dynainfo.com]: $(RESET)" SUPERADMIN_EMAIL; \
	SUPERADMIN_EMAIL=$${SUPERADMIN_EMAIL:-admin@dynainfo.com}; \
	read -p "$(BOLD)Superadmin Name [Super Admin]: $(RESET)" SUPERADMIN_NAME; \
	SUPERADMIN_NAME=$${SUPERADMIN_NAME:-Super Admin}; \
	echo ""; \
	echo "$(BOLD)$(CYAN)Generating .env file...$(RESET)"; \
	echo "# Server Configuration" > api/.env; \
	echo "PORT=$$PORT" >> api/.env; \
	echo "HOST=$$HOST" >> api/.env; \
	echo "NODE_ENV=production" >> api/.env; \
	echo "" >> api/.env; \
	echo "# CORS Configuration" >> api/.env; \
	echo "ORIGIN_URL=$$ORIGIN_URL" >> api/.env; \
	echo "" >> api/.env; \
	echo "# Database Configuration" >> api/.env; \
	echo "TABLE_PREFIX=$$TABLE_PREFIX" >> api/.env; \
	echo "" >> api/.env; \
	echo "# ClickHouse Configuration (External Database)" >> api/.env; \
	echo "CLICKHOUSE_HOST=$$CLICKHOUSE_HOST" >> api/.env; \
	echo "CLICKHOUSE_PORT=$$CLICKHOUSE_PORT" >> api/.env; \
	echo "CLICKHOUSE_DATABASE=$$CLICKHOUSE_DATABASE" >> api/.env; \
	echo "CLICKHOUSE_USERNAME=$$CLICKHOUSE_USERNAME" >> api/.env; \
	echo "CLICKHOUSE_PASSWORD=$$CLICKHOUSE_PASSWORD" >> api/.env; \
	echo "" >> api/.env; \
	echo "# PostgreSQL Configuration (Auth Database)" >> api/.env; \
	echo "POSTGRES_URL=$$POSTGRES_URL" >> api/.env; \
	echo "POSTGRES_PASSWORD=$$POSTGRES_PASSWORD" >> api/.env; \
	echo "" >> api/.env; \
	echo "# Better Auth Configuration" >> api/.env; \
	echo "BETTER_AUTH_SECRET=$$BETTER_AUTH_SECRET" >> api/.env; \
	echo "BETTER_AUTH_URL=$$BETTER_AUTH_URL" >> api/.env; \
	echo "" >> api/.env; \
	echo "# Resend Email Configuration" >> api/.env; \
	echo "RESEND_API_KEY=$$RESEND_API_KEY" >> api/.env; \
	echo "" >> api/.env; \
	echo "# SSO Configuration (Dyna system integration)" >> api/.env; \
	echo "SSO_SECRET_KEY=$$SSO_SECRET_KEY" >> api/.env; \
	echo "" >> api/.env; \
	echo "# Seed Script Configuration" >> api/.env; \
	echo "SUPERADMIN_EMAIL=$$SUPERADMIN_EMAIL" >> api/.env; \
	echo "SUPERADMIN_NAME=$$SUPERADMIN_NAME" >> api/.env; \
	echo "" >> api/.env; \
	echo "# Auto-generated on $$(date)" >> api/.env; \
	echo ""; \
	echo "$(GREEN)$(BOLD)✅ Configuration file created: api/.env$(RESET)"; \
	echo ""; \
	echo "$(BOLD)$(CYAN)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"; \
	echo "$(BOLD)$(CYAN)  📋 Configuration Summary$(RESET)"; \
	echo "$(BOLD)$(CYAN)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"; \
	echo "$(YELLOW)Port:$(RESET)                 $$PORT"; \
	echo "$(YELLOW)Environment:$(RESET)          production"; \
	echo "$(YELLOW)Frontend CORS:$(RESET)        $$ORIGIN_URL"; \
	echo "$(YELLOW)ClickHouse Host:$(RESET)      $$CLICKHOUSE_HOST:$$CLICKHOUSE_PORT"; \
	echo "$(YELLOW)PostgreSQL Password:$(RESET)  $$POSTGRES_PASSWORD"; \
	echo "$(YELLOW)Superadmin Email:$(RESET)     $$SUPERADMIN_EMAIL"; \
	echo "$(BOLD)$(CYAN)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"; \
	echo ""; \
	echo "$(BOLD)$(GREEN)✅ Production environment configured!$(RESET)"; \
	echo ""; \
	echo "$(BOLD)$(CYAN)Next steps:$(RESET)"; \
	echo "  1. Verify SSL certificates: $(WHITE)ls api/ssl/$(RESET)"; \
	echo "  2. Check configuration: $(WHITE)cat api/.env$(RESET)"; \
	echo "  3. Run deployment: $(WHITE)make deploy$(RESET)"; \
	echo ""; \
	read -p "$(BOLD)$(YELLOW)Deploy now? (y/N): $(RESET)" DEPLOY_NOW; \
	if [ "$$DEPLOY_NOW" = "y" ] || [ "$$DEPLOY_NOW" = "Y" ]; then \
		echo ""; \
		$(MAKE) deploy; \
	else \
		echo "$(YELLOW)You can deploy later with: $(WHITE)make deploy$(RESET)"; \
	fi

deploy-check: ## ✅ Check all production requirements
	@echo "$(BOLD)$(CYAN)✅ Checking production requirements...$(RESET)"
	@echo ""
	@echo "$(YELLOW)1. Checking .env file...$(RESET)"
	@if [ ! -f api/.env ]; then \
		echo "$(RED)✗ FAIL: api/.env not found$(RESET)"; \
		echo "$(YELLOW)  Create it from api/.env.example and configure for production$(RESET)"; \
		exit 1; \
	else \
		echo "$(GREEN)✓ api/.env exists$(RESET)"; \
	fi
	@echo ""
	@echo "$(YELLOW)2. Checking NODE_ENV=production...$(RESET)"
	@if ! grep -q "NODE_ENV=production" api/.env; then \
		echo "$(RED)✗ FAIL: NODE_ENV is not set to production$(RESET)"; \
		echo "$(YELLOW)  Set NODE_ENV=production in api/.env$(RESET)"; \
		exit 1; \
	else \
		echo "$(GREEN)✓ NODE_ENV=production configured$(RESET)"; \
	fi
	@echo ""
	@echo "$(YELLOW)3. Checking ORIGIN_URL...$(RESET)"
	@if ! grep -q "^ORIGIN_URL=https://" api/.env; then \
		echo "$(RED)✗ FAIL: ORIGIN_URL not configured$(RESET)"; \
		echo "$(YELLOW)  Set ORIGIN_URL=https://your-frontend-domain.com$(RESET)"; \
		exit 1; \
	else \
		ORIGIN=$$(grep "^ORIGIN_URL=" api/.env | cut -d'=' -f2); \
		echo "$(GREEN)✓ ORIGIN_URL configured: $$ORIGIN$(RESET)"; \
	fi
	@echo ""
	@echo "$(YELLOW)4. Checking SSL certificates...$(RESET)"
	@if [ ! -f api/ssl/dynainfo.key ]; then \
		echo "$(RED)✗ FAIL: api/ssl/dynainfo.key not found$(RESET)"; \
		exit 1; \
	else \
		echo "$(GREEN)✓ dynainfo.key exists$(RESET)"; \
	fi
	@if [ ! -f api/ssl/dynainfo.crt ]; then \
		echo "$(RED)✗ FAIL: api/ssl/dynainfo.crt not found$(RESET)"; \
		exit 1; \
	else \
		echo "$(GREEN)✓ dynainfo.crt exists$(RESET)"; \
	fi
	@if [ ! -f api/ssl/ca.crt ]; then \
		echo "$(RED)✗ FAIL: api/ssl/ca.crt not found$(RESET)"; \
		exit 1; \
	else \
		echo "$(GREEN)✓ ca.crt exists$(RESET)"; \
	fi
	@echo ""
	@echo "$(YELLOW)5. Checking certificate permissions...$(RESET)"
	@PERMS=$$(stat -f "%Lp" api/ssl/dynainfo.key 2>/dev/null || stat -c "%a" api/ssl/dynainfo.key 2>/dev/null); \
	if [ "$$PERMS" != "600" ]; then \
		echo "$(YELLOW)⚠  Warning: dynainfo.key permissions are $$PERMS (should be 600)$(RESET)"; \
		echo "$(YELLOW)  Fixing permissions...$(RESET)"; \
		chmod 600 api/ssl/dynainfo.key; \
		echo "$(GREEN)✓ Permissions fixed to 600$(RESET)"; \
	else \
		echo "$(GREEN)✓ Certificate permissions correct (600)$(RESET)"; \
	fi
	@echo ""
	@echo "$(YELLOW)6. Checking certificate validity...$(RESET)"
	@CERT_EXPIRY=$$(openssl x509 -in api/ssl/dynainfo.crt -noout -enddate 2>/dev/null | cut -d= -f2); \
	if [ -n "$$CERT_EXPIRY" ]; then \
		echo "$(GREEN)✓ Certificate valid until: $$CERT_EXPIRY$(RESET)"; \
	else \
		echo "$(RED)✗ FAIL: Could not read certificate$(RESET)"; \
		exit 1; \
	fi
	@echo ""
	@echo "$(YELLOW)7. Checking required environment variables...$(RESET)"
	@MISSING_VARS=""; \
	for VAR in CLICKHOUSE_HOST CLICKHOUSE_USERNAME CLICKHOUSE_PASSWORD POSTGRES_URL BETTER_AUTH_SECRET RESEND_API_KEY; do \
		if ! grep -q "^$$VAR=" api/.env; then \
			MISSING_VARS="$$MISSING_VARS $$VAR"; \
		fi; \
	done; \
	if [ -n "$$MISSING_VARS" ]; then \
		echo "$(RED)✗ FAIL: Missing required variables:$$MISSING_VARS$(RESET)"; \
		exit 1; \
	else \
		echo "$(GREEN)✓ All required environment variables configured$(RESET)"; \
	fi
	@echo ""
	@echo "$(YELLOW)8. Checking Docker...$(RESET)"
	@if ! command -v docker >/dev/null 2>&1; then \
		echo "$(RED)✗ FAIL: Docker not installed$(RESET)"; \
		exit 1; \
	else \
		echo "$(GREEN)✓ Docker is installed$(RESET)"; \
	fi
	@if ! docker info >/dev/null 2>&1; then \
		echo "$(RED)✗ FAIL: Docker daemon not running$(RESET)"; \
		exit 1; \
	else \
		echo "$(GREEN)✓ Docker daemon is running$(RESET)"; \
	fi
	@echo ""
	@echo "$(GREEN)$(BOLD)✅ All production checks passed!$(RESET)"
	@echo ""

deploy-db: ## 💾 Setup production database (run after first deploy)
	@echo "$(BOLD)$(MAGENTA)💾 Setting up production database...$(RESET)"
	@echo ""
	@echo "$(YELLOW)Waiting for PostgreSQL to be ready...$(RESET)"
	@sleep 8
	@echo "$(YELLOW)Pushing database schema...$(RESET)"
	@docker compose -f api/docker-compose.production.yml exec -T api npm run db:push
	@echo "$(GREEN)✓ Schema applied$(RESET)"
	@echo ""
	@echo "$(YELLOW)Seeding database with initial data...$(RESET)"
	@docker compose -f api/docker-compose.production.yml exec -T api npm run db:seed
	@echo "$(GREEN)✓ Database seeded$(RESET)"
	@echo ""
	@echo "$(GREEN)$(BOLD)✅ Database setup complete!$(RESET)"

deploy: ## 🚀 Full production deployment (checks + build + deploy + db setup + health check)
	@echo "$(BOLD)$(CYAN)╔════════════════════════════════════════════╗$(RESET)"
	@echo "$(BOLD)$(CYAN)║   🚀 PRODUCTION DEPLOYMENT STARTING...    ║$(RESET)"
	@echo "$(BOLD)$(CYAN)╚════════════════════════════════════════════╝$(RESET)"
	@echo ""
	@echo "$(BOLD)$(CYAN)Step 1/5: Running pre-deployment checks...$(RESET)"
	@$(MAKE) deploy-check
	@echo ""
	@echo "$(BOLD)$(CYAN)Step 2/5: Building production image (service stays up)...$(RESET)"
	@cd api && docker compose -f docker-compose.production.yml build $(if $(NOCACHE),--no-cache)
	@echo "$(GREEN)✓ Production image built$(RESET)"
	@echo ""
	@echo "$(BOLD)$(CYAN)Step 3/5: Swapping containers (only changed services restart)...$(RESET)"
	@cd api && docker compose -f docker-compose.production.yml up -d
	@echo "$(GREEN)✓ Services running on the new image$(RESET)"
	@echo ""
	@echo "$(BOLD)$(CYAN)Step 4/5: Setting up database...$(RESET)"
	@$(MAKE) deploy-db
	@echo ""
	@echo "$(BOLD)$(CYAN)Step 5/5: Running health checks...$(RESET)"
	@echo "$(YELLOW)Waiting for API to be ready...$(RESET)"
	@sleep 5
	@MAX_ATTEMPTS=30; \
	ATTEMPT=0; \
	while [ $$ATTEMPT -lt $$MAX_ATTEMPTS ]; do \
		if curl -k -f -s https://localhost/health >/dev/null 2>&1; then \
			echo "$(GREEN)✓ API is healthy and responding$(RESET)"; \
			break; \
		fi; \
		ATTEMPT=$$((ATTEMPT + 1)); \
		if [ $$ATTEMPT -eq $$MAX_ATTEMPTS ]; then \
			echo "$(RED)✗ API failed to respond after $$MAX_ATTEMPTS attempts$(RESET)"; \
			echo "$(YELLOW)Check logs with: make prod-logs$(RESET)"; \
			exit 1; \
		fi; \
		printf "$(YELLOW).$(RESET)"; \
		sleep 2; \
	done
	@echo ""
	@echo ""
	@echo "$(BOLD)$(GREEN)╔════════════════════════════════════════════╗$(RESET)"
	@echo "$(BOLD)$(GREEN)║     ✅ DEPLOYMENT SUCCESSFUL! ✅           ║$(RESET)"
	@echo "$(BOLD)$(GREEN)╚════════════════════════════════════════════╝$(RESET)"
	@echo ""
	@echo "$(BOLD)$(CYAN)📊 Service Information:$(RESET)"
	@echo "$(YELLOW)─────────────────────────────────────────────$(RESET)"
	@ORIGIN=$$(grep "^ORIGIN_URL=" api/.env | cut -d'=' -f2 | tr -d '\r'); \
	echo "$(BOLD)Frontend CORS Origin:$(RESET) $$ORIGIN"; \
	echo "$(BOLD)API HTTPS Endpoint:$(RESET)   https://localhost (port 443)"; \
	echo "$(BOLD)Health Check:$(RESET)         https://localhost/health"; \
	echo "$(BOLD)API Documentation:$(RESET)    https://localhost/docs"; \
	echo "$(YELLOW)─────────────────────────────────────────────$(RESET)"
	@echo ""
	@echo "$(BOLD)$(CYAN)🔍 Quick Commands:$(RESET)"
	@echo "  $(WHITE)make prod-logs$(RESET)      View logs"
	@echo "  $(WHITE)make prod-down$(RESET)      Stop services"
	@echo "  $(WHITE)make prod-restart$(RESET)   Restart services"
	@echo ""
	@echo "$(BOLD)$(CYAN)🧪 Test the API:$(RESET)"
	@echo "  $(WHITE)curl -k https://localhost/health$(RESET)"
	@echo ""
	@CERT_EXPIRY=$$(openssl x509 -in api/ssl/dynainfo.crt -noout -enddate 2>/dev/null | cut -d= -f2); \
	echo "$(BOLD)$(YELLOW)⚠️  Certificate expires: $$CERT_EXPIRY$(RESET)"; \
	echo ""

