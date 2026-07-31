# RExA — Explainable Reasoning Analysis of Descriptive Answers

**RExA** · Final Year Project

RExA is a web platform for automatically assessing students' **descriptive / short-answer
responses** — not just by keyword matching, but by analyzing the *reasoning structure* of the
answer: what claims are made, what evidence backs them, whether the explanation logically
follows, and whether it reaches a conclusion. Every score RExA produces is accompanied by a
**human-readable explanation**, so students and instructors can see *why* an answer received
the rating it did.

The RExA reasoning-analysis pipeline:

1. Splits a student's answer into sentences and classifies the *role* each sentence plays
   (Claim, Evidence, Explanation, Conclusion, Other).
2. Measures how many of the question's required **concepts** are covered in the answer.
3. Detects **support** and **contradiction** relationships between consecutive sentences.
4. Scores the overall **reasoning depth** (0–1) based on the presence of a
   Claim → Evidence → Explanation → Conclusion chain.
5. Aggregates all of the above into a **1–5 star rating**, plus per-dimension scores and
   plain-English explanations.

> This repository contains the full stack: a React + TypeScript frontend, a FastAPI +
> SQLAlchemy backend implementing the REXA pipeline, and Docker Compose tooling for running
> PostgreSQL and the API in a production-like environment.

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
  - [Option A — Local development (recommended for the FYP demo)](#option-a--local-development-recommended-for-the-fyp-demo)
  - [Option B — Docker Compose (PostgreSQL + API)](#option-b--docker-compose-postgresql--api)
- [Seed Accounts](#seed-accounts)
- [Project Structure](#project-structure)
- [The REXA Pipeline](#the-rexa-pipeline)
- [Documentation](#documentation)
- [License](#license)

---

## Problem Statement

Manually grading descriptive/short-answer exam responses is slow, inconsistent across
graders, and provides students with little insight beyond a raw mark. Existing automated
grading tools mostly rely on **surface-level similarity** (keyword overlap, TF-IDF cosine
similarity, or opaque embedding similarity) between a student's answer and a reference
answer. These approaches:

- Cannot tell the difference between an answer that merely repeats keywords and one that
  actually *reasons* through the concepts (claim → evidence → explanation → conclusion).
- Give a single similarity number with no explanation of *why* an answer scored the way it
  did, which is unhelpful for feedback and indefensible in an academic setting.
- Cannot detect internal contradictions within a student's own answer.

**EARAS/REXA** addresses this gap by evaluating answers along multiple *interpretable*
dimensions (concept coverage, reasoning depth, sentence-role structure, support quality)
and by generating explicit, human-readable explanations for every score, while remaining
fast and dependency-light enough to run entirely on CPU with no GPU or paid API required —
an important constraint for a self-hosted, reproducible FYP submission.

## Features

- **Reasoning-aware scoring** — sentence-role classification (Claim / Evidence /
  Explanation / Conclusion / Other), not just keyword matching.
- **Concept coverage analysis** — token-overlap + fuzzy (typo-tolerant) matching against a
  question's required concept list, with per-concept "covered"/"missing" breakdown.
- **Support & contradiction detection** — cue-word based analysis of how each sentence
  relates to the one before it (`Supports` / `Neutral` / `Contradicts`).
- **Explainable 1–5 star rating** — a weighted aggregate of four dimension scores
  (coverage, depth, role structure, support quality), always paired with natural-language
  explanations of what drove the score up or down.
- **Question bank management** — create/edit/delete questions with reference answers and
  concept lists.
- **Single analysis, batch analysis, and A/B compare** — analyze one answer, a whole class
  of answers against one question, or compare two answers side-by-side.
- **Classical baseline comparison** — Keyword Overlap and TF-IDF Cosine Similarity
  baselines are computed alongside REXA so the pipeline's added value can be measured
  quantitatively (see [`docs/evaluation_report.md`](docs/evaluation_report.md)).
- **Annotation Lab** — human annotators can label ground-truth sentence roles, concept
  coverage, support pairs, reasoning depth and star ratings, to build a dataset for future
  supervised model training and to evaluate REXA's agreement with human judgement.
  See [`docs/annotation_protocol.md`](docs/annotation_protocol.md).
- **Analytics dashboard** — aggregate stats, coverage trend over time, and sentence-role
  distribution charts.
- **PDF / Markdown report export** — per-analysis reports suitable for sharing with
  students or including in an appendix.
- **Role-based auth** — JWT-based authentication with `admin` / `analyst` / `viewer` roles.
- **Model version registry** — a `ModelVersion` table/admin page to track heuristic vs.
  (future) trained model versions and their metrics, so REXA can evolve from a rule-based
  pipeline to a trained model without changing the API contract.

## Architecture

```
┌─────────────────────┐        HTTPS/JSON (fetch, Bearer JWT)      ┌──────────────────────────┐
│   Frontend (SPA)     │ ────────────────────────────────────────► │   Backend API            │
│  React 19 + Vite     │ ◄──────────────────────────────────────── │  FastAPI + SQLAlchemy     │
│  TypeScript, Tailwind│              JSON { data, message, success}│  REXA pipeline (Python)  │
└─────────────────────┘                                            └────────────┬─────────────┘
                                                                                  │
                                                                                  ▼
                                                                     ┌────────────────────────┐
                                                                     │  PostgreSQL / SQLite    │
                                                                     │  (users, questions,     │
                                                                     │   submissions, runs,    │
                                                                     │   annotations, models)  │
                                                                     └────────────────────────┘
```

- **Frontend** — React 19 + TypeScript + Vite, React Router for routing, Tailwind CSS v4 +
  Radix UI primitives (via a small local `shadcn`-style `components/ui` layer) for the
  design system, React Hook Form + Zod for form validation, Recharts for the analytics
  dashboard charts.
- **Backend** — FastAPI (ASGI, auto-generated OpenAPI docs at `/docs`), SQLAlchemy 2.x ORM
  (SQLite for zero-config local dev, PostgreSQL for Docker/production), Pydantic v2 for
  request/response validation, `python-jose` for JWT auth, `bcrypt` for password hashing,
  `reportlab` for PDF report generation.
- **REXA / ML path** — the current, default implementation (`MODEL_MODE=heuristic`) is a
  dependency-light, rule-based pipeline built from small, swappable stages (sentence
  splitting, role classification, concept matching, support analysis, depth scoring, star
  prediction), plus `scikit-learn`'s `TfidfVectorizer` for the TF-IDF baseline. Every stage
  is defined behind a narrow `Protocol` interface specifically so that a future
  **trained model** (e.g. a fine-tuned sentence classifier or a Hugging Face
  `transformers` model for role/relation classification) can be swapped in behind
  `MODEL_MODE=trained` without changing routers, schemas, or the frontend contract. See
  [`docs/architecture.md`](docs/architecture.md) for the full component and sequence
  diagrams, and [`backend/README.md`](backend/README.md) for pipeline internals.

For the full system architecture, data model (ER diagram), and the analyze-request
sequence diagram, see **[docs/architecture.md](docs/architecture.md)**.

## Tech Stack

| Layer      | Technology |
|------------|------------|
| Frontend   | React 19, TypeScript, Vite 8, React Router 7, Tailwind CSS 4, Radix UI, React Hook Form, Zod, Recharts |
| Backend    | Python 3.11, FastAPI, SQLAlchemy 2, Pydantic v2, python-jose (JWT), bcrypt, Uvicorn |
| ML / REXA  | scikit-learn (TF-IDF baseline), difflib (fuzzy concept matching), regex-based NLP heuristics; designed to accommodate a future Hugging Face `transformers` classifier |
| Database   | PostgreSQL 16 (Docker/production) or SQLite (local dev, zero-config) |
| Reports    | ReportLab (PDF), Markdown |
| Tooling    | Docker / Docker Compose, Oxlint, TypeScript project references |

## Quick Start

There are two ways to run EARAS locally. **Option A** (fully local, no Docker) is the
fastest for day-to-day development and demos. **Option B** uses Docker Compose to run
PostgreSQL and the API in containers, which is closer to a production deployment.

### Option A — Local development (recommended for the FYP demo)

**1. Backend (FastAPI + SQLite, zero-config):**

```bash
cd backend
python -m venv .venv

# Activate the virtual environment
.\.venv\Scripts\Activate.ps1     # Windows PowerShell
# source .venv/bin/activate      # macOS/Linux

pip install -r requirements.txt

copy .env.example .env           # Windows
# cp .env.example .env           # macOS/Linux

uvicorn app.main:app --reload --port 8000
```

The API is now running at `http://localhost:8000` (interactive docs at
`http://localhost:8000/docs`), backed by a local SQLite file (`backend/earas.db`) that is
created automatically, along with the two seed accounts below.

**2. Frontend (React + Vite):**

Open a second terminal at the repo root:

```bash
npm install
npm run dev
```

The app is now running at `http://localhost:5173` and will talk to the backend at
`http://localhost:8000/api` (configured via `VITE_API_BASE_URL` in `.env` — see
`.env.example`).

**3. Log in** with one of the [seed accounts](#seed-accounts) below.

### Option B — Docker Compose (PostgreSQL + API)

Use this when you want to run the backend against PostgreSQL instead of SQLite (e.g. to
demonstrate a production-like deployment during the viva):

```bash
copy .env.example .env           # Windows
# cp .env.example .env           # macOS/Linux

docker compose up --build
```

This starts:

- `db` — PostgreSQL 16 (Alpine), exposed on `localhost:5432`, with a persistent named
  volume.
- `api` — the FastAPI backend, built from `backend/Dockerfile`, exposed on
  `localhost:8000`, connected to `db` via `DATABASE_URL`. The container waits for
  PostgreSQL to become reachable before starting Uvicorn (see `backend/entrypoint.sh`).

Then run the frontend locally as in Option A (`npm install && npm run dev`) — for an FYP
demo, running the frontend outside Docker keeps hot-reload available and avoids an extra
build step. If you do want the frontend containerized too, an optional Nginx-based
`frontend` service is included (commented out) in `docker-compose.yml`, along with
`Dockerfile.frontend` and `nginx.conf`.

To stop and remove the containers:

```bash
docker compose down          # keep the postgres volume (data persists)
docker compose down -v       # also delete the postgres volume
```

## Seed Accounts

On first startup (both local and Docker), the backend automatically creates its database
schema and seeds two accounts:

| Role    | Email                 | Password      |
|---------|-----------------------|---------------|
| Admin   | `admin@earas.edu`     | `Admin1234`   |
| Analyst | `analyst@earas.edu`   | `Analyst1234` |

> ⚠️ These are development/demo credentials only. Change them (or disable seeding) before
> deploying EARAS anywhere beyond local development or an academic demo environment.

## Project Structure

```
earas/
├── docker-compose.yml        # PostgreSQL + API services (see "Quick Start")
├── Dockerfile.frontend       # Optional: containerized frontend (Nginx), commented out by default
├── nginx.conf                # Nginx config for Dockerfile.frontend
├── .env.example              # Root env vars for docker-compose
├── package.json              # Frontend dependencies & scripts (npm run dev/build/lint)
├── src/                      # React + TypeScript frontend
│   ├── pages/
│   │   ├── landing/          # Public landing page
│   │   ├── auth/             # Login / Register / Forgot password
│   │   └── app/              # Authenticated app: Dashboard, Analysis, Reasoning,
│   │                         #   Questions, Batch Eval, Compare, Annotation Lab,
│   │                         #   Reports, Models, Settings
│   ├── components/           # common/ (app widgets) + ui/ (shadcn-style primitives)
│   ├── context/               # Auth & Theme React contexts
│   ├── hooks/                 # useAuth, useTheme, useSidebar, useMediaQuery
│   ├── layouts/                # AuthLayout, SidebarLayout, NavbarLayout, GlobalLayout
│   ├── routes/                 # Route paths, navigation config, guarded router
│   ├── services/                # Typed API client wrappers (auth, questions, analysis, …)
│   └── types/                    # Shared TypeScript types (incl. REXA result types)
├── backend/                    # FastAPI + SQLAlchemy backend (REXA API)
│   ├── app/
│   │   ├── main.py               # App entrypoint, lifespan, routers, error handlers
│   │   ├── config.py              # Settings (pydantic-settings)
│   │   ├── database.py             # SQLAlchemy engine/session
│   │   ├── security.py              # Password hashing + JWT helpers
│   │   ├── deps.py                   # Auth dependencies / role guards
│   │   ├── models/                    # SQLAlchemy ORM models
│   │   ├── schemas/                    # Pydantic request/response schemas
│   │   ├── routers/                     # auth, questions, analysis, batch, reports,
│   │   │                                #   analytics, annotations, models_admin
│   │   └── services/
│   │       ├── rexa_pipeline.py           # Core REXA heuristic pipeline (see below)
│   │       ├── explainability.py           # Human-readable explanation generation
│   │       ├── baselines.py                # Keyword overlap / TF-IDF baselines
│   │       └── reports.py                  # PDF / Markdown report generation
│   ├── Dockerfile
│   ├── entrypoint.sh            # Waits for PostgreSQL before starting Uvicorn
│   └── requirements.txt
├── data/
│   └── annotations/             # Human annotation guidelines & exported ground-truth data
├── ml/
│   └── checkpoints/              # Reserved for future trained-model artifacts (MODEL_MODE=trained)
└── docs/                          # Full FYP documentation (see below)
```

## The REXA Pipeline

`backend/app/services/rexa_pipeline.py` implements REXA as six small, swappable stages:

1. **Sentence splitting** — regex-based splitter, no external NLP downloads required.
2. **Sentence role classification** — keyword + positional heuristics label each sentence
   as `Claim`, `Evidence`, `Explanation`, `Conclusion`, or `Other`.
3. **Concept coverage** — lowercase token overlap against the question's required
   concepts, with a `difflib`-based fuzzy fallback for typos/inflections.
4. **Support & contradiction analysis** — consecutive sentence pairs are classified as
   `Supports` / `Neutral` / `Contradicts` using cue-word heuristics (e.g. "therefore",
   "however", "but").
5. **Reasoning depth scoring** — a 0–1 score from the presence of a Claim → Evidence →
   Explanation chain, the support ratio, and answer length.
6. **Weighted star prediction** — combines concept coverage (40%), reasoning depth (25%),
   sentence-role diversity (15%), support ratio (15%), and a contradiction penalty (5%)
   into a 1–5 star rating.

The orchestrating `RexaPipeline` class also produces `dimension_scores`, natural-language
`explanations`, and per-sentence `highlights` (with character spans) for UI rendering.
Every stage sits behind a narrow `Protocol` interface, so `MODEL_MODE=trained` can later
swap in a trained classifier for any stage without touching routers, schemas, or the
frontend. See **[docs/architecture.md](docs/architecture.md)** for a full walkthrough and
**[docs/evaluation_report.md](docs/evaluation_report.md)** for how REXA compares against
the Keyword Overlap and TF-IDF baselines.

## DistilBERT (optional, Google Colab)

For a stronger transformer-based star scorer on the ASAP corpora, see
[docs/colab_distilbert.md](docs/colab_distilbert.md) and the notebook
`ml/notebooks/04_distilbert_colab.ipynb`.

## Documentation

Full FYP documentation lives in [`docs/`](docs/):

| Document | Description |
|----------|-------------|
| [`docs/SRS.md`](docs/SRS.md) | Software Requirements Specification — functional & non-functional requirements, actors, use cases |
| [`docs/architecture.md`](docs/architecture.md) | System architecture, sequence diagrams, data model (ER diagram) |
| [`docs/user_manual.md`](docs/user_manual.md) | Page-by-page user manual for the frontend |
| [`docs/annotation_protocol.md`](docs/annotation_protocol.md) | Protocol for labeling sentence roles, concepts, support, depth, and stars |
| [`docs/demo_script.md`](docs/demo_script.md) | 10-minute viva demo walkthrough |
| [`docs/viva_slides_outline.md`](docs/viva_slides_outline.md) | Slide-by-slide outline for the defense presentation |
| [`docs/evaluation_report.md`](docs/evaluation_report.md) | Experimental setup and REXA vs. baseline results |
| [`docs/api.md`](docs/api.md) | API endpoint reference summary |

Backend-specific implementation notes (pipeline internals, endpoint list, Docker
instructions) are in [`backend/README.md`](backend/README.md).

## License

This project is released under the **MIT License** for code, and is submitted as an
**academic Final Year Project**. See [`LICENSE`](LICENSE) for the full text. You are free
to use, study, and build upon this work for academic and educational purposes; please
cite/credit the original authors and supervising institution if you reuse substantial
portions of it.
