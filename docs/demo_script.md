# 10-Minute Viva Demo Script

**Project:** RExA — Explainable Reasoning Analysis of Descriptive Answers

This script is a minute-by-minute walkthrough for demonstrating EARAS live during the
viva/defense. It is designed to fit in **10 minutes**, leaving time for questions.
Rehearse it end-to-end at least once before the real defense.

## Pre-Demo Checklist (do this the night before, not five minutes before)

- [ ] Backend running: `cd backend; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --port 8000` (or `docker compose up --build` if demonstrating the containerized setup).
- [ ] Frontend running: `npm run dev`, confirm `http://localhost:5173` loads.
- [ ] Confirm `http://localhost:8000/docs` loads (fallback if the UI has an issue — you
      can show the API directly).
- [ ] Log out any existing session so you start from a clean login screen.
- [ ] Pre-create at least one question in **Questions** (see sample below) so you are not
      typing it live.
- [ ] Have the three sample answers below ready in a text file to copy-paste (do not type
      them live — it wastes time and risks typos).
- [ ] Close unrelated browser tabs/notifications; set zoom level so text is readable on
      the projector.
- [ ] Have `docs/architecture.md`'s diagrams open in a second window/tab in case a
      committee member asks "how does the pipeline actually work internally?".

## Sample Question (create this in Questions beforehand)

- **Title:** Explain the process of mitosis
- **Prompt:** "Explain the process of mitosis and why it is important for living
  organisms."
- **Reference answer:** "Mitosis is the process by which a single cell divides into two
  genetically identical daughter cells. It occurs in several phases: prophase, metaphase,
  anaphase, and telophase. Before division, the cell replicates its DNA so that each
  daughter cell receives a complete set of chromosomes. This process is important because
  it allows organisms to grow, replace damaged or dead cells, and maintain genetic
  consistency across cell generations."
- **Concepts:** `daughter cells, DNA replication, chromosomes, growth, cell repair`

## Sample Student Answers (copy-paste these live)

**Answer A — strong (should score ~4–5 stars):**

> Mitosis is when a cell divides into two identical daughter cells. Before this happens,
> the cell copies its DNA so both new cells get the same chromosomes. This is important
> because it lets the body grow and repair damaged tissue by replacing dead cells. In
> summary, mitosis keeps genetic information consistent while allowing organisms to grow
> and heal.

**Answer B — weak (should score ~1–2 stars):**

> Mitosis is a type of cell division. It happens in the body.

**Answer C — partial, with a contradiction cue (good for showing support/contradiction
detection, should score ~2–3 stars):**

> Mitosis produces two daughter cells with the same DNA. However, it does not involve
> chromosomes at all. The process helps with growth.

---

## Minute-by-Minute Script

### 0:00 – 0:45 — Problem Statement (spoken, no screen needed yet)

> "Manual grading of descriptive answers is slow and inconsistent, and most automated
> tools only measure keyword or embedding similarity — they can't tell you *why* an
> answer is good or bad, and they can't catch a student who lists the right words but
> never actually reasons through them. EARAS's REXA engine solves this by analyzing the
> *reasoning structure* of an answer — its claims, evidence, explanations, and
> conclusions — and always shows its work."

### 0:45 – 1:30 — Login & Landing (screen: browser)

- Show the landing page briefly (`/`) — mention the pillars.
- Log in as `analyst@earas.edu` / `Analyst1234`.
- Land on the **Dashboard** — point out the summary cards and charts (they'll be sparse
  initially; that's fine, they'll fill in during the demo).

### 1:30 – 2:15 — Question Bank (screen: Questions page)

- Show the pre-created "Explain the process of mitosis" question.
- Briefly explain: reference answer + concept list is what REXA measures coverage
  against — **not** a rigid string match, but token/fuzzy matching.

### 2:15 – 5:00 — Core Analysis Flow (screen: Analysis page) — the heart of the demo

1. Select the mitosis question from the bank.
2. Paste **Answer A** (strong). Click **Analyze**.
3. Talk through the result as it renders:
   - "Notice the star rating — 4 to 5 stars — and it's broken into four dimensions:
     concept coverage, reasoning depth, role structure, and support quality."
   - Point at the **sentence highlights**: "See how each sentence is tagged — this first
     sentence is a Claim, this one is Evidence, and the last is a Conclusion."
   - Read one **explanation** aloud, e.g. "Strong reasoning chain: claim, evidence, and
     explanation are all present." — "This is what makes REXA explainable: every score
     comes with a plain-English reason, not just a number."
4. Go back, paste **Answer B** (weak), analyze again.
   - Contrast: "Notice the star rating drops sharply, coverage is low, and the
     explanations now say which concepts are missing."
5. Go back, paste **Answer C** (contradiction example), analyze again.
   - Open the **Reasoning Engine** page (click through from the result) and point out the
     support/contradiction indicator on the "However, it does not involve chromosomes at
     all" sentence — "REXA caught an internal contradiction using cue-word analysis."

### 5:00 – 6:00 — Compare (screen: Compare page)

- Select the same question, paste Answer A into slot A and Answer B into slot B.
- Click **Compare** — show the side-by-side star ratings and dimension bars.
- "This view is what makes it easy for an instructor to explain to a student exactly why
  their answer scored lower than a classmate's, dimension by dimension."

### 6:00 – 6:45 — Batch Eval (screen: Batch Eval page)

- Select the question, paste all three sample answers (one per line).
- Run batch analysis — show the results table with all three star ratings computed in one
  pass. "This is how an instructor would grade an entire class's submissions to one
  question at once."

### 6:45 – 7:30 — Baselines / Evaluation (screen: `/docs` Swagger UI or a prepared
table from `docs/evaluation_report.md`)

- Open `GET /api/baselines/evaluate` in Swagger, or show the pre-computed comparison table
  in `docs/evaluation_report.md`.
- "We don't just claim REXA is better — we benchmark it against classical baselines:
  keyword overlap and TF-IDF cosine similarity. REXA's structured scoring captures
  reasoning quality that pure similarity metrics miss, as detailed in our evaluation
  report."

### 7:30 – 8:15 — Annotation Lab (screen: Annotation Lab page)

- Open a previously-analyzed submission.
- Show the sentence role labels, concept checkboxes, and star widget.
- "This is how we built ground-truth data to evaluate REXA's agreement with human judges,
  following a documented annotation protocol — this is what makes our evaluation
  methodologically sound rather than anecdotal."

### 8:15 – 9:00 — Dashboard Revisited & Reports (screen: Dashboard, then Reports)

- Return to the Dashboard — now populated with the analyses just run; point out the
  updated charts.
- Open **Reports**, download a PDF report for one analysis — open it to show the
  formatted output.

### 9:00 – 9:45 — Architecture Recap (screen: `docs/architecture.md` or spoken)

- "Under the hood, REXA is six small, independent stages — sentence splitting, role
  classification, concept matching, support analysis, depth scoring, and star prediction —
  each behind a narrow interface. This means we can later swap in a trained model for any
  single stage without touching the API or the frontend at all."
- Mention the tech stack briefly: FastAPI + SQLAlchemy backend, React + TypeScript
  frontend, PostgreSQL via Docker Compose for production-like deployment.

### 9:45 – 10:00 — Wrap-up / Transition to Q&A

> "To summarize: EARAS/REXA moves automated answer assessment beyond similarity scoring,
> toward genuinely explainable, reasoning-aware evaluation — while staying lightweight
> enough to run on a laptop with no GPU or paid API. Happy to answer any questions, or dive
> deeper into any part of the pipeline, the data model, or the evaluation methodology."

---

## Contingency Plans

- **If the frontend crashes or looks broken:** fall back to `http://localhost:8000/docs`
  and run `POST /api/analyze` directly with the "Try it out" button using the sample
  answers above — the core scoring logic and explanations are still fully visible.
- **If Docker/PostgreSQL isn't cooperating:** the SQLite-backed local dev setup (Option A
  in the README) is the safer default for a live demo; reserve Docker Compose for a
  screenshot/recording shown separately if asked "how would this deploy to production?"
- **If asked "why isn't this using a large language model?":** explain the deliberate
  design constraint — a dependency-light, explainable, reproducible pipeline that runs
  offline and deterministically was prioritized for this FYP, with the `Protocol`-based
  architecture explicitly designed to allow a trained/LLM-backed stage to be added later
  (see `docs/architecture.md` §5 and `docs/evaluation_report.md` §6 "Future Work").
