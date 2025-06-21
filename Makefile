# File: Makefile

# Development Environment (normal commands)
up:
	@echo "🚀 Starting Development Environment..."
	docker compose up -d
	@echo "✅ Development running on http://localhost:8000"

down:
	@echo "⏹️  Stopping Development Environment..."
	docker compose down

logs:
	docker compose logs -f

restart:
	@echo "🔄 Restarting Development..."
	docker compose restart

rebuild:
	@echo "🔨 Rebuilding Development..."
	docker compose build --no-cache
	docker compose up -d

# Staging Environment
up-stage:
	@echo "🎭 Starting Staging Environment..."
	docker compose -f docker-compose.staging.yml up -d
	@echo "✅ Staging running on http://localhost:8001"

down-stage:
	@echo "⏹️  Stopping Staging Environment..."
	docker compose -f docker-compose.staging.yml down

logs-stage:
	docker compose -f docker-compose.staging.yml logs -f

restart-stage:
	@echo "🔄 Restarting Staging..."
	docker compose -f docker-compose.staging.yml restart

rebuild-stage:
	@echo "🔨 Rebuilding Staging..."
	docker compose -f docker-compose.staging.yml build --no-cache
	docker compose -f docker-compose.staging.yml up -d

# Production Environment
up-prod:
	@echo "🏭 Starting Production Environment..."
	docker compose -f docker-compose.prod.yml up -d
	@echo "✅ Production running on http://localhost:8002"

down-prod:
	@echo "⏹️  Stopping Production Environment..."
	docker compose -f docker-compose.prod.yml down

logs-prod:
	docker compose -f docker-compose.prod.yml logs -f

restart-prod:
	@echo "🔄 Restarting Production..."
	docker compose -f docker-compose.prod.yml restart

rebuild-prod:
	@echo "🔨 Rebuilding Production..."
	docker compose -f docker-compose.prod.yml build --no-cache
	docker compose -f docker-compose.prod.yml up -d

# Utility Commands
status:
	@echo "📊 Container Status:"
	@docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

health:
	@echo "💚 Development Health:"
	@curl -s http://localhost:8000/api/v1/health || echo "❌ Dev not running"

health-stage:
	@echo "💚 Staging Health:"
	@curl -s http://localhost:8001/api/v1/health || echo "❌ Staging not running"

health-prod:
	@echo "💚 Production Health:"
	@curl -s http://localhost:8002/api/v1/health || echo "❌ Production not running"

clean:
	@echo "🧹 Stopping all environments..."
	docker compose down
	docker compose -f docker-compose.staging.yml down
	docker compose -f docker-compose.prod.yml down

help:
	@echo "🔧 Saatvik EL Detection - Available Commands:"
	@echo ""
	@echo "Development (Port 8000) - Normal Commands:"
	@echo "  make up            Start development"
	@echo "  make down          Stop development"
	@echo "  make logs          View development logs"
	@echo "  make restart       Restart development"
	@echo "  make rebuild       Rebuild development"
	@echo ""
	@echo "Staging (Port 8001):"
	@echo "  make up-stage      Start staging"
	@echo "  make down-stage    Stop staging"
	@echo "  make logs-stage    View staging logs"
	@echo "  make restart-stage Restart staging"
	@echo "  make rebuild-stage Rebuild staging"
	@echo ""
	@echo "Production (Port 8002):"
	@echo "  make up-prod       Start production"
	@echo "  make down-prod     Stop production"
	@echo "  make logs-prod     View production logs"
	@echo "  make restart-prod  Restart production"
	@echo "  make rebuild-prod  Rebuild production"
	@echo ""
	@echo "Utilities:"
	@echo "  make status        Show all container status"
	@echo "  make health        Check development health"
	@echo "  make health-stage  Check staging health"
	@echo "  make health-prod   Check production health"
	@echo "  make clean         Stop all environments"
	@echo "  make help          Show this help"