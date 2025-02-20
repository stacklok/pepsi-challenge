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

## Server Setup

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

### Running the Server

You can start the server in two ways:

1. Using Python:
```bash
python main.py
```

2. Using uvicorn directly (recommended for development):
```bash
uvicorn backend.main:app --reload --port 8000
```

The `--reload` flag enables auto-reload during development.

Access points:
- API: http://localhost:8000
- Interactive API docs: http://localhost:8000/docs
- Alternative API docs: http://localhost:8000/redoc

### Prerequisites

The test environment supports:
- NVIDIA GPUs: Deep Learning VM with CUDA 12.1, M126, Debian 11, Python 3.10
- Apple Silicon: macOS with Python 3.10+ and PyTorch 2.0+

The application will automatically detect the available GPU type and optimize accordingly.

## Setup

### Backend Setup

1. Create a GitHub OAuth application at https://github.com/settings/developers
   - Set Homepage URL to `http://localhost:3000`
   - Set Authorization callback URL to `http://localhost:8000/auth/callback`

2. Create a `.env` file in the `backend` directory:
   ```env
   SESSION_SECRET_KEY=your-secret-key-here
   GITHUB_CLIENT_ID=your-github-client-id
   GITHUB_CLIENT_SECRET=your-github-client-secret
   GITHUB_CALLBACK_URL=http://localhost:8000/auth/callback
   
   # Model Configuration
   BASE_MODEL_NAME=Qwen/Qwen2.5-Coder-0.5B
   FINETUNED_MODEL_NAME=stacklok/Qwen2.5-Coder-0.5B-codegate
   FRONTEND_URL=http://localhost:3000
   ```

### Frontend Setup

1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:8000

## Viewing Results

To view the comparison results, use the following command:

```bash
sqlite3 comparisons.db <<EOF
.mode column
.headers on
SELECT 
    cr.github_username as "GitHub Username",
    cr.preferred_model as "Preferred Model",
    substr(cr.code_prefix, 1, 30) as "Code Prefix (first 30 chars)",
    cr.model_a_was_base as "Model A was Base?",
    datetime(cr.created_at, 'localtime') as "Submission Time"
FROM comparison_results cr
ORDER BY cr.created_at DESC;
EOF
```

This will show:
- The GitHub username of who made the comparison
- Which model they preferred ('base' or 'finetuned')
- First 30 characters of their code prefix
- Whether Model A was the base model
- When the comparison was made (in local time)

## API Documentation

You can access interactive API documentation:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

These provide detailed documentation of all available endpoints, request/response schemas,
and the ability to test endpoints directly from the browser.




