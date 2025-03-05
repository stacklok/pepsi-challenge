# Start with NVIDIA CUDA 12.1 as the base image
FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04

# Set environment variables to ensure non-interactive installation
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/python/bin:$PATH" \
    DEBIAN_FRONTEND=noninteractive \
    TZ=Etc/UTC

# Set timezone non-interactively
RUN ln -fs /usr/share/zoneinfo/Etc/UTC /etc/localtime && \
    apt-get update && apt-get install -y tzdata && \
    dpkg-reconfigure --frontend noninteractive tzdata

# Install system dependencies and Python
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    wget \
    software-properties-common \
    && add-apt-repository -y ppa:deadsnakes/ppa \
    && apt-get update \
    && apt-get install -y python3.10 python3.10-venv python3.10-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create a symlink for python3.10 to python and install pip
RUN ln -sf /usr/bin/python3.10 /usr/bin/python \
    && curl -sS https://bootstrap.pypa.io/get-pip.py | python3.10

# Set up a working directory
WORKDIR /app

# Copy requirements.txt and install dependencies
COPY requirements-cuda.txt .
COPY requirements.txt .
RUN pip install --ignore-installed -r requirements-cuda.txt
RUN pip install unsloth_zoo

# Copy the rest of your application
COPY . .

# Expose port 5000
EXPOSE 5000

# Command to run your application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"]