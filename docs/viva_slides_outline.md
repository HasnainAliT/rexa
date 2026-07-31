# Viva / Defense Slide Deck Outline

**Project:** RExA — Explainable Reasoning Analysis of Descriptive Answers

This outline is structured for roughly **15–20 slides / 15–20 minutes** of presentation
time, followed by the 10-minute live demo (`docs/demo_script.md`) and Q&A. Adjust slide
count to your allotted time slot; suggested cuts are marked *(optional)*.

---

### Slide 1 — Title

- Project title: **RExA: Explainable Reasoning Analysis of Descriptive Answers**
- Short name: **RExA**
- Your name, registration number, supervisor's name, institution, date.

### Slide 2 — Agenda

- Problem & Motivation
- Related Work / Existing Approaches
- Proposed Solution (EARAS/REXA)
- System Architecture
- The REXA Pipeline (core contribution)
- Implementation & Tech Stack
- Live Demo
- Evaluation Results
- Limitations & Future Work
- Conclusion

### Slide 3 — Problem Statement

- Manual grading of descriptive/short answers is slow, subjective, and doesn't scale.
- Existing automated tools (keyword match, TF-IDF, embedding similarity) only measure
  *surface similarity*, not *reasoning quality*.
- No explanation is given for why an answer received a particular score.
- **Research question:** Can we automatically assess the *reasoning structure* of a
  student's answer — and explain the resulting score — without expensive/opaque
  black-box models?

### Slide 4 — Related Work *(optional, expand if your program emphasizes literature review)*

- Automated Short Answer Grading (ASAG) surveys: similarity-based, feature-based, and
  neural approaches.
- Argument mining literature: claim/evidence/premise-conclusion structure detection.
- Explainable AI (XAI) motivations for education technology specifically.
- Gap identified: most ASAG systems optimize for correlation with a human score, but
  provide no interpretable rationale a student or instructor can act on.

### Slide 5 — Proposed Solution: RExA

- A full-stack web platform (React + FastAPI) built around **REXA**, a multi-stage
  reasoning-analysis pipeline.
- Scores answers along four **interpretable dimensions**: concept coverage, reasoning
  depth, sentence-role structure, support quality.
- Every score is paired with **plain-English explanations**.
- Deliberately lightweight: runs on CPU, no GPU, no paid API — reproducible by anyone
  with Python and Node installed.

### Slide 6 — Key Features

- Reasoning-aware sentence-role classification (Claim/Evidence/Explanation/Conclusion).
- Concept coverage with typo-tolerant fuzzy matching.
- Support/contradiction detection between sentences.
- Explainable 1–5 star rating.
- Single, batch, and A/B-compare analysis modes.
- Human annotation lab for ground-truth labeling and evaluation.
- Classical baseline comparison built in (Keyword Overlap, TF-IDF).
- Analytics dashboard + PDF/Markdown report export.

### Slide 7 — System Architecture (diagram)

- Show the three-tier diagram from `docs/architecture.md` §2 (Frontend SPA → FastAPI →
  PostgreSQL/SQLite).
- Emphasize the consistent `{ data, message, success }` API envelope and JWT auth.

### Slide 8 — Data Model (ER diagram)

- Show the ER diagram from `docs/architecture.md` §4: `User`, `Question`, `Submission`,
  `AnalysisRun`, `Annotation`, `ModelVersion`.
- Briefly explain why `AnalysisRun.result_json` stores the full REXA output as JSON
  (auditability/history even as scoring logic evolves).

### Slide 9 — The REXA Pipeline (core technical contribution)

- Walk through the six stages as a pipeline diagram:
  1. Sentence Splitting
  2. Sentence Role Classification
  3. Concept Coverage Matching
  4. Support / Contradiction Analysis
  5. Reasoning Depth Scoring
  6. Weighted Star Prediction
- Emphasize the **Protocol-based, swappable-stage design** — this is the architectural
  contribution that lets the system evolve from heuristic to trained models later without
  a rewrite.

### Slide 10 — Star Prediction Formula

- Show the weighted formula:
  `stars = 1 + 4 × (0.40·coverage + 0.25·depth + 0.15·role_diversity + 0.15·support_ratio − 0.05·contradiction_ratio)`
- Explain the rationale for each weight (coverage matters most since missing required
  content is the most objective/defensible signal; contradiction is a small penalty since
  it's a secondary quality signal).

### Slide 11 — Explainability in Practice (example)

- Show one real example: a student answer, its sentence-role highlights, and 2–3 of the
  generated explanation strings side by side.
- This is the single most convincing slide for demonstrating the "explainable" half of the
  project's name — spend real time on it.

### Slide 12 — Sequence Diagram: Analyze Flow

- Show the Mermaid sequence diagram from `docs/architecture.md` §3 (Analyst → Frontend →
  API → Pipeline → Explainability → Database → back to Frontend).

### Slide 13 — Implementation & Tech Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS, Radix UI, React Hook Form + Zod,
  Recharts.
- Backend: FastAPI, SQLAlchemy 2, Pydantic v2, JWT auth (python-jose), bcrypt.
- ML/NLP: scikit-learn (TF-IDF baseline), difflib (fuzzy matching), regex heuristics — no
  heavy ML dependency required by default.
- Deployment: Docker Compose (PostgreSQL + FastAPI), with the frontend run locally or via
  an optional Nginx container.

### Slide 14 — Live Demo

- Transition slide: "Let's see it in action." (Switch to the live application — follow
  `docs/demo_script.md`.)

### Slide 15 — Evaluation Methodology

- Dataset: N annotated submissions (see `docs/evaluation_report.md` §1 for the exact
  sample size used), labeled per `docs/annotation_protocol.md`.
- Metrics: star-rating correlation/agreement with human annotators, sentence-role
  classification accuracy vs. ground truth, concept-coverage precision/recall.
- Baselines compared: Keyword Overlap, TF-IDF Cosine Similarity.

### Slide 16 — Results (table + chart)

- Reproduce the main results table from `docs/evaluation_report.md` (REXA vs. baselines
  vs. human agreement).
- Call out where REXA outperforms baselines and be candid about where the sample size
  limits statistical strength (this shows academic maturity to the committee).

### Slide 17 — Limitations

- Small annotated sample size (state the exact N from the evaluation report) — results are
  indicative, not a large-scale validation.
- Heuristic pipeline relies on keyword/cue-word banks — can miss paraphrased reasoning
  that doesn't use expected cue words.
- English-only; no support for non-text input (diagrams, equations, handwriting).
- Frontend/backend response-shape alignment is an identified integration item (see
  `docs/architecture.md` §7) rather than a hidden bug — worth stating proactively.

### Slide 18 — Future Work

- Swap in a trained sentence classifier (e.g. fine-tuned transformer) behind the existing
  `Protocol` interfaces for `MODEL_MODE=trained`, using the annotation-lab dataset as
  training data.
- Expand the annotated dataset size for more statistically robust evaluation.
- Multi-language support.
- LMS integration (import questions/submissions via API/CSV).

### Slide 19 — Conclusion

- Restate the core contribution: an explainable, reasoning-aware, dependency-light
  automated answer assessment system with a full-stack implementation and a documented
  evaluation methodology.
- Thank the supervisor/committee; invite questions.

### Slide 20 — Q&A

- "Questions?" — keep `docs/architecture.md`, `docs/evaluation_report.md`, and the running
  application open in the background in case you need to answer a question by showing
  code, a diagram, or a live example.

---

## Presentation Tips

- Rehearse the timing — aim for ~45–60 seconds per slide on average for a 15–20 minute
  slot, leaving Slides 1–2 and 19–20 shorter.
- Slide 11 (Explainability in Practice) and the live demo are the two moments most likely
  to leave a strong impression — do not rush them.
- Anticipate the two questions a committee is almost guaranteed to ask: *"Why not use an
  LLM?"* and *"How do you know your scores are actually correct?"* — Slides 5, 17, and 18
  directly answer both; know them well enough to answer without looking at the slide.
