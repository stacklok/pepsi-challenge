# Stage 1: Build environment
FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04 AS builder

# Set environment variables to ensure non-interactive installation
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DEBIAN_FRONTEND=noninteractive \
    TZ=Etc/UTC

# Set timezone non-interactively
RUN ln -fs /usr/share/zoneinfo/Etc/UTC /etc/localtime && \
    apt-get update && apt-get install -y tzdata && \
    dpkg-reconfigure --frontend noninteractive tzdata

# Install build dependencies and Python 3.10
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    wget \
    python3.10 \
    python3.10-venv \
    python3.10-dev \
    python3-pip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create a virtual environment
RUN python3.10 -m venv /venv
ENV PATH="/venv/bin:$PATH"

# Install pip tools
RUN pip install --upgrade pip wheel setuptools

# Copy and install requirements
WORKDIR /app
COPY requirements.txt requirements-cuda.txt ./
RUN pip install --no-cache-dir -r requirements-cuda.txt
RUN pip install unsloth_zoo

# Stage 2: Runtime environment
FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TZ=Etc/UTC \
    PATH="/venv/bin:$PATH" \
    PYTHONPATH="/app:$PYTHONPATH"

# Set timezone
RUN ln -fs /usr/share/zoneinfo/Etc/UTC /etc/localtime

# Install only runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 \
    python3.10-venv \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /venv /venv

# Set up application
WORKDIR /app
COPY . .

# Expose port
EXPOSE 5000

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"]