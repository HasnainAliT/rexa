"""Application settings, loaded from environment variables / .env file."""
from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict

# Always load backend/.env, even if uvicorn is started from the repo root.
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ENV_FILE = _BACKEND_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "RExA API"
    API_PREFIX: str = "/api"

    # Database
    DATABASE_URL: str = "sqlite:///./earas.db"

    # Auth / JWT
    JWT_SECRET: str = "dev-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days
    TEACHER_SIGNUP_CODE: str = "REXA-TEACH"

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # RExA — trained Core RExA is the proposed / demo pipeline.
    # Heuristic is a fallback if sklearn checkpoints are missing.
    MODEL_MODE: str = "trained"
    # DistilBERT is a comparative scoring experiment — off by default so Core RExA serves demos
    USE_DISTILBERT_STARS: bool = False

    # Real spaCy sentence splitting + SBERT semantic concept matching, as
    # described in the FYP-1 progress PPT tech stack. Off by default; needs:
    #   pip install spacy sentence-transformers
    #   python -m spacy download en_core_web_sm
    # See docs/SRS.md "Pipeline Evolution" for what these replace and why.
    USE_SPACY_SPLITTER: bool = False
    USE_SBERT_CONCEPTS: bool = False

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
