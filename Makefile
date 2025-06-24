# File: Makefile

.PHONY: help up down restart logs build clean dev dev-backend dev-frontend up-stage down-stage up-prod down-prod restart-dev restart-stage restart-prod logs-dev logs-stage logs-prod build-dev build-stage build-prod

help: ## Show this help message
	@echo "🔥 Saatvik EL Detection System - Available Commands:"
	@echo ""
	@echo "🚀 DEVELOPMENT (Original Docker Commands):"
	@echo "  make up              - Start development environment"
	@echo "  make down            - Stop development environment"
	@echo "  make restart         - Restart development environment"
	@echo "  make logs            - View development logs"
	@echo "  make build           - Build development containers"
	@echo ""
	@echo "🔧 DEVELOPMENT (Hot Reload):"
	@echo "  make dev             - Start complete dev environment (backend + frontend hot reload)"
	@echo "  make dev-backend     - Start backend only (API + DB)"
	@echo "  make dev-frontend    - Start frontend only (hot reload)"
	@echo "  make restart-dev     - Restart development (hot reload version)"
	@echo "  make logs-dev        - View development logs (hot reload version)"
	@echo "  make build-dev       - Build development containers (hot reload version)"
	@echo ""
	@echo "🎯 STAGING:"
	@echo "  make up-stage        - Start staging environment (port 8001)"
	@echo "  make down-stage      - Stop staging environment"
	@echo "  make restart-stage   - Restart staging environment"
	@echo "  make logs-stage      - View staging logs"
	@echo "  make build-stage     - Build staging containers"
	@echo ""
	@echo "🚀 PRODUCTION:"
	@echo "  make up-prod         - Start production environment (port 8002)"
	@echo "  make down-prod       - Stop production environment"
	@echo "  make restart-prod    - Restart production environment"
	@echo "  make logs-prod       - View production logs"
	@echo "  make build-prod      - Build production containers"
	@echo ""
	@echo "🛠️ UTILITY:"
	@echo "  make clean           - Clean all containers and volumes"
	@echo "  make status          - Show all container status"

# ===========================================
# ORIGINAL DOCKER COMMANDS (Main Development)
# ===========================================

up: ## Start development environment
	@echo "🚀 Starting Development Environment..."
	docker compose up -d
	@echo "✅ Development running on http://localhost:8000"

down: ## Stop development environment
	@echo "⏹️  Stopping Development Environment..."
	docker compose down

restart: ## Restart development environment
	@echo "🔄 Restarting Development Environment..."
	docker compose restart
	@echo "✅ Development restarted"

logs: ## View development logs
	docker compose logs -f

build: ## Build development containers
	@echo "🔨 Building Development Containers..."
	docker compose build --no-cache
	@echo "✅ Development containers built"

# ===========================================
# DEVELOPMENT WORKFLOW (Hot Reload)
# ===========================================

dev: ## Start complete development environment (backend + frontend hot reload)
	@echo "🔥 Starting COMPLETE Development Environment..."
	@$(MAKE) dev-backend
	@echo "✅ Backend started. Frontend available at http://localhost:8000"

dev-backend: ## Start backend services only (API + Database)
	@echo "🚀 Starting Backend Services..."
	docker compose up -d
	@echo "✅ Backend running:"
	@echo "   🌐 API: http://localhost:8000"
	@echo "   📚 API Docs: http://localhost:8000/docs"
	@echo "   🗄️ Database: localhost:5432"

dev-frontend: ## Start frontend with hot reload (if implemented)
	@echo "🔥 Frontend hot reload not implemented yet"
	@echo "   🌐 Frontend available at: http://localhost:8000"
	@echo "   📚 API Docs: http://localhost:8000/docs"

restart-dev: ## Restart development environment
	@echo "🔄 Restarting Development Environment..."
	docker compose restart
	@echo "✅ Development restarted"

logs-dev: ## View development logs
	docker compose logs -f

build-dev: ## Build development containers
	@echo "🔨 Building Development Containers..."
	docker compose build --no-cache
	@echo "✅ Development containers built"

# ===========================================
# STAGING ENVIRONMENT
# ===========================================

up-stage: ## Start staging environment
	@echo "🎭 Starting Staging Environment..."
	docker compose -f docker-compose.staging.yml up -d
	@echo "✅ Staging running on http://localhost:8001"

down-stage: ## Stop staging environment
	@echo "⏹️  Stopping Staging Environment..."
	docker compose -f docker-compose.staging.yml down

restart-stage: ## Restart staging environment
	@echo "🔄 Restarting Staging Environment..."
	docker compose -f docker-compose.staging.yml restart
	@echo "✅ Staging restarted"

logs-stage: ## View staging logs
	docker compose -f docker-compose.staging.yml logs -f

build-stage: ## Build staging containers
	@echo "🔨 Building Staging Containers..."
	docker compose -f docker-compose.staging.yml build --no-cache
	@echo "✅ Staging containers built"

# ===========================================
# PRODUCTION ENVIRONMENT
# ===========================================

up-prod: ## Start production environment
	@echo "🏭 Starting Production Environment..."
	docker compose -f docker-compose.prod.yml up -d
	@echo "✅ Production running on http://localhost:8002"

down-prod: ## Stop production environment
	@echo "⏹️  Stopping Production Environment..."
	docker compose -f docker-compose.prod.yml down

restart-prod: ## Restart production environment
	@echo "🔄 Restarting Production Environment..."
	docker compose -f docker-compose.prod.yml restart
	@echo "✅ Production restarted"

logs-prod: ## View production logs
	docker compose -f docker-compose.prod.yml logs -f

build-prod: ## Build production containers
	@echo "🔨 Building Production Containers..."
	docker compose -f docker-compose.prod.yml build --no-cache
	@echo "✅ Production containers built"

# ===========================================
# UTILITY COMMANDS
# ===========================================

status: ## Show all container status
	@echo "📊 Container Status:"
	@docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

clean: ## Clean all containers and volumes
	@echo "🧹 Cleaning All Containers and Volumes..."
	docker compose down -v --remove-orphans
	docker compose -f docker-compose.staging.yml down -v --remove-orphans
	docker compose -f docker-compose.prod.yml down -v --remove-orphans
	docker system prune -f
	@echo "✅ Cleanup complete"

# Health checks
health: ## Check development health
	@echo "💚 Development Health:"
	@curl -s http://localhost:8000/api/v1/health || echo "❌ Dev not running"

health-stage: ## Check staging health
	@echo "💚 Staging Health:"
	@curl -s http://localhost:8001/api/v1/health || echo "❌ Staging not running"

health-prod: ## Check production health
	@echo "💚 Production Health:"
	@curl -s http://localhost:8002/api/v1/health || echo "❌ Production not running"

# Show help by default
.DEFAULT_GOAL := help