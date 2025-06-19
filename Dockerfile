FROM python:3.10-slim-bookworm

# Install system dependencies including OpenCV requirements
RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    g++ \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libgtk-3-0 \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libv4l-dev \
    libxvidcore-dev \
    libx264-dev \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    libatlas-base-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install uv

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml ./

# Install dependencies
RUN uv pip install --system --no-cache -r pyproject.toml

# Copy application code
COPY app/ app/
COPY models/ models/
COPY scripts/ scripts/

# Create required directories with proper permissions
RUN mkdir -p source processed backup logs app/static && \
    chmod -R 755 source processed backup logs app/static

# Set environment variables for headless operation
ENV DISPLAY=:99
ENV QT_QPA_PLATFORM=offscreen

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start application (runs as root, but simpler)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]