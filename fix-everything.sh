# Stop everything
docker compose down -v

# The REAL fix - set host directory to PostgreSQL user (UID 70)
sudo rm -rf ./data/postgres/*
sudo mkdir -p ./data/postgres
sudo chown -R 70:70 ./data/postgres
sudo chmod -R 755 ./data/postgres

# Use STANDARD PostgreSQL (no root user)
cat > docker-compose.yml << 'EOF'
services:
  frontend-build:
    build:
      context: ./frontend
      dockerfile: Dockerfile.build
    container_name: saatvik-el-frontend-build
    volumes:
      - ./app/static:/app/dist:rw
    environment:
      - NODE_ENV=production

  postgres:
    image: postgres:15.0-alpine
    container_name: saatvik-el-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: saatvik_el_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - ./data/postgres:/var/lib/postgresql/data:rw
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  fastapi-app:
    build: .
    container_name: saatvik-el-api
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:postgres@postgres:5432/saatvik_el_db
      EL_FOLDER_PATH: "/mnt/shared"
      CONFIDENCE_THRESHOLD: 0.2
    volumes:
      - ./source:/app/source:rw
      - ./processed:/app/processed:rw
      - ./backup:/app/backup:rw
      - ./logs:/app/logs:rw
      - ./watchdog:/app/watchdog:rw
      - /mnt/shared:/mnt/shared:ro
      - ./app:/app/app:ro
      - ./models:/app/models:ro
      - ./app/static:/app/app/static:ro
      - ./shared_config.json:/app/shared_config.json:ro
    depends_on:
      postgres:
        condition: service_healthy
      frontend-build:
        condition: service_completed_successfully
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
EOF

# Start services
make dev