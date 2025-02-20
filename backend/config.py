import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    # Flask
    SECRET_KEY = os.getenv('FLASK_SECRET_KEY', 'your-secret-key-for-development')

    # Session
    SESSION_FILE_DIR = os.getenv('SESSION_FILE_DIR', os.path.join(os.path.dirname(__file__), 'sessions'))

    # GitHub OAuth
    GITHUB_CLIENT_ID = os.getenv('GITHUB_CLIENT_ID')
    GITHUB_CLIENT_SECRET = os.getenv('GITHUB_CLIENT_SECRET')
    GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'
    GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
    GITHUB_API_BASE_URL = 'https://api.github.com/'

    # Database
    SQLITE_DB_PATH = os.getenv('SQLITE_DB_PATH', 'comparisons.db')

    # Model configs
    BASE_MODEL_NAME = "Qwen/Qwen2.5-Coder-0.5B"
    FINETUNED_MODEL_NAME = "stacklok/Qwen2.5-Coder-0.5B-codegate"

    # Frontend URL
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')