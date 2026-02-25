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

.PHONY: help setup dev up down logs logs-api logs-web restart test test-coverage db-push db-studio db-seed lint clean status

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
	@echo "$(YELLOW)API:      http://localhost:3000$(RESET)"
	@echo "$(YELLOW)API Docs: http://localhost:3000/docs$(RESET)"
	@echo "$(YELLOW)Health:   http://localhost:3000/health$(RESET)"
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

