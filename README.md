# Pepsi-Challenge: LLM Model Evaluation

<p align="center">
  <img src="assets/pepsi-logo.png" alt="Pepsi Taste Logo" width="400"/>
</p>

## Overview

Pepsi-Challenge is a server application for testing and validating Stacklok fine-tuned models. It provides support for both NVIDIA GPUs (CUDA) and Apple Silicon (Metal) platforms.

### Hardware Support

- **NVIDIA GPUs**: CUDA 12.1
- **Apple Silicon**: Metal Performance Shaders (MPS)

## Getting Started

### Prerequisites

- Python 3.12
- Node.js (for frontend)
- NVIDIA GPU with CUDA 12.1 or Apple Silicon device

### Installation

1. **Clone the repository**:
```bash
git clone https://github.com/stacklok/pepsi-challenge.git
cd pepsi-challenge
```

2. **Set up the backend**:
```bash
cd backend

# Create and activate Python virtual environment
python3.12 -m venv venv
source venv/bin/activate  # Unix/macOS
# or
.\venv\Scripts\activate  # Windows

# Install dependencies based on platform
# For MacOS:
pip install -r requirements-macos.txt
# For CUDA systems:
pip install -r requirements-cuda.txt
```

### Configuration

1. **Backend Environment Setup** (`backend/.env`):
```env
# Security
SESSION_SECRET_KEY=your-secret-key-here

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=https://your-domain.com/auth/callback

# Model Configuration
BASE_MODEL_NAME=Qwen/Qwen2.5-Coder-0.5B
FINETUNED_MODEL_NAME=stacklok/Qwen2.5-Coder-0.5B-codegate
FRONTEND_URL=https://your-domain.com

# Access Control
ALLOWED_USERS=admin1,admin2
ADMIN_USERS=admin1,admin2

# Development Settings
WATCHFILES_FORCE_POLLING=false
WATCHFILES_IGNORE_PATHS=*/unsloth_compiled_cache/*
```

2. **Frontend Environment Setup** (`frontend/.env`):
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### GitHub OAuth Setup

1. Create a new OAuth application at https://github.com/settings/developers
2. Configure the application:
   - Homepage URL: `https://your-domain.com`
   - Authorization callback URL: `https://your-domain.com/auth/callback`
3. Copy the client ID and secret to your backend `.env` file

## Running the Application

### Local Development

1. **Start the Backend in Development Mode**:
```bash
cd backend
# Enable hot-reload for development
uvicorn main:app --host 127.0.0.1 --port 5000 --reload
```

2. **Start the Frontend in Development Mode**:
```bash
cd frontend
# Install dependencies if not already done
npm install
# Start development server
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

For local development, ensure your `.env` files are configured with local URLs:

1. **Backend** (`backend/.env`):
```env
FRONTEND_URL=http://localhost:3000
GITHUB_CALLBACK_URL=http://localhost:5000/auth/callback
LOCAL_ENV=True
```

2. **Frontend** (`frontend/.env`):
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### Production Deployment

We recommend building a Docker container for the frontend and backend,
and then using that to run the application.  Note that the backend
uses CUDA, so you'll need a *build* machine that has CUDA and a GPU
passed through.  You'll also need to pass through a GPU to the backend
container; the frontend container is just a normal-non-GPU container.

1. **Start the Backend**:
```bash
cd backend
uvicorn main:app --host 127.0.0.1 --port 5000
```

2. **Start the Frontend**:
```bash
cd frontend
npm install --omit=dev
npm run build
npm run start
```

## Access Control

- **Regular Users**: Configure allowed GitHub usernames in `ALLOWED_USERS`
- **Administrators**: Configure admin GitHub usernames in `ADMIN_USERS`

These users will have access to the application and admin panel respectively.

## Config Models

At the moment, the application supports running the comparison of the two models. These
should be configured in the `.env` file.

```env
FINETUNED_MODEL_NAME=stacklok/Qwen2.5-Coder-0.5B-codegate
BASE_MODEL_NAME=Qwen/Qwen2.5-Coder-0.5B
```

The application will then perform a comparison of the two models.
