from peft import PeftModel
import torch
from fastapi import FastAPI, Request, HTTPException, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import (
    RedirectResponse,
    JSONResponse,
    StreamingResponse,
)
import platform
from authlib.integrations.starlette_client import OAuth
from user_management import Session as UsersDBSession, User
from models import Experiment, Session as DBSession, ComparisonResult, Mode
import random
from config import Config
import secrets
from starlette.middleware.sessions import SessionMiddleware
from typing import Optional
from sqlalchemy import or_, select, case
from migration import migrate_database
import csv
import io
import json

import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


app = FastAPI()

# TODO: remove this and implement a migration system
migrate_database()

# Session configuration
app.add_middleware(
    SessionMiddleware,
    secret_key=secrets.token_hex(32),
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
    allow_methods=["GET", "POST", "OPTIONS", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "Cookie"],
    expose_headers=["Content-Type", "Set-Cookie", "*"],
)

# OAuth setup
oauth = OAuth()
oauth.register(
    name="github",
    client_id=Config.GITHUB_CLIENT_ID,
    client_secret=Config.GITHUB_CLIENT_SECRET,
    access_token_url=Config.GITHUB_TOKEN_URL,
    access_token_params=None,
    authorize_url=Config.GITHUB_AUTHORIZE_URL,
    authorize_params=None,
    api_base_url=Config.GITHUB_API_BASE_URL,
    client_kwargs={"scope": "user:email read:user"},
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
            torch_dtype=torch.float32 if device == "mps" else torch.float16,
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
    if IS_MACOS:
        model, tokenizer = load_base_model(base_model)
        model = PeftModel.from_pretrained(model, peft_model)
    else:
        from unsloth import FastLanguageModel

        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=peft_model,
            max_seq_length=max_seq_length,
            dtype=dtype,
            load_in_4bit=load_in_4bit,
        )
    return model, tokenizer


# Load FIM models
fim_base_model, fim_base_tokenizer = load_base_model(Config.FIM_BASE_MODEL_NAME)
fim_finetuned_model, fim_finetuned_tokenizer = load_peft_model(
    Config.FIM_BASE_MODEL_NAME, Config.FIM_FINETUNED_MODEL_NAME
)

# Load CHAT models
chat_base_model, chat_base_tokenizer = load_base_model(Config.CHAT_BASE_MODEL_NAME)
chat_finetuned_model, chat_finetuned_tokenizer = load_peft_model(
    Config.CHAT_BASE_MODEL_NAME, Config.CHAT_FINETUNED_MODEL_NAME
)


def test_completion(model, tokenizer, prompt, mode="fim"):
    if mode == "fim":
        prompt = [
            f"""<|fim_prefix|>{x["prefix"]}<|fim_suffix|>{x["suffix"]}<|fim_middle|>"""
            for x in prompt
        ]
    elif mode == "chat":
        prompt = [
            f"""<|im_start|>system\nYou are an expert on the Codegate project. Answer user's questions accurately.<|im_end|>\n<|im_start|>user\n{x.strip()}<|im_end|>\n<|im_start|>assistant\n"""
            for x in prompt
        ]

    if not IS_MACOS:
        from unsloth import FastLanguageModel

        FastLanguageModel.for_inference(model)

    inputs = tokenizer(prompt, return_tensors="pt").to(device)

    outputs = model.generate(
        **inputs, max_new_tokens=512, use_cache=True, temperature=0.1, do_sample=True
    )

    outputs = tokenizer.batch_decode(outputs)

    if mode == "fim":
        outputs = [
            x.split("<|fim_middle|>")[-1].replace("<|endoftext|>", "").strip()
            for x in outputs
        ]
    elif mode == "chat":
        outputs = [
            x.split("<|im_start|>assistant")[-1]
            .replace("<|im_end|>", "")
            .replace("<|endoftext|>", "")
            .strip()
            for x in outputs
        ]

    return outputs


@app.get("/")
async def home():
    return {"message": "API is running"}


@app.post("/api/generate")
async def generate(
    request: Request,
    mode: Mode = Form(...),
    prefix: Optional[str] = Form(None),
    suffix: Optional[str] = Form(None),
    prompt: Optional[str] = Form(None),
):
    """
    Endpoint that generate code from the model
    """

    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if mode == "fim":
        if prefix is None:
            raise HTTPException(
                status_code=400, detail="Prefix is required for FIM mode"
            )

    elif mode == "chat":
        if not prompt or prompt.strip() == "":
            chat_prompt = []
        else:
            chat_prompt = [prompt]

    else:
        raise HTTPException(
            status_code=400, detail="Invalid mode. Use 'fim' or 'chat'."
        )

    model_a_is_base = random.choice([True, False])

    if mode == "fim":
        base_response = test_completion(
            fim_base_model,
            fim_base_tokenizer,
            [{"prefix": prefix, "suffix": suffix}],
            mode="fim",
        )
        peft_response = test_completion(
            fim_finetuned_model,
            fim_finetuned_tokenizer,
            [{"prefix": prefix, "suffix": suffix}],
            mode="fim",
        )

    elif mode == "chat":
        base_response = test_completion(
            chat_base_model, chat_base_tokenizer, chat_prompt, mode="chat"
        )
        peft_response = test_completion(
            chat_finetuned_model, chat_finetuned_tokenizer, chat_prompt, mode="chat"
        )

    print(f"Model A is {'base' if model_a_is_base else 'finetuned'} model")

    return {
        "modelA": base_response[0] if model_a_is_base else peft_response[0],
        "modelB": peft_response[0] if model_a_is_base else base_response[0],
        "modelAIsBase": model_a_is_base,
    }


@app.post("/api/submit-preference")
async def submit_preference(request: Request):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")

    data = await request.json()
    db_session = DBSession()

    try:
        # Get the experiment_id string from the request
        experiment_id_str = data.get("experimentId", None)
        experiment = None
        
        if experiment_id_str:
            # Look up the experiment in the database
            experiment = db_session.query(Experiment).filter(
                Experiment.experiment_id == experiment_id_str
            ).first()
            
            # If it doesn't exist, create it
            if not experiment:
                experiment = Experiment(experiment_id=experiment_id_str)
                db_session.add(experiment)
                db_session.flush()  # Get the ID without committing
        
        result = ComparisonResult(
            github_username=request.session["user"]["username"],
            base_model_name=data.get("baseModelName", Config.FIM_BASE_MODEL_NAME),
            finetuned_model_name=data.get("finetunedModelName", Config.FIM_FINETUNED_MODEL_NAME),
            preferred_model=data["preferredModel"],
            code_prefix=data.get("codePrefix", ""),
            base_completion=data["baseCompletion"],
            finetuned_completion=data["finetunedCompletion"],
            experiment_id=experiment.id if experiment else None
        )

        db_session.add(result)
        db_session.commit()
        return {"success": True}
    except Exception as e:
        db_session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db_session.close()


@app.get("/api/config/experiments")
async def get_experiments(request: Request):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"experiments": list(Config.EXPERIMENTS.keys())}

@app.get("/auth/login")
async def github_login(request: Request, redirect_uri: str = Config.FRONTEND_URL):
    request.session["redirect_uri"] = redirect_uri

    if Config.LOCAL_ENV == True:
        return await oauth.github.authorize_redirect(
            request, request.url_for("github_callback")
        )

    # in a deployed environment in front of nginx, the callbackURL
    # is HTTP and we need it to be HTTPS which is why we use the
    # CALLBACK_URL env var
    return await oauth.github.authorize_redirect(request, Config.GITHUB_CALLBACK_URL)


@app.get("/auth/callback")
async def github_callback(request: Request):
    try:
        token = await oauth.github.authorize_access_token(request)
        resp = await oauth.github.get("user", token=token)
        user_info = resp.json()

        username = user_info["login"]

        # Check if user is allowed (if they exist in the users db)
        if await get_user_from_database(username) is None:
            return RedirectResponse(
                url=f"{Config.FRONTEND_URL}/error?type=access_denied&message=Sorry, this is a limited access preview. Your GitHub username ({username}) is not on the allowed users list."
            )

        # Store user info in session
        request.session["user"] = {
            "username": username,
            "avatar_url": user_info["avatar_url"],
        }

        redirect_uri = request.session.pop("redirect_uri", Config.FRONTEND_URL)
        return RedirectResponse(url=redirect_uri)

    except Exception as e:
        print(f"Auth error: {e}")  # Log the error
        return RedirectResponse(
            url=f"{Config.FRONTEND_URL}/error?type=authentication_error&message=An authentication error occurred"
        )


@app.get("/auth/logout")
async def logout(request: Request):
    request.session.pop("user", None)
    return {"success": True, "message": "Logged out successfully"}


@app.get("/auth/user")
async def get_user_from_session(request: Request):
    return request.session.get("user", {})


@app.get("/auth/is_admin")
async def check_admin(request: Request):
    if "user" not in request.session:
        return {"is_admin": False}
    return {"is_admin": is_admin(request.session["user"]["username"])}


def is_admin(username: str) -> bool:
    """
    Check if a user has admin privileges.

    Args:
        username: Username to check

    Returns:
        bool: True if the user exists and is an admin, False otherwise
    """
    db_session = UsersDBSession()
    try:
        query = select(User).where(User.username == username)
        result = db_session.execute(query).first()
        user = result[0]  # Extract User object from result tuple
        return user.admin
    except Exception as e:
        logger.error(f"Error checking admin status: {e}")
        return False
    finally:
        db_session.close()

@app.get("/api/admin/results")
async def get_results(
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    experiment_id: Optional[str] = None,
):
    if "user" not in request.session or not is_admin(
        request.session["user"]["username"]
    ):
        raise HTTPException(status_code=403, detail="Not authorized")

    db_session = DBSession()
    
    # Join the ComparisonResult and Experiment tables
    query = db_session.query(ComparisonResult, Experiment).outerjoin(
        Experiment, ComparisonResult.experiment_id == Experiment.id
    )

    if search:
        search = f"%{search}%"
        query = query.filter(
            or_(
                ComparisonResult.github_username.ilike(search),
                ComparisonResult.code_prefix.ilike(search),
                ComparisonResult.preferred_model.ilike(search),
            )
        )
    
    # Filter by experiment if specified
    if experiment_id:
        query = query.filter(Experiment.experiment_id == experiment_id)

    # Get total count for pagination
    total = query.count()

    # Get paginated results
    query_results = (
        query.order_by(ComparisonResult.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    # Convert results to dict with both completions
    results = []
    for r, exp in query_results:
        result_dict = {
            "id": r.id,
            "github_username": r.github_username,
            "preferred_model": r.preferred_model,
            "code_prefix": r.code_prefix,
            "base_completion": r.base_completion,
            "finetuned_completion": r.finetuned_completion,
            "created_at": r.created_at.isoformat(),
            "base_model_name": r.base_model_name,
            "finetuned_model_name": r.finetuned_model_name,
            "experiment_id": exp.experiment_id if exp else None,
            "completions": [
                {
                    "model": "base",
                    "completion": r.base_completion,
                    "is_selected": r.preferred_model == "base",
                },
                {
                    "model": "finetuned",
                    "completion": r.finetuned_completion,
                    "is_selected": r.preferred_model == "finetuned",
                },
            ],
        }
        results.append(result_dict)

    db_session.close()

    return {
        "results": results,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }


@app.get("/auth/error")
async def auth_error(request: Request, type: str = None, message: str = None):
    return JSONResponse(
        {
            "error": type or "authentication_error",
            "message": message or "An authentication error occurred",
        }
    )


@app.get("/api/admin/stats")
async def get_stats(request: Request):
    if "user" not in request.session or not is_admin(
        request.session["user"]["username"]
    ):
        raise HTTPException(status_code=403, detail="Not authorized")

    db_session = DBSession()

    # Get list of all experiments that have been used
    experiment_records = db_session.query(Experiment).all()
    
    stats = []
    
    # Overall stats (across all experiments)
    base_count = (
        db_session.query(ComparisonResult)
        .filter(ComparisonResult.preferred_model == "base")
        .count()
    )

    finetuned_count = (
        db_session.query(ComparisonResult)
        .filter(ComparisonResult.preferred_model == "finetuned")
        .count()
    )

    total_comparisons = base_count + finetuned_count

    # Calculate percentages
    base_percentage = (
        (base_count / total_comparisons * 100) if total_comparisons > 0 else 0
    )
    finetuned_percentage = (
        (finetuned_count / total_comparisons * 100) if total_comparisons > 0 else 0
    )
    
    stats.append({
        "experiment_id": "all",
        "total_comparisons": total_comparisons,
        "model_preferences": [
            {
                "model": "base",
                "count": base_count,
                "percentage": round(base_percentage, 1),
            },
            {
                "model": "finetuned",
                "count": finetuned_count,
                "percentage": round(finetuned_percentage, 1),
            },
        ],
    })
    
    # Get stats for each experiment
    for experiment in experiment_records:
        exp_base_count = (
            db_session.query(ComparisonResult)
            .filter(ComparisonResult.preferred_model == "base")
            .filter(ComparisonResult.experiment_id == experiment.id)
            .count()
        )

        exp_finetuned_count = (
            db_session.query(ComparisonResult)
            .filter(ComparisonResult.preferred_model == "finetuned")
            .filter(ComparisonResult.experiment_id == experiment.id)
            .count()
        )

        exp_total = exp_base_count + exp_finetuned_count

        # Calculate percentages
        exp_base_percentage = (
            (exp_base_count / exp_total * 100) if exp_total > 0 else 0
        )
        exp_finetuned_percentage = (
            (exp_finetuned_count / exp_total * 100) if exp_total > 0 else 0
        )
        
        stats.append({
            "experiment_id": experiment.experiment_id,  # Use the string ID from the experiment table
            "total_comparisons": exp_total,
            "model_preferences": [
                {
                    "model": "base",
                    "count": exp_base_count,
                    "percentage": round(exp_base_percentage, 1),
                },
                {
                    "model": "finetuned",
                    "count": exp_finetuned_count,
                    "percentage": round(exp_finetuned_percentage, 1),
                },
            ],
        })

    db_session.close()

    return {"stats": stats}


@app.get("/api/analytics/performance")
async def get_performance_metrics(request: Request):
    if "user" not in request.session or not is_admin(
        request.session["user"]["username"]
    ):
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
            "token_usage": {"base_model": 12500, "finetuned_model": 13200},
            "preference_by_category": {
                "API Routes": "finetuned",
                "Database": "base",
                # etc
            },
        }
    }


@app.post("/api/review")
async def generate_review(request: Request, code: str = Form(...)):
    """Generate code review comments from both models"""

    prompt = f"Review this code and suggest improvements:\n{code}"

    base_review = test_completion(
        base_model, tokenizer, [{"prefix": prompt, "suffix": ""}]
    )
    finetuned_review = test_completion(
        peft_model, tokenizer, [{"prefix": prompt, "suffix": ""}]
    )

    return {"base_review": base_review[0], "finetuned_review": finetuned_review[0]}


@app.get("/api/admin/export")
async def export_results(request: Request, format: str = "csv"):
    if "user" not in request.session or not is_admin(
        request.session["user"]["username"]
    ):
        raise HTTPException(status_code=403, detail="Not authorized")

    db_session = DBSession()
    results = db_session.query(ComparisonResult).all()

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "ID",
                "Username",
                "Preferred Model",
                "Original Prompt",
                "Selected Completion",
                "Rejected Completion",
                "Created At",
            ]
        )

        for result in results:
            # Determine which completion was selected/rejected
            selected_completion = (
                result.base_completion
                if result.preferred_model == "base"
                else result.finetuned_completion
            )
            rejected_completion = (
                result.finetuned_completion
                if result.preferred_model == "base"
                else result.base_completion
            )

            writer.writerow(
                [
                    result.id,
                    result.github_username,
                    result.preferred_model,
                    result.code_prefix,
                    selected_completion,
                    rejected_completion,
                    result.created_at.isoformat(),
                ]
            )

        output.seek(0)
        db_session.close()

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=comparison-results.csv"
            },
        )

    elif format == "json":
        data = [
            {
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
                        "is_selected": r.preferred_model == "base",
                    },
                    {
                        "model": "finetuned",
                        "completion": r.finetuned_completion,
                        "is_selected": r.preferred_model == "finetuned",
                    },
                ],
            }
            for r in results
        ]

        db_session.close()

        # Use json.dumps with proper formatting
        json_str = json.dumps(data, indent=2, ensure_ascii=False)

        return StreamingResponse(
            iter([json_str]),
            media_type="application/json",
            headers={
                "Content-Disposition": "attachment; filename=comparison-results.json"
            },
        )


@app.post("/api/collaborate")
async def start_collaboration(request: Request):
    """Allow multiple users to review the same completion"""

    session_id = secrets.token_urlsafe(16)

    # Store collaboration session
    collaboration_sessions[session_id] = {
        "code_prefix": request.json["prefix"],
        "participants": [request.session["user"]["username"]],
        "votes": {"base": 0, "finetuned": 0},
    }

    return {"session_id": session_id}


@app.post("/api/explain")
async def explain_completion(request: Request, completion_id: int):
    """Generate explanation of why the model produced this completion"""

    db_session = DBSession()
    completion = db_session.query(ComparisonResult).get(completion_id)

    explanation_prompt = f"Explain why you generated this completion:\n{completion.code_prefix}\n{completion.base_completion}"

    explanation = test_completion(
        base_model, tokenizer, [{"prefix": explanation_prompt, "suffix": ""}]
    )

    return {"explanation": explanation[0]}


@app.get("/api/user/stats")
async def get_user_stats(request: Request):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")

    username = request.session["user"]["username"]
    db_session = DBSession()

    # Get user's comparison history
    user_comparisons = (
        db_session.query(ComparisonResult)
        .filter(ComparisonResult.github_username == username)
        .order_by(ComparisonResult.created_at.desc())
        .all()
    )

    # Calculate statistics
    total_comparisons = len(user_comparisons)
    base_preferred = sum(1 for c in user_comparisons if c.preferred_model == "base")
    finetuned_preferred = total_comparisons - base_preferred

    # Get recent comparisons
    recent_comparisons = [
        {
            "id": c.id,
            "code_prefix": (
                c.code_prefix[:100] + "..."
                if len(c.code_prefix) > 100
                else c.code_prefix
            ),
            "preferred_model": c.preferred_model,
            "created_at": c.created_at.isoformat(),
        }
        for c in user_comparisons[:5]  # Last 5 comparisons
    ]

    db_session.close()

    return {
        "total_comparisons": total_comparisons,
        "preferences": {"base": base_preferred, "finetuned": finetuned_preferred},
        "recent_comparisons": recent_comparisons,
    }


@app.post("/api/admin/users")
async def post_users(request: Request):
    """
    Add a new user to the database.

    Args:
        username: User's username
        admin: Whether the user is an admin (default: False)
    """
    if "user" not in request.session or not is_admin(
        request.session["user"]["username"]
    ):
        raise HTTPException(status_code=403, detail="Not authorized")

    data = await request.json()
    db_session = UsersDBSession()

    try:
        result = User(username=data.get("username"), admin=data.get("admin", False))

        db_session.add(result)
        db_session.commit()
        return {"success": True}
    except Exception as e:
        db_session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db_session.close()


@app.put("/api/admin/users/{username}/grant-admin")
async def grant_admin(request: Request, username: str):
    """
    Grants Admin to a user in the database.

    Args:
        username: User's username
    """

    if "user" not in request.session or not is_admin(
        request.session["user"]["username"]
    ):
        raise HTTPException(status_code=403, detail="Not authorized")

    db_session = UsersDBSession()

    try:
        query = select(User).where(User.username == username)
        result = db_session.execute(query).first()
        user = result[0]

        user.admin = True
        db_session.commit()
        logger.info(f"Granted admin privileges to user '{username}'")
        return {"success": True}
    except Exception as e:
        db_session.rollback()
        logger.error(f"Error granting admin privileges: {e}")
        return {"success": False}
    finally:
        db_session.close()


@app.put("/api/admin/users/{username}/revoke-admin")
async def revoke_admin(request: Request, username: str):
    """
    Revoke Admin from a user in the database.

    Args:
        username: User's username
    """
    if "user" not in request.session or not is_admin(
        request.session["user"]["username"]
    ):
        raise HTTPException(status_code=403, detail="Not authorized")

    db_session = UsersDBSession()

    try:
        query = select(User).where(User.username == username)
        result = db_session.execute(query).first()
        user = result[0]

        user.admin = False
        db_session.commit()
        logger.info(f"Granted admin privileges to user '{username}'")
        return {"success": True}
    except Exception as e:
        db_session.rollback()
        logger.error(f"Error granting admin privileges: {e}")
        return {"success": False}
    finally:
        db_session.close()


@app.delete("/api/admin/users/{username}")
async def delete_users(request: Request, username: str):
    """
    Deletes new user from the database.

    Args:
        username: User's username
    """
    if "user" not in request.session or not is_admin(
        request.session["user"]["username"]
    ):
        raise HTTPException(status_code=403, detail="Not authorized")

    db_session = UsersDBSession()

    try:
        query = select(User).where(User.username == username)
        user = db_session.execute(query).scalar_one_or_none()

        db_session.delete(user)
        db_session.commit()
        logger.info(f"User '{username}' deleted successfully")
        return {"message": f"User '{username}' deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting user: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to delete user '{username}'"
        )
    finally:
        db_session.close()


@app.get("/api/admin/users")
async def get_users(request: Request, admin_only: bool = False):
    """
    Retrieve users from the database.

    Args:
        admin_only: If True, return only admin users

    Returns:
        List of dictionaries containing user information
    """
    if "user" not in request.session or not is_admin(
        request.session["user"]["username"]
    ):
        raise HTTPException(status_code=403, detail="Not authorized")

    db_session = UsersDBSession()

    try:
        query = select(User)
        if admin_only:
            query = query.where(User.admin == True)

        users = db_session.execute(query).scalars().all()
        user_list = [user.to_dict() for user in users]

        filter_text = "admin users" if admin_only else "users"
        logger.info(f"Retrieved {len(user_list)} {filter_text}")
        return user_list

    except Exception as e:
        logger.error(f"Error retrieving users: {e}")
        return []
    finally:
        db_session.close()


async def get_user_from_database(username: str):
    """
    Retrieve a single user from the database.

    Returns:
        The user data or "None" to indicate no user exists.
    """
    db_session = UsersDBSession()

    try:
        query = select(User).where(User.username == username)
        user = db_session.execute(query).scalar_one_or_none()

        if user is not None:
            logger.info(f"Retrieved user: {username}")
            return user

        logger.info(f"User not found: {username}")
        return None
    except Exception as e:
        logger.error(f"Error retrieving user: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve user '{username}'"
        )
    finally:
        db_session.close()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="localhost", port=8000)
