from peft import PeftModel
import torch
from fastapi import FastAPI, Request, HTTPException, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse, FileResponse, StreamingResponse
import platform
from authlib.integrations.starlette_client import OAuth
from models import Session as DBSession, ComparisonResult
import random
from config import Config
import secrets
from starlette.middleware.sessions import SessionMiddleware
from typing import Optional
from sqlalchemy import or_
import os
import csv
import io
import json


app = FastAPI()

# Session configuration
app.add_middleware(
    SessionMiddleware,
    secret_key=Config.SECRET_KEY or secrets.token_hex(32),
    session_cookie="pepsi_session",
    max_age=7 * 24 * 60 * 60,  # 7 days in seconds
    same_site="lax",
    https_only=False,  # Set to True once certs are sorted out and we deploy to AWS!
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

@app.post("/api/submit-preference")
async def submit_preference(request: Request):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")

    data = await request.json()
    db_session = DBSession()

    try:
        result = ComparisonResult(
            github_username=request.session['user']['username'],
            base_model_name=Config.BASE_MODEL_NAME,
            finetuned_model_name=Config.FINETUNED_MODEL_NAME,
            preferred_model=data['preferredModel'],
            code_prefix=data['codePrefix'],
            base_completion=data['baseCompletion'],
            finetuned_completion=data['finetunedCompletion']
        )

        db_session.add(result)
        db_session.commit()
        return {"success": True}
    except Exception as e:
        db_session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db_session.close()

@app.get("/auth/login")
async def github_login(request: Request, redirect_uri: str = Config.FRONTEND_URL):
    request.session['redirect_uri'] = redirect_uri
    return await oauth.github.authorize_redirect(
        request, request.url_for('github_callback')
    )

def is_allowed_user(username: str) -> bool:
    allowed_users = os.getenv('ALLOWED_USERS', '').strip().split(',')
    return username.strip() in [u.strip() for u in allowed_users if u]

@app.get("/auth/callback")
async def github_callback(request: Request):
    try:
        token = await oauth.github.authorize_access_token(request)
        resp = await oauth.github.get('user', token=token)
        user_info = resp.json()

        username = user_info['login']

        # Check if user is allowed
        if not is_allowed_user(username):
            return RedirectResponse(
                url=f"{Config.FRONTEND_URL}/error?type=access_denied&message=Sorry, this is a limited access preview. Your GitHub username ({username}) is not on the allowed users list."
            )

        # Store user info in session
        request.session['user'] = {
            'username': username,
            'avatar_url': user_info['avatar_url']
        }

        redirect_uri = request.session.pop('redirect_uri', Config.FRONTEND_URL)
        return RedirectResponse(url=redirect_uri)

    except Exception as e:
        print(f"Auth error: {e}")  # Log the error
        return RedirectResponse(
            url=f"{Config.FRONTEND_URL}/error?type=authentication_error&message=An authentication error occurred"
        )

@app.get("/auth/logout")
async def logout(request: Request):
    request.session.pop('user', None)
    return {"success": True, "message": "Logged out successfully"}

@app.get("/auth/user")
async def get_user(request: Request):
    return request.session.get('user', {})

def is_admin(username: str) -> bool:
    admin_users = Config.ADMIN_USERS.split(',')
    return username in admin_users

@app.get("/auth/is_admin")
async def check_admin(request: Request):
    if "user" not in request.session:
        return {"is_admin": False}
    return {"is_admin": is_admin(request.session["user"]["username"])}

@app.get("/api/admin/results")
async def get_results(
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    search: Optional[str] = None
):
    if "user" not in request.session or not is_admin(request.session["user"]["username"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    db_session = DBSession()
    query = db_session.query(ComparisonResult)

    if search:
        search = f"%{search}%"
        query = query.filter(
            or_(
                ComparisonResult.github_username.ilike(search),
                ComparisonResult.code_prefix.ilike(search),
                ComparisonResult.preferred_model.ilike(search)
            )
        )

    # Get total count for pagination
    total = query.count()

    # Get paginated results
    results = query.order_by(ComparisonResult.created_at.desc()) \
                  .offset((page - 1) * per_page) \
                  .limit(per_page) \
                  .all()

    # Convert results to dict with both completions
    results = [{
        "id": r.id,
        "github_username": r.github_username,
        "preferred_model": r.preferred_model,
        "code_prefix": r.code_prefix,
        "base_completion": r.base_completion,
        "finetuned_completion": r.finetuned_completion,
        "created_at": r.created_at.isoformat(),
        "completions": [
            {
                "model": "base",
                "completion": r.base_completion,
                "is_selected": r.preferred_model == "base"
            },
            {
                "model": "finetuned",
                "completion": r.finetuned_completion,
                "is_selected": r.preferred_model == "finetuned"
            }
        ]
    } for r in results]

    db_session.close()

    return {
        "results": results,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page
    }

@app.get("/auth/error")
async def auth_error(request: Request, type: str = None, message: str = None):
    return JSONResponse({
        "error": type or "authentication_error",
        "message": message or "An authentication error occurred"
    })

@app.get("/api/admin/stats")
async def get_stats(request: Request):
    if "user" not in request.session or not is_admin(request.session["user"]["username"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    db_session = DBSession()

    # Get total counts for each model preference
    base_count = db_session.query(ComparisonResult).filter(
        ComparisonResult.preferred_model == 'base'
    ).count()

    finetuned_count = db_session.query(ComparisonResult).filter(
        ComparisonResult.preferred_model == 'finetuned'
    ).count()

    total_comparisons = base_count + finetuned_count

    # Calculate percentages
    base_percentage = (base_count / total_comparisons * 100) if total_comparisons > 0 else 0
    finetuned_percentage = (finetuned_count / total_comparisons * 100) if total_comparisons > 0 else 0

    db_session.close()

    return {
        "total_comparisons": total_comparisons,
        "model_preferences": [
            {
                "model": "base",
                "count": base_count,
                "percentage": round(base_percentage, 1)
            },
            {
                "model": "finetuned",
                "count": finetuned_count,
                "percentage": round(finetuned_percentage, 1)
            }
        ]
    }

@app.get("/api/analytics/performance")
async def get_performance_metrics(request: Request):
    if "user" not in request.session or not is_admin(request.session["user"]["username"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    db_session = DBSession()

    # Add metrics like:
    # - Average completion time
    # - Token usage
    # - Most common user preferences by code category
    # - Success/error rates

    return {
        "metrics": {
            "avg_completion_time": 1.2,  # seconds
            "token_usage": {
                "base_model": 12500,
                "finetuned_model": 13200
            },
            "preference_by_category": {
                "API Routes": "finetuned",
                "Database": "base",
                # etc
            }
        }
    }

@app.post("/api/review")
async def generate_review(request: Request, code: str = Form(...)):
    """Generate code review comments from both models"""

    prompt = f"Review this code and suggest improvements:\n{code}"

    base_review = test_completion(base_model, tokenizer, [{"prefix": prompt, "suffix": ""}])
    finetuned_review = test_completion(peft_model, tokenizer, [{"prefix": prompt, "suffix": ""}])

    return {
        "base_review": base_review[0],
        "finetuned_review": finetuned_review[0]
    }

@app.get("/api/admin/export")
async def export_results(request: Request, format: str = "csv"):
    if "user" not in request.session or not is_admin(request.session["user"]["username"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    db_session = DBSession()
    results = db_session.query(ComparisonResult).all()

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            'ID',
            'Username',
            'Preferred Model',
            'Original Prompt',
            'Selected Completion',
            'Rejected Completion',
            'Created At'
        ])

        for result in results:
            # Determine which completion was selected/rejected
            selected_completion = (
                result.base_completion if result.preferred_model == 'base'
                else result.finetuned_completion
            )
            rejected_completion = (
                result.finetuned_completion if result.preferred_model == 'base'
                else result.base_completion
            )

            writer.writerow([
                result.id,
                result.github_username,
                result.preferred_model,
                result.code_prefix,
                selected_completion,
                rejected_completion,
                result.created_at.isoformat()
            ])

        output.seek(0)
        db_session.close()

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=comparison-results.csv"}
        )

    elif format == "json":
        data = [{
            "id": r.id,
            "github_username": r.github_username,
            "preferred_model": r.preferred_model,
            "code_prefix": r.code_prefix,
            "base_completion": r.base_completion,
            "finetuned_completion": r.finetuned_completion,
            "base_model_name": r.base_model_name,
            "finetuned_model_name": r.finetuned_model_name,
            "created_at": r.created_at.isoformat(),
            "completions": [
                {
                    "model": "base",
                    "completion": r.base_completion,
                    "is_selected": r.preferred_model == "base"
                },
                {
                    "model": "finetuned",
                    "completion": r.finetuned_completion,
                    "is_selected": r.preferred_model == "finetuned"
                }
            ]
        } for r in results]

        db_session.close()

        # Use json.dumps with proper formatting
        json_str = json.dumps(data, indent=2, ensure_ascii=False)

        return StreamingResponse(
            iter([json_str]),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=comparison-results.json"}
        )

@app.post("/api/collaborate")
async def start_collaboration(request: Request):
    """Allow multiple users to review the same completion"""

    session_id = secrets.token_urlsafe(16)

    # Store collaboration session
    collaboration_sessions[session_id] = {
        "code_prefix": request.json["prefix"],
        "participants": [request.session["user"]["username"]],
        "votes": {
            "base": 0,
            "finetuned": 0
        }
    }

    return {"session_id": session_id}

@app.post("/api/explain")
async def explain_completion(request: Request, completion_id: int):
    """Generate explanation of why the model produced this completion"""

    db_session = DBSession()
    completion = db_session.query(ComparisonResult).get(completion_id)

    explanation_prompt = f"Explain why you generated this completion:\n{completion.code_prefix}\n{completion.base_completion}"

    explanation = test_completion(base_model, tokenizer, [{"prefix": explanation_prompt, "suffix": ""}])

    return {"explanation": explanation[0]}

@app.get("/api/user/stats")
async def get_user_stats(request: Request):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")

    username = request.session["user"]["username"]
    db_session = DBSession()

    # Get user's comparison history
    user_comparisons = db_session.query(ComparisonResult).filter(
        ComparisonResult.github_username == username
    ).order_by(ComparisonResult.created_at.desc()).all()

    # Calculate statistics
    total_comparisons = len(user_comparisons)
    base_preferred = sum(1 for c in user_comparisons if c.preferred_model == 'base')
    finetuned_preferred = total_comparisons - base_preferred

    # Get recent comparisons
    recent_comparisons = [
        {
            "id": c.id,
            "code_prefix": c.code_prefix[:100] + "..." if len(c.code_prefix) > 100 else c.code_prefix,
            "preferred_model": c.preferred_model,
            "created_at": c.created_at.isoformat()
        }
        for c in user_comparisons[:5]  # Last 5 comparisons
    ]

    db_session.close()

    return {
        "total_comparisons": total_comparisons,
        "preferences": {
            "base": base_preferred,
            "finetuned": finetuned_preferred
        },
        "recent_comparisons": recent_comparisons
    }

@app.get("/api/admin/analytics")
async def get_analytics(request: Request):
    if "user" not in request.session or not is_admin(request.session["user"]["username"]):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db_session = DBSession()
    
    # Get all results ordered by date
    results = db_session.query(ComparisonResult).order_by(ComparisonResult.created_at).all()
    
    # Calculate daily statistics
    daily_stats = {}
    user_stats = {}
    total_users = set()
    
    for result in results:
        date = result.created_at.date().isoformat()
        total_users.add(result.github_username)
        
        # Initialize daily stats
        if date not in daily_stats:
            daily_stats[date] = {
                "total": 0,
                "base_preferred": 0,
                "finetuned_preferred": 0,
                "unique_users": set()
            }
            
        daily_stats[date]["total"] += 1
        daily_stats[date]["unique_users"].add(result.github_username)
        if result.preferred_model == "base":
            daily_stats[date]["base_preferred"] += 1
        else:
            daily_stats[date]["finetuned_preferred"] += 1
            
        # Track user preferences
        if result.github_username not in user_stats:
            user_stats[result.github_username] = {
                "total": 0,
                "base_preferred": 0,
                "finetuned_preferred": 0
            }
        user_stats[result.github_username]["total"] += 1
        if result.preferred_model == "base":
            user_stats[result.github_username]["base_preferred"] += 1
        else:
            user_stats[result.github_username]["finetuned_preferred"] += 1
    
    # Format daily stats for the response
    daily_data = [{
        "date": date,
        "total_comparisons": stats["total"],
        "base_preferred": stats["base_preferred"],
        "finetuned_preferred": stats["finetuned_preferred"],
        "unique_users": len(stats["unique_users"])
    } for date, stats in daily_stats.items()]
    
    # Calculate user engagement metrics
    user_engagement = {
        "total_users": len(total_users),
        "avg_comparisons_per_user": sum(u["total"] for u in user_stats.values()) / len(total_users) if total_users else 0,
        "most_active_users": sorted(
            [{"username": u, "total": s["total"]} for u, s in user_stats.items()],
            key=lambda x: x["total"],
            reverse=True
        )[:5]
    }
    
    db_session.close()
    
    return {
        "daily_stats": daily_data,
        "user_engagement": user_engagement,
        "model_performance": {
            "base_model": {
                "total_preferred": sum(1 for r in results if r.preferred_model == "base"),
                "percentage": sum(1 for r in results if r.preferred_model == "base") / len(results) * 100 if results else 0
            },
            "finetuned_model": {
                "total_preferred": sum(1 for r in results if r.preferred_model == "finetuned"),
                "percentage": sum(1 for r in results if r.preferred_model == "finetuned") / len(results) * 100 if results else 0
            }
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)