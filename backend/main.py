from peft import PeftModel
import torch
from flask import Flask, request, render_template_string, session, redirect, url_for
from flask_session import Session
import platform
import os
from flask_cors import CORS
from authlib.integrations.flask_client import OAuth
from models import Session as DBSession, ComparisonResult
import random
from config import Config
from datetime import timedelta
import secrets
import time
from apscheduler.schedulers.background import BackgroundScheduler

app = Flask(__name__)
app.secret_key = Config.SECRET_KEY or secrets.token_hex(32)

# Session configuration
app.config.update(
    SESSION_COOKIE_NAME='pepsi_session',  # Custom session cookie name
    SESSION_COOKIE_SECURE=False,  # Set to True in production with HTTPS
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_PATH='/',
    SESSION_COOKIE_DOMAIN='localhost',  # Explicitly set for development
    PERMANENT_SESSION_LIFETIME=timedelta(days=7),
    SESSION_TYPE='filesystem',
    SESSION_FILE_DIR=Config.SESSION_FILE_DIR,  # Directory to store session files
    SESSION_FILE_MODE=0o600,  # Secure file permissions (owner read/write only)
    SESSION_FILE_THRESHOLD=500  # Maximum number of sessions
)

# Create sessions directory with secure permissions
if not os.path.exists(Config.SESSION_FILE_DIR):
    os.makedirs(Config.SESSION_FILE_DIR, mode=0o700)  # Only owner can read/write/execute
else:
    # Ensure correct permissions on existing directory
    os.chmod(Config.SESSION_FILE_DIR, 0o700)

# Initialize Flask-Session after setting config
Session(app)

# Clean up old sessions on startup
def cleanup_old_sessions():
    """Remove expired session files"""
    now = time.time()
    session_dir = Config.SESSION_FILE_DIR
    for filename in os.listdir(session_dir):
        filepath = os.path.join(session_dir, filename)
        try:
            if os.path.getmtime(filepath) + app.config['PERMANENT_SESSION_LIFETIME'].total_seconds() < now:
                os.remove(filepath)
        except OSError:
            pass

CORS(app,
     supports_credentials=True,
     resources={
         r"/*": {
             "origins": [Config.FRONTEND_URL],
             "methods": ["GET", "POST", "OPTIONS"],
             "allow_headers": ["Content-Type", "Authorization", "Cookie"],
             "expose_headers": ["Content-Type", "Set-Cookie", "*"],
             "supports_credentials": True
         }
     })
oauth = OAuth(app)

# Use config
app.config['GITHUB_CLIENT_ID'] = Config.GITHUB_CLIENT_ID
app.config['GITHUB_CLIENT_SECRET'] = Config.GITHUB_CLIENT_SECRET

# Configure GitHub OAuth
github = oauth.register(
    name='github',
    client_id=Config.GITHUB_CLIENT_ID,
    client_secret=Config.GITHUB_CLIENT_SECRET,
    access_token_url=Config.GITHUB_TOKEN_URL,
    access_token_params=None,
    authorize_url=Config.GITHUB_AUTHORIZE_URL,
    authorize_params=None,
    api_base_url=Config.GITHUB_API_BASE_URL,
    client_kwargs={'scope': 'user:email read:user'},
)

def get_device():
    if torch.cuda.is_available():
        return "cuda"
    elif torch.backends.mps.is_available():
        return "mps"
    return "cpu"

device = get_device()
IS_MACOS = platform.system() == "Darwin"

max_seq_length = 2048
dtype = None
load_in_4bit = True and not IS_MACOS  # Need to disable 4-bit quantization on MacOS

def load_base_model(model_name):
    global load_in_4bit

    if IS_MACOS:
        # Use standard transformers library for MacOS
        from transformers import AutoModelForCausalLM, AutoTokenizer

        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            device_map="auto",
            torch_dtype=torch.float32 if device == "mps" else torch.float16
        )
        tokenizer = AutoTokenizer.from_pretrained(model_name)
    else:
        # Use unsloth for CUDA devices
        from unsloth import FastLanguageModel
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=model_name,
            max_seq_length=max_seq_length,
            dtype=dtype,
            load_in_4bit=load_in_4bit,
        )
    return model, tokenizer

def load_peft_model(base_model, peft_model):
    model, tokenizer = load_base_model(base_model)
    model = PeftModel.from_pretrained(model, peft_model)
    return model, tokenizer

# Update model initialization to use config
base_model, tokenizer = load_base_model(Config.BASE_MODEL_NAME)
peft_model, tokenizer = load_peft_model(Config.BASE_MODEL_NAME, Config.FINETUNED_MODEL_NAME)

def test_completion(model, tokenizer, examples):
    examples = [f"""<|fim_prefix|>{x["prefix"]}<|fim_suffix|>{x["suffix"]}<|fim_middle|>""" for x in examples]

    if not IS_MACOS:
        from unsloth import FastLanguageModel
        FastLanguageModel.for_inference(model)

    inputs = tokenizer(examples, padding=True, return_tensors="pt").to(device)
    outputs = model.generate(
        **inputs,
        max_new_tokens=128,
        use_cache=True,
        pad_token_id=tokenizer.pad_token_id
    )
    outputs = tokenizer.batch_decode(outputs)
    outputs = [x.split("<|fim_middle|>")[-1].replace("<|endoftext|>", "") for x in outputs]
    return outputs

@app.route('/', methods=['GET'])
def home():
    return {'message': 'API is running'}, 200

@app.route('/api/generate', methods=['POST'])
def generate():
    if 'user' not in session:
        return {'error': 'Not authenticated'}, 401

    prefix = request.form['prefix']
    model_a_is_base = random.choice([True, False])

    base_response = test_completion(base_model, tokenizer, [{"prefix": prefix, "suffix": ""}])
    peft_response = test_completion(peft_model, tokenizer, [{"prefix": prefix, "suffix": ""}])

    # Log which model is which
    print(f"Model A is {'base' if model_a_is_base else 'finetuned'} model")

    response = {
        'modelA': base_response[0] if model_a_is_base else peft_response[0],
        'modelB': peft_response[0] if model_a_is_base else base_response[0],
        'modelAIsBase': model_a_is_base
    }

    return response

@app.route('/auth/login')
def github_login():
    redirect_uri = request.args.get('redirect_uri', Config.FRONTEND_URL)
    session['redirect_uri'] = redirect_uri
    return github.authorize_redirect(
        redirect_uri=url_for('github_callback', _external=True)
    )

@app.route('/auth/callback')
def github_callback():
    try:
        token = github.authorize_access_token()
        resp = github.get('user', token=token)
        user_info = resp.json()

        # Clear any existing session
        session.clear()

        # Store user info in session
        session['user'] = {
            'username': user_info['login'],
            'avatar_url': user_info['avatar_url']
        }
        
        # Make session permanent and force save
        session.permanent = True
        session.modified = True

        redirect_uri = session.pop('redirect_uri', Config.FRONTEND_URL)
        response = redirect(redirect_uri)
        
        # Add CORS headers to the redirect
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Origin'] = Config.FRONTEND_URL

        return response

    except Exception as e:
        return redirect(f"{Config.FRONTEND_URL}/auth/error")

@app.route('/auth/logout')
def logout():
    session.pop('user', None)
    return {'success': True, 'message': 'Logged out successfully'}, 200

@app.route('/auth/user')
def get_user():
    if 'user' not in session:
        return {}, 200

    return session.get('user', {})

@app.route('/submit-preference', methods=['POST'])
def submit_preference():
    if 'user' not in session:
        return {'error': 'Not authenticated'}, 401

    data = request.json
    db_session = DBSession()

    result = ComparisonResult(
        github_username=session['user']['username'],
        base_model_name="Qwen/Qwen2.5-Coder-0.5B",
        finetuned_model_name="stacklok/Qwen2.5-Coder-0.5B-codegate",
        preferred_model=data['preferredModel'],
        code_prefix=data['codePrefix'],
        model_a_was_base=data['modelAWasBase']
    )

    db_session.add(result)
    db_session.commit()
    db_session.close()

    return {'success': True}

if __name__ == '__main__':
    # Schedule session cleanup every hour
    scheduler = BackgroundScheduler()
    scheduler.add_job(cleanup_old_sessions, 'interval', hours=1)
    scheduler.start()

    app.run(debug=True)