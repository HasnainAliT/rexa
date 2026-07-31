# User Manual

**Project:** RExA — Explainable Reasoning Analysis of Descriptive Answers

This manual walks through every page of the EARAS frontend, in the order a new user would
typically encounter them. It assumes the application is running locally (see the root
[`README.md`](../README.md) Quick Start) and that you are logged in with one of the
[seed accounts](../README.md#seed-accounts).

---

## 1. Landing Page (`/`)

The public marketing page, shown to unauthenticated visitors. It introduces EARAS/REXA,
summarizes the platform's pillars (reasoning-aware scoring, explainability, concept
coverage, etc.), and links to **Sign In** / **Get Started**. No authentication is required
to view this page.

## 2. Authentication

### 2.1 Login (`/auth/login`)

Enter your email and password and click **Sign In**. On success you are redirected to the
page you originally tried to visit, or to the **Dashboard** by default. Invalid
credentials show an inline error alert without revealing whether the email or password was
the incorrect field (for security).

**Demo credentials:**

| Role    | Email                 | Password      |
|---------|-----------------------|---------------|
| Admin   | `admin@earas.edu`     | `Admin1234`   |
| Analyst | `analyst@earas.edu`   | `Analyst1234` |

### 2.2 Register (`/auth/register`)

New users can self-register with a name, email, password, and password confirmation.
Passwords must match; the backend returns a validation error otherwise. New accounts
default to the `viewer` role unless changed by an admin.

### 2.3 Forgot Password (`/auth/forgot-password`)

A placeholder recovery flow for the FYP scope; in a production deployment this would be
wired to an email-based reset token flow.

Once authenticated, the app switches into the **sidebar layout** described below, and your
session (JWT) is stored in the browser and attached automatically to every API request
until it expires or you log out (via the user menu in the top-right).

---

## 3. Dashboard (`/app/dashboard`)

The landing page after login. Shows at a glance:

- **Summary cards** — total analyses run, average star rating, total questions, total
  submissions.
- **Coverage trend chart** — an area chart of average concept coverage / average stars
  over time, so an instructor can see whether a cohort's answers are improving across
  attempts or assignments.
- **Sentence-role distribution** — a pie chart showing the proportion of sentences
  classified as Claim / Evidence / Explanation / Conclusion / Other across all analyzed
  answers, useful for spotting whether students are, e.g., stating claims without
  evidence.
- **Recent analyses table** — the most recent analysis runs with their star rating and
  timestamp, each linking through to the **Reasoning** page for full detail.

Use this page to get a quick pulse on overall class performance before drilling into
individual answers.

## 4. Analysis (`/app/analysis`)

The primary workflow: run REXA on a single student answer.

1. Choose a **mode**:
   - **From question bank** — select an existing question (with its reference answer and
     concepts already defined).
   - **Custom / ad-hoc** — type a question prompt and reference answer directly, and
     optionally a comma-separated concept list, without first saving it to the bank.
2. Optionally enter the **student's name** (for record-keeping).
3. Paste or type the **student's answer** into the text area.
4. Click **Analyze**. While the request is in flight, a loading indicator is shown.
5. The result panel displays:
   - The overall **star rating** (1–5, rendered as a star widget).
   - **Dimension bars** — concept coverage, reasoning depth, role structure, and support
     quality, each as a 0–100% bar.
   - **Sentence highlights** — each sentence of the student's answer, tagged with a
     colored role badge (Claim/Evidence/Explanation/Conclusion/Other).
   - **Explanations** — a list of plain-English reasons behind the score (e.g. "Missing
     concepts: mitosis, cytokinesis" or "Strong reasoning chain: claim, evidence, and
     explanation are all present").
6. A link to view the same result in the more detailed **Reasoning Engine** page is
   provided.

By default the analysis is saved to the database (visible later in Reports/Dashboard); use
this page whenever you want to grade or spot-check a single answer.

## 5. Reasoning Engine (`/app/reasoning?id=<analysisId>`)

A deep-dive view of a single analysis run, reached from the Dashboard, Reports, or
Analysis page. It presents the same result as the Analysis page but with additional
detail oriented toward *understanding the reasoning*, rather than just the score:

- Full sentence-by-sentence breakdown with role badges.
- The **support/contradiction graph**: each consecutive sentence pair is shown with an
  icon (✅ Supports, ➖ Neutral, ❌ Contradicts) and, where applicable, the cue word that
  triggered the classification (e.g. "however", "therefore").
- Dimension bars and the full explanation list, identical in meaning to the Analysis page.

This page is the best one to project during a viva/demo when explaining *how* REXA arrived
at a particular rating, since it exposes the intermediate reasoning artifacts rather than
just the final number.

## 6. Questions (`/app/questions`)

The question bank management page (Admin/Analyst only for write actions).

- **Table view** of all questions: title/prompt, course/subject, difficulty, and required
  concept count.
- **Add Question** — opens a dialog to enter the question prompt, reference answer,
  concepts (comma-separated), optional subject/course, and difficulty (easy/medium/hard).
- **Edit** (pencil icon) — opens the same dialog pre-filled for editing.
- **Delete** (trash icon) — asks for confirmation, then removes the question and cascades
  to delete its submissions and analysis runs.

Populate this page first (or use the ad-hoc mode on the Analysis page) before running
batch evaluations, since Batch Eval and Compare both select from this bank.

## 7. Batch Eval (`/app/batch`)

Analyze many student answers against a single question in one submission:

1. Select a question from the bank.
2. Paste multiple student answers into the textarea, one per line (or per paragraph,
   depending on the delimiter configured in the form).
3. Click **Run Batch Analysis**.
4. A results table lists each answer's index, a preview of the text, its star rating, and
   a link to open the full analysis in the Reasoning Engine.

This page is useful for grading an entire class's submissions to one question at once,
and for quickly scanning for outliers (very low or very high star ratings).

## 8. Compare (`/app/compare`)

Run REXA on two answers to the same question side by side:

1. Select a question from the bank.
2. Paste **Answer A** and **Answer B**.
3. Click **Compare**.
4. The page shows both results' star ratings and dimension bars next to each other, which
   is useful for illustrating to students *why* one answer scored higher than another
   (e.g. "Answer B covers the same concepts but lacks an explanation sentence, so its
   reasoning-depth score is lower").

## 9. Annotation Lab (`/app/annotation`)

Where human annotators create ground-truth labels for previously analyzed submissions,
following [`docs/annotation_protocol.md`](annotation_protocol.md):

1. Select a submission from the dropdown (populated from past analyses).
2. For each sentence in the answer, assign a ground-truth role (Claim / Evidence /
   Reasoning / Elaboration / Counterargument / Conclusion / Irrelevant).
3. Check off which required concepts are genuinely present in the answer (as judged by a
   human, independent of REXA's own coverage computation).
4. Record support/contradiction relationships between sentence pairs.
5. Set a ground-truth **reasoning depth** value and an overall **star rating** using the
   interactive star widget.
6. Add optional free-text notes (e.g. edge cases, ambiguous wording).
7. Click **Save Annotation**.

Annotations are stored independently of REXA's automatic results, so they can later be
used to measure REXA's agreement with human graders (see
[`docs/evaluation_report.md`](evaluation_report.md)).

## 10. Reports (`/app/reports`)

A paginated table of all past analysis runs (across all questions/students):

- Columns: question, student, stars, date.
- **Download PDF** — generates and downloads a PDF report for that analysis run
  (via `POST /api/reports/{id}/pdf`).
- Pagination controls (previous/next) at the bottom for navigating large histories.

Use this page as the system of record for grading history and for producing printable
per-student reports.

## 11. Models (`/app/models`)

Admin-focused page for managing REXA **model versions**:

- Lists all registered model versions with their name, version string, description, active
  status, and stored metrics (e.g. accuracy against annotated ground truth).
- **Activate** button (admin only) marks a model version as the currently active one.
- This page is primarily forward-looking: today, the system always scores with the
  `heuristic-v1` pipeline, but the registry exists so that as trained models are evaluated
  (see `docs/evaluation_report.md`), their metadata and metrics can be tracked and
  compared before deciding to activate one.

## 12. Settings (`/app/settings`)

Account-level preferences: theme (light/dark, via the `ThemeProvider`/`ThemeToggle`),
profile details, and any other user-specific configuration. Theme selection is persisted
across sessions.

---

## Navigation Reference

The sidebar groups pages as follows:

| Group | Pages |
|-------|-------|
| Overview | Dashboard, Analysis |
| Workspace | Questions, Batch Eval, Compare |
| Reasoning | Reasoning Engine, Annotation Lab, Reports |
| System | Models, Settings |

The top navbar shows the current user's avatar/name (via `UserMenu`) with a logout option,
and a light/dark theme toggle.

## Tips for a Smooth Demo

- Seed a handful of questions in **Questions** first, with a short (3–6 concept) list so
  coverage differences are easy to see.
- Prepare 2–3 sample student answers of varying quality in advance (see
  `docs/demo_script.md` for ready-to-paste examples) rather than typing them live.
- Use **Compare** to visually contrast a strong vs. weak answer — it is the fastest way to
  demonstrate REXA's explainability to a non-technical audience.
