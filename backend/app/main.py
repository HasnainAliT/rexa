"""RExA FastAPI application entrypoint.

Run from the `backend/` directory with:
    uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

import json
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import ModelVersion, Question, User
from app.routers import (
    analysis,
    analytics,
    annotations,
    auth,
    batch,
    models_admin,
    questions,
    reports,
)
from app.security import hash_password

SEED_USERS = [
    {"email": "admin@earas.edu", "password": "Admin1234", "name": "RExA Admin", "role": "admin"},
    {"email": "analyst@earas.edu", "password": "Analyst1234", "name": "RExA Analyst", "role": "analyst"},
]

REPO_ROOT = Path(__file__).resolve().parents[2]
SAMPLE_QUESTIONS_PATH = REPO_ROOT / "data" / "raw" / "sample_questions.json"


def seed_database() -> None:
    db = SessionLocal()
    try:
        admin_id: str | None = None
        for seed in SEED_USERS:
            existing = db.query(User).filter(User.email == seed["email"]).first()
            if existing:
                if seed["role"] == "admin":
                    admin_id = existing.id
                continue
            user = User(
                email=seed["email"],
                name=seed["name"],
                hashed_password=hash_password(seed["password"]),
                role=seed["role"],
            )
            db.add(user)
            db.flush()
            if seed["role"] == "admin":
                admin_id = user.id

        # Seed sample questions once
        if db.query(Question).count() == 0 and SAMPLE_QUESTIONS_PATH.exists():
            try:
                samples = json.loads(SAMPLE_QUESTIONS_PATH.read_text(encoding="utf-8"))
            except Exception:
                samples = []
            for item in samples:
                db.add(
                    Question(
                        title=item.get("title") or item.get("prompt", "Question")[:120],
                        prompt=item.get("prompt") or item.get("title", ""),
                        reference_answer=item.get("reference_answer", ""),
                        concepts=item.get("concepts") or [],
                        course=item.get("course"),
                        created_by=admin_id,
                    )
                )

        # Seed model versions once
        if db.query(ModelVersion).count() == 0:
            db.add(
                ModelVersion(
                    name="REXA Heuristic Pipeline",
                    version="heuristic-v1",
                    description="Rule-based REXA stages for demos without GPU.",
                    is_active=settings.MODEL_MODE.lower() != "trained",
                    metrics_json={"mode": "heuristic", "accuracy": 0.0},
                )
            )
            db.add(
                ModelVersion(
                    name="REXA Trained Sklearn Ensemble",
                    version="trained-sklearn-v1",
                    description="TF-IDF + sklearn models trained on the small annotated CS/SE pilot set.",
                    is_active=False,
                    metrics_json={
                        "mode": "trained",
                        "accuracy": 0.85,
                        "modules": [
                            "sentence_roles",
                            "concept_coverage",
                            "support_contradiction",
                            "reasoning_depth",
                            "star_prediction",
                        ],
                    },
                )
            )
            db.add(
                ModelVersion(
                    name="RExA Large AES/SAS Ensemble",
                    version="trained-large-aes-v1",
                    description=(
                        "Trained on ~25.7k public ASAP 2.0 + ASAP-SAS (AERA) responses. "
                        "Gold stars from human scores; structural labels are silver."
                    ),
                    is_active=settings.MODEL_MODE.lower() == "trained",
                    metrics_json={
                        "mode": "trained",
                        "corpus_size": 25728,
                        "star_mae": 0.6032,
                        "star_spearman": 0.7427,
                        "role_accuracy": 0.9588,
                        "modules": [
                            "sentence_roles",
                            "concept_coverage",
                            "support_contradiction",
                            "reasoning_depth",
                            "star_prediction",
                        ],
                    },
                )
            )
            db.add(
                ModelVersion(
                    name="RExA DistilBERT Star Scorer",
                    version="trained-distilbert-v1",
                    description=(
                        "DistilBERT (distilbert-base-uncased) fine-tuned on ASAP 2.0 + ASAP-SAS "
                        "for 1–5 star regression. Train in Google Colab, then place checkpoint under "
                        "ml/checkpoints/distilbert_stars/model/. Uses sklearn RExA modules for explanations."
                    ),
                    is_active=False,
                    metrics_json={
                        "mode": "trained",
                        "backend": "transformers",
                        "base_model": "distilbert-base-uncased",
                        "train_guide": "docs/colab_distilbert.md",
                        "modules": ["star_prediction"],
                    },
                )
            )

        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_database()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    description="RExA API — Explainable Reasoning Analysis of Descriptive Answers.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    if errors:
        first = errors[0]
        loc = ".".join(str(part) for part in first.get("loc", []) if part != "body")
        message = f"{loc}: {first.get('msg')}" if loc else first.get("msg", "Validation error")
    else:
        message = "Validation error"

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"message": message, "success": False, "data": None},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    detail = exc.detail
    message = detail if isinstance(detail, str) else "Request failed"
    return JSONResponse(
        status_code=exc.status_code,
        content={"message": message, "success": False, "data": None},
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"message": "Internal server error", "success": False, "data": None},
    )


api_prefix = settings.API_PREFIX

app.include_router(auth.router, prefix=api_prefix)
app.include_router(questions.router, prefix=api_prefix)
app.include_router(analysis.router, prefix=api_prefix)
app.include_router(reports.router, prefix=api_prefix)
app.include_router(analytics.router, prefix=api_prefix)
app.include_router(annotations.router, prefix=api_prefix)
app.include_router(models_admin.router, prefix=api_prefix)
app.include_router(batch.router, prefix=api_prefix)


@app.get(f"{api_prefix}/health", tags=["health"])
def health_check():
    return {"status": "ok", "service": settings.PROJECT_NAME, "model_mode": settings.MODEL_MODE}


@app.get("/", tags=["health"])
def root():
    return {"message": f"{settings.PROJECT_NAME} is running. See /docs for API documentation."}
