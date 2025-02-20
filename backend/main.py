from peft import PeftModel
import torch
from fastapi import FastAPI, Request, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
import platform
from authlib.integrations.starlette_client import OAuth
from models import Session as DBSession, ComparisonResult
import random
from config import Config
import secrets
from starlette.middleware.sessions import SessionMiddleware

app = FastAPI()

# Session configuration
app.add_middleware(
    SessionMiddleware,
    secret_key=Config.SECRET_KEY or secrets.token_hex(32),
    session_cookie="pepsi_session",
    max_age=7 * 24 * 60 * 60,  # 7 days in seconds
    same_site="lax",
    https_only=False,  # Set to True in production
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[Config.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Cookie"],
    expose_headers=["Content-Type", "Set-Cookie", "*"],
)

# OAuth setup
oauth = OAuth()
oauth.register(
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
load_in_4bit = True and not IS_MACOS

def load_base_model(model_name):
    global load_in_4bit

    if IS_MACOS:
        from transformers import AutoModelForCausalLM, AutoTokenizer
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            device_map="auto",
            torch_dtype=torch.float32 if device == "mps" else torch.float16
        )
        tokenizer = AutoTokenizer.from_pretrained(model_name)
    else:
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

# Load models
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

@app.get("/")
async def home():
    return {"message": "API is running"}

@app.post("/api/generate")
async def generate(request: Request, prefix: str = Form(...)):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")

    model_a_is_base = random.choice([True, False])

    base_response = test_completion(base_model, tokenizer, [{"prefix": prefix, "suffix": ""}])
    peft_response = test_completion(peft_model, tokenizer, [{"prefix": prefix, "suffix": ""}])

    print(f"Model A is {'base' if model_a_is_base else 'finetuned'} model")

    return {
        'modelA': base_response[0] if model_a_is_base else peft_response[0],
        'modelB': peft_response[0] if model_a_is_base else base_response[0],
        'modelAIsBase': model_a_is_base
    }

@app.get("/auth/login")
async def github_login(request: Request, redirect_uri: str = Config.FRONTEND_URL):
    request.session['redirect_uri'] = redirect_uri
    return await oauth.github.authorize_redirect(
        request, request.url_for('github_callback')
    )

@app.get("/auth/callback")
async def github_callback(request: Request):
    try:
        token = await oauth.github.authorize_access_token(request)
        resp = await oauth.github.get('user', token=token)
        user_info = resp.json()

        # Store user info in session
        request.session['user'] = {
            'username': user_info['login'],
            'avatar_url': user_info['avatar_url']
        }

        redirect_uri = request.session.pop('redirect_uri', Config.FRONTEND_URL)
        response = RedirectResponse(url=redirect_uri)
        return response

    except Exception as e:
        print(f"Auth error: {e}")  # Log the error
        return RedirectResponse(url=f"{Config.FRONTEND_URL}/auth/error")

@app.get("/auth/logout")
async def logout(request: Request):
    request.session.pop('user', None)
    return {"success": True, "message": "Logged out successfully"}

@app.get("/auth/user")
async def get_user(request: Request):
    return request.session.get('user', {})

@app.post("/submit-preference")
async def submit_preference(request: Request):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")

    data = await request.json()
    db_session = DBSession()

    result = ComparisonResult(
        github_username=request.session['user']['username'],
        base_model_name=Config.BASE_MODEL_NAME,
        finetuned_model_name=Config.FINETUNED_MODEL_NAME,
        preferred_model=data['preferredModel'],
        code_prefix=data['codePrefix'],
        model_a_was_base=data['modelAWasBase']
    )

    db_session.add(result)
    db_session.commit()
    db_session.close()

    return {"success": True}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)