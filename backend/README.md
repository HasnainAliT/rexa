# RExA Backend

**RExA** (Explainable Reasoning Analysis of Descriptive Answers) backend API — a pipeline for evaluating
students' descriptive/short-answer responses. Built with FastAPI.

This is the API for a Final Year Project on reasoning-based evaluation of student
descriptive answers: given a question, a reference answer, and a student's answer, REXA
identifies the reasoning structure (claims, evidence, explanations, conclusions), measures
concept coverage, detects support/contradiction relationships between sentences, scores
reasoning depth, and produces an overall 1–5 star rating with human-readable explanations.

## Tech Stack

- **FastAPI** + **Uvicorn** — web framework / ASGI server
- **SQLAlchemy 2.x** — ORM (SQLite by default, PostgreSQL supported)
- **Pydantic v2** + **pydantic-settings** — validation & config
- **python-jose** — JWT auth
- **bcrypt** — password hashing
- **scikit-learn** — TF-IDF baseline comparison
- **reportlab** — PDF report generation

No heavy ML dependencies (e.g. PyTorch/transformers) are required to run the default
`MODEL_MODE=heuristic` pipeline — everything runs with plain Python + regex + difflib +
scikit-learn's TF-IDF.

## Project Structure

```
backend/
  requirements.txt
  Dockerfile
  .env.example
  app/
    main.py              # FastAPI app, lifespan, routers, error handlers
    config.py            # Settings (pydantic-settings)
    database.py          # SQLAlchemy engine/session
    deps.py              # Auth dependencies (get_current_user, role guards)
    security.py          # Password hashing + JWT helpers
    models/__init__.py   # SQLAlchemy ORM models
    schemas/__init__.py  # Pydantic request/response schemas
    routers/
      auth.py            # /api/auth/*
      questions.py       # /api/questions*
      analysis.py        # /api/analyze, /api/analyses*
      reports.py         # /api/reports/*
      analytics.py       # /api/analytics/dashboard
      annotations.py     # /api/annotations*
      models_admin.py    # /api/models* (admin model versions)
      batch.py           # /api/batch/analyze, /api/compare, /api/baselines/evaluate
    services/
      rexa_pipeline.py   # Core REXA heuristic pipeline
      explainability.py  # Human-readable explanation generation
      reports.py         # PDF / Markdown report generation
      baselines.py       # Classical baselines (keyword overlap, TF-IDF, embeddings)
```

## Setup

### 1. Create a virtual environment

```bash
cd backend
python -m venv .venv
```

Activate it:

- **Windows (PowerShell):** `.\.venv\Scripts\Activate.ps1`
- **macOS/Linux:** `source .venv/bin/activate`

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and adjust values as needed:

```bash
copy .env.example .env      # Windows
cp .env.example .env         # macOS/Linux
```

By default, the app uses a local SQLite database (`earas.db`) so no extra setup is
required. To use PostgreSQL instead, set:

```
DATABASE_URL=postgresql://user:password@localhost:5432/earas
```

(and make sure `psycopg2-binary`, already in `requirements.txt`, is installed).

### 4. Run the server

From the `backend/` directory:

```bash
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`, with interactive docs at
`http://localhost:8000/docs` (Swagger) and `http://localhost:8000/redoc`.

On first startup, the database schema is created automatically and two accounts are
seeded:

| Role    | Email               | Password    |
|---------|---------------------|-------------|
| admin   | admin@earas.edu     | Admin1234   |
| analyst | analyst@earas.edu   | Analyst1234 |

> Change these credentials before deploying anywhere beyond local development.

## API Overview

All routes are prefixed with `/api`. Every route requires a `Bearer` JWT except
`POST /api/auth/login`, `POST /api/auth/register`, and `GET /api/health`.

Responses follow a consistent envelope matching the frontend's expectations:

```json
{ "data": <T>, "message": "optional message", "success": true }
```

Errors (validation failures, auth failures, not-found, etc.) return:

```json
{ "data": null, "message": "human readable error", "success": false }
```

### Auth

- `POST /api/auth/login` — `{ email, password }` → `{ user, token }`
- `POST /api/auth/register` — `{ name, email, password, confirmPassword }` → `{ user, token }`
- `GET /api/auth/me` — current authenticated user
- `POST /api/auth/logout` — no-op (stateless JWT; client discards token)

### Questions

- `GET /api/questions` — paginated list (supports `search`, `page`, `pageSize`)
- `POST /api/questions` — create (admin/analyst)
- `GET /api/questions/{id}`
- `PUT /api/questions/{id}` — update (admin/analyst)
- `DELETE /api/questions/{id}` — delete (admin/analyst)

### Analysis (REXA)

- `POST /api/analyze` — run REXA on a single student answer. Accepts either
  `question_id` (existing question) or `question_text` + `reference_answer` (ad-hoc).
  Optionally persists the submission + analysis (`save: true`, default).
- `GET /api/analyses` — paginated analysis history
- `GET /api/analyses/{id}` — single analysis run

### Batch / Compare / Baselines

- `POST /api/batch/analyze` — run REXA over a list of student answers for one question
- `POST /api/compare` — run REXA on two answers and return a diff summary
- `GET /api/baselines/evaluate` — run classical baselines (keyword overlap, TF-IDF
  cosine similarity) against a sample question/answer and compare with REXA's rating

### Reports

- `POST /api/reports/{analysis_id}/pdf` — returns a generated PDF report (bytes)
- `GET /api/reports/{analysis_id}/markdown` — returns a Markdown report (text)

### Analytics

- `GET /api/analytics/dashboard` — aggregate stats: total analyses, average stars,
  recent analyses, coverage trend over time, sentence-role distribution

### Annotations (Annotation Lab)

- `GET /api/annotations` — paginated list (filter by `submission_id`)
- `POST /api/annotations` — create human-labeled ground truth (admin/analyst)
- `GET /api/annotations/{id}`
- `PUT /api/annotations/{id}` — update (admin/analyst)
- `DELETE /api/annotations/{id}` — delete (admin/analyst)

### Model Versions (Admin)

- `GET /api/models` — list model versions
- `POST /api/models` — register a new model version (admin)
- `POST /api/models/{id}/activate` — mark a model version active (admin)
- `DELETE /api/models/{id}` — remove a model version (admin)

## The REXA Pipeline

`app/services/rexa_pipeline.py` implements the heuristic REXA pipeline as a set of
small, single-responsibility, swappable stages (SOLID design — each stage is defined
behind a narrow `Protocol` so it can later be replaced by a trained model without
touching the rest of the pipeline):

1. **Sentence splitting** (`RegexSentenceSplitter`) — splits the student answer into
   sentences with character spans.
2. **Sentence role classification** (`KeywordRoleClassifier`) — labels each sentence as
   `Claim`, `Evidence`, `Explanation`, `Conclusion`, or `Other` using keyword/positional
   heuristics.
3. **Concept coverage** (`TokenOverlapConceptMatcher`) — matches required concepts
   against the answer via lowercase token overlap, with a `difflib`-based fuzzy fallback
   for typos/inflections. Produces covered/missing concepts and a coverage percentage.
4. **Support & contradiction analysis** (`CueBasedSupportAnalyzer`) — pairs consecutive
   sentences and classifies their relation as `Supports`, `Neutral`, or `Contradicts`
   using cue-word heuristics (e.g. "therefore", "however", "but").
5. **Reasoning depth** (`ChainReasoningDepthScorer`) — a 0–1 score based on the presence
   of a Claim → Evidence → Explanation chain, support ratio, and answer length.
6. **Star prediction** (`WeightedStarPredictor`) — a weighted aggregate of concept
   coverage, reasoning depth, sentence-role diversity, support ratio, and a
   contradiction penalty, mapped onto a 1–5 star scale.

The orchestrating `RexaPipeline` class wires these stages together and also produces:

- `dimension_scores` — `{ concept_coverage, reasoning_depth, support_quality, role_structure }`
- `explanations` — natural-language reasons (see `app/services/explainability.py`)
- `highlights` — sentences with roles + character spans (for UI highlighting)
- `model_version` — currently always `"heuristic-v1"`

Switching `MODEL_MODE` to `trained` in the future only requires updating
`get_pipeline()` in `rexa_pipeline.py` to construct a `RexaPipeline` with
trained-model-backed stage implementations — no router or schema changes needed.

## Baselines

`app/services/baselines.py` implements simple baseline scoring methods used to
benchmark REXA against classical approaches:

- **Keyword Overlap** — Jaccard-style token overlap between reference and student answers
- **TF-IDF Cosine Similarity** — scikit-learn `TfidfVectorizer` + cosine similarity
- **Embedding Similarity** *(optional)* — skipped gracefully if `sentence-transformers`
  is not installed, keeping the default install lightweight

## Docker

Build and run with Docker:

```bash
docker build -t earas-backend .
docker run -p 8000:8000 --env-file .env earas-backend
```

## Frontend Integration Notes

This API is designed to match the existing EARAS frontend's expectations exactly:

- `ApiResponse<T> = { data: T, message?: string, success: boolean }`
- `User = { id, email, name, avatarUrl?, role }`
- All routes are served under `/api`, matching the frontend's default
  `VITE_API_BASE_URL` of `/api`.
- CORS is pre-configured to allow `http://localhost:5173` (Vite) and
  `http://localhost:3000`.
