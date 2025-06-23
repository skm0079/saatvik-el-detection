# File: Makefile - Complete Commands (Keep All Existing + Add Development Workflow)

.PHONY: help up down restart logs build clean dev dev-backend dev-frontend up-stage down-stage up-prod down-prod

help: ## Show this help message
	@echo "🔥 Saatvik EL Detection System - Available Commands:"
	@echo ""
	@echo "🚀 DEVELOPMENT (Recommended for coding):"
	@echo "  make dev             - Start complete dev environment (backend + frontend hot reload)"
	@echo "  make dev-backend     - Start backend only (API + DB)"
	@echo "  make dev-frontend    - Start frontend only (hot reload) - separate terminal"
	@echo ""
	@echo "🔧 FULL DOCKER (Original commands):"
	@echo "  make up              - Start development with frontend build in Docker"
	@echo "  make down            - Stop development environment"
	@echo "  make restart         - Restart development environment"
	@echo "  make logs            - View development logs"
	@echo "  make build           - Build all containers"
	@echo ""
	@echo "🎯 STAGING:"
	@echo "  make up-stage        - Start staging environment (port 8001)"
	@echo "  make down-stage      - Stop staging environment"
	@echo "  make logs-stage      - View staging logs"
	@echo ""
	@echo "🚀 PRODUCTION:"
	@echo "  make up-prod         - Start production environment (port 8002)"
	@echo "  make down-prod       - Stop production environment"
	@echo "  make logs-prod       - View production logs"
	@echo ""
	@echo "🛠️ UTILITY:"
	@echo "  make clean           - Clean all containers and volumes"

# ===========================================
# ORIGINAL DOCKER COMMANDS (Keep All)
# ===========================================

up: ## Start development environment with frontend build in Docker
	@echo "🚀 Starting Development Environment (with Frontend Build)..."
	docker compose up -d --build
	@echo "✅ Development running:"
	@echo "   🌐 Frontend + API: http://localhost:8000"
	@echo "   📚 API Docs: http://localhost:8000/docs"
	@echo "   🗄️ Database: localhost:5432"

down: ## Stop development environment
	@echo "⏹️  Stopping Development Environment..."
	docker compose down

restart: ## Restart development environment
	@echo "🔄 Restarting Development Environment..."
	docker compose restart
	@echo "✅ Development restarted"

logs: ## View development logs
	docker compose logs -f

build: ## Build all containers
	@echo "🔨 Building All Containers..."
	docker compose build --no-cache

# ===========================================
# NEW DEVELOPMENT WORKFLOW (Hot Reload)
# ===========================================

dev: ## Start complete development environment (backend + frontend hot reload)
	@echo "🔥 Starting COMPLETE Development Environment..."
	@echo ""
	@echo "📋 This will:"
	@echo "   1. Start backend services (API + Database)"
	@echo "   2. Start frontend with hot reload"
	@echo ""
	@$(MAKE) dev-backend
	@echo ""
	@echo "⏳ Waiting for backend to be ready..."
	@sleep 10
	@echo ""
	@echo "🔥 Starting frontend with hot reload..."
	@$(MAKE) dev-frontend

dev-backend: ## Start backend services only (API + Database)
	@echo "🚀 Starting Backend Services..."
	docker compose -f docker-compose.dev-simple.yml up -d
	@echo "✅ Backend running:"
	@echo "   🌐 API: http://localhost:8000"
	@echo "   📚 API Docs: http://localhost:8000/docs"
	@echo "   🗄️ Database: localhost:5432"

dev-frontend: ## Start frontend with hot reload (run in separate terminal)
	@echo "🔥 Starting Frontend Hot Reload..."
	@echo "   🌐 Frontend: http://localhost:5173"
	@echo "   🔄 Hot reload enabled - changes auto-refresh"
	@echo "   ⚠️  Keep this terminal open for hot reload"
	@echo ""
	cd frontend && npm run dev

stop-dev: ## Stop development environment (hot reload version)
	@echo "⏹️  Stopping Development Environment..."
	docker compose -f docker-compose.dev-simple.yml down

logs-dev: ## View development logs (hot reload version)
	docker compose -f docker-compose.dev-simple.yml logs -f

# ===========================================
# STAGING ENVIRONMENT
# ===========================================

up-stage: ## Start staging environment
	@echo "🎯 Starting Staging Environment..."
	docker compose -f docker-compose.staging.yml up -d --build
	@echo "✅ Staging running:"
	@echo "   🌐 Frontend + API: http://localhost:8001"
	@echo "   📚 API Docs: http://localhost:8001/docs"
	@echo "   🗄️ Database: localhost:5433"

down-stage: ## Stop staging environment
	@echo "⏹️  Stopping Staging Environment..."
	docker compose -f docker-compose.staging.yml down

logs-stage: ## View staging logs
	docker compose -f docker-compose.staging.yml logs -f

# ===========================================
# PRODUCTION ENVIRONMENT
# ===========================================

up-prod: ## Start production environment
	@echo "🚀 Starting Production Environment..."
	docker compose -f docker-compose.prod.yml up -d --build
	@echo "✅ Production running:"
	@echo "   🌐 Frontend + API: http://localhost:8002"
	@echo "   📚 API Docs: http://localhost:8002/docs"
	@echo "   🗄️ Database: localhost:5434"

down-prod: ## Stop production environment
	@echo "⏹️  Stopping Production Environment..."
	docker compose -f docker-compose.prod.yml down

logs-prod: ## View production logs
	docker compose -f docker-compose.prod.yml logs -f

# ===========================================
# UTILITY COMMANDS
# ===========================================

clean: ## Clean all containers and volumes
	@echo "🧹 Cleaning All Containers and Volumes..."
	docker compose down -v --remove-orphans
	docker compose -f docker-compose.dev-simple.yml down -v --remove-orphans
	docker compose -f docker-compose.staging.yml down -v --remove-orphans
	docker compose -f docker-compose.prod.yml down -v --remove-orphans
	docker system prune -f
	@echo "✅ Cleanup complete"

# Show help by default
.DEFAULT_GOAL := help