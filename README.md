# Pepsi-Challenge: LLM Model Evaluation

<p align="center">
  <img src="assets/pepsi-logo.png" alt="Pepsi Taste Logo" width="400"/>
</p>

## Introduction

### Supported Platforms

This repository contains the server code for testing and validating Stacklok 
fine-tuned models. It supports both NVIDIA GPUs (CUDA) and Apple Silicon (Metal)
platforms, so a local dev environment can be setup.

### GPU Support

- NVIDIA GPUs: CUDA 12.1
- Apple Silicon: Metal Performance Shaders (MPS)

## Deployment

### Development Setup

First, clone the repository:
```bash
git clone https://github.com/stacklok/pepsi-challenge.git
cd pepsi-challenge/
cd backend/

# Create a Python 3.12 virtual environment
python3.12 -m venv venv

# Activate the virtual environment
source venv/bin/activate  # On Unix/macOS
# or
.\venv\Scripts\activate  # On Windows
```

Then install requirements based on your platform:

For MacOS:
```bash
pip install -r requirements-macos.txt
```

For CUDA systems:
```bash
pip install -r requirements-cuda.txt
```

Additionally, install FastAPI dependencies:
```bash
pip install fastapi uvicorn python-multipart authlib starlette
```

### Production Deployment

#### 1. Environment Configuration

Create a `.env` file in the `backend` directory:
```env
SESSION_SECRET_KEY=your-secret-key-here
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=https://your-domain.com/auth/callback

# Model Configuration
BASE_MODEL_NAME=Qwen/Qwen2.5-Coder-0.5B
FINETUNED_MODEL_NAME=stacklok/Qwen2.5-Coder-0.5B-codegate
FRONTEND_URL=https://your-domain.com

# Admin Configuration
ADMIN_USERS=admin1,admin2

# Development Configuration
WATCHFILES_FORCE_POLLING=false
WATCHFILES_IGNORE_PATHS=*/unsloth_compiled_cache/*
```

#### 2. Nginx Configuration

Create a new Nginx configuration file (e.g., `/etc/nginx/sites-available/pepsi-challenge`):

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    # SSL configuration
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Frontend routes
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API and auth routes
    location ~ ^/(api|auth|submit-preference) {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
    }
}
```

Enable the configuration:
```bash
ln -s /etc/nginx/sites-available/pepsi-challenge /etc/nginx/sites-enabled/
nginx -t  # Test the configuration
systemctl reload nginx  # Apply the configuration
```

#### 3. GitHub OAuth Setup

1. Create a GitHub OAuth application at https://github.com/settings/developers
   - Set Homepage URL to `https://your-domain.com`
   - Set Authorization callback URL to `https://your-domain.com/auth/callback`

#### 4. Running Services

1. Backend:
```bash
cd backend
uvicorn main:app --host 127.0.0.1 --port 5000
```

2. Frontend:
```bash
cd frontend
npm run build
npm run start
```

Consider using process managers like PM2 or systemd to manage these services:

```bash
# Using PM2
pm2 start "cd backend && uvicorn main:app --host 127.0.0.1 --port 5000" --name pepsi-backend
pm2 start "cd frontend && npm run start" --name pepsi-frontend
```

## Server Setup

First, clone the repository:
```