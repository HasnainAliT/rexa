# Annotation Protocol

**Project:** RExA — Explainable Reasoning Analysis of Descriptive Answers
**Purpose:** Define a consistent, reproducible protocol for human annotators labeling
student answers in the **Annotation Lab** (`/app/annotation`, backed by
`POST /api/annotations`), so that (a) multiple annotators produce comparable labels, and
(b) REXA's automatic output can be meaningfully evaluated against human judgement (see
[`docs/evaluation_report.md`](evaluation_report.md)).

> A condensed, printable cheat-sheet version of this protocol — intended to be kept open
> while annotating — lives at
> [`data/annotations/annotation_guidelines.md`](../data/annotations/annotation_guidelines.md).

---

## 1. What Gets Annotated

For a given **submission** (one student's answer to one question), an annotation records
five things, matching the `Annotation` model (`backend/app/models/__init__.py`) and the
`AnnotationCreate` schema:

| Field | Type | Description |
|-------|------|--------------|
| `sentence_roles` | list of `{ index, role }` | Ground-truth role for every sentence in the answer |
| `concepts_present` | list of strings | Which of the question's required concepts a human judges to be genuinely present |
| `support_pairs` | list of `{ source_index, target_index, relation }` | Ground-truth support/contradiction relation for consecutive (or otherwise related) sentence pairs |
| `depth_score` | float, 0.0–1.0 | Overall reasoning-depth judgement |
| `star_label` | integer, 1–5 | Overall holistic quality rating |
| `notes` | free text | Anything ambiguous, edge-case, or noteworthy about the answer |

Annotators should read the **entire student answer** and the **question + reference
answer + concept list** before labeling anything — role labels in particular often depend
on context from neighboring sentences.

## 2. Sentence Role Labels

Assign **exactly one** role to every sentence (no sentence is left unlabeled). The roles
available in the Annotation Lab UI are a superset of REXA's own four core roles, to let
human annotators capture more nuance than the heuristic pipeline currently does:

| Role | Definition | Example |
|------|------------|---------|
| **Claim** | A statement of the main point/thesis being argued, without yet justifying it. | "Mitosis is the process by which a cell divides into two identical daughter cells." |
| **Evidence** | A fact, example, data point, or citation offered in support of a claim. | "For example, skin cells constantly divide via mitosis to replace dead cells." |
| **Reasoning** | A logical step connecting evidence back to the claim — REXA calls this "Explanation". Use cue words like "because", "since", "this shows that" as a strong signal. | "This happens because the cell must duplicate its DNA before dividing to ensure both daughter cells are genetically identical." |
| **Elaboration** | Additional detail, definition, or context that supports understanding but doesn't directly argue for the claim (neither pure evidence nor pure reasoning). | "This process occurs in four main phases: prophase, metaphase, anaphase, and telophase." |
| **Counterargument** | A sentence that raises an opposing point, limitation, or exception. | "However, this differs from meiosis, which produces genetically distinct cells." |
| **Conclusion** | A closing statement that summarizes or restates the overall point. | "In summary, mitosis ensures genetic continuity during normal cell growth and repair." |
| **Irrelevant** | Off-topic, filler, or restates the question without adding content. | "This is a good question that many students find difficult." |

**Guidelines:**

- If a sentence could plausibly be two roles, prefer the role that best matches its
  *primary function in context*, not just its wording. A sentence containing "because" that
  merely restates the claim without adding a mechanism is still **Reasoning** only if it
  actually explains *why*; otherwise, label it **Elaboration**.
- The first sentence of a well-structured answer is usually a **Claim**; the last is often
  a **Conclusion** — but do not apply this as a blind rule; judge each sentence on content.
- Very short "answers" that are a single fragment should still be labeled with the single
  best-fitting role (usually **Claim** or **Irrelevant**).
- REXA's heuristic pipeline only distinguishes Claim / Evidence / Explanation / Conclusion
  / Other — when comparing REXA's output to annotations for agreement metrics, map
  **Reasoning → Explanation**, and **Elaboration / Counterargument / Irrelevant → Other**
  (see `docs/evaluation_report.md` §3 for the exact mapping used).

## 3. Concept Coverage

For each concept in the question's required concept list, mark it **present** only if the
student's answer demonstrates understanding of that concept — not merely if a matching
keyword appears out of context.

- **Present:** the concept's *meaning* is conveyed, even with different wording or a minor
  typo (e.g. "the cell copies its DNA" counts for the concept "DNA replication").
- **Not present:** the keyword appears but is used incorrectly, or the sentence is
  clearly about something else (e.g. "mitosis" appearing only inside "Mitosis was
  discovered in the 19th century" does not demonstrate coverage of a concept like "purpose
  of mitosis").
- When in doubt, err toward **not present** — over-crediting shallow keyword matches
  defeats the purpose of comparing against REXA's own (also keyword/fuzzy-based) coverage
  computation.

## 4. Support / Contradiction Pairs

For each pair of sentences that have a clear logical relationship (typically consecutive
sentences, but not exclusively), assign one relation:

| Relation | Meaning | Cue examples |
|----------|---------|---------------|
| **Supports** | The second sentence reinforces, justifies, or provides evidence for the first. | "therefore", "because", "this shows", "as a result" |
| **Contradicts** | The second sentence opposes, limits, or partially negates the first. | "however", "but", "although", "in contrast" |
| **Neutral** | The second sentence is topically related but neither supports nor contradicts (e.g. adds unrelated detail, moves to a new sub-point). | (no strong cue either way) |

Only annotate pairs where a relationship is reasonably clear; it is acceptable to leave
weakly-related consecutive sentences unpaired rather than forcing a label.

## 5. Reasoning Depth (0.0–1.0)

Assign a holistic depth score reflecting how *complete* the reasoning chain is:

| Range | Description |
|-------|-------------|
| **0.0–0.2** | No discernible reasoning; answer is a bare claim or list of keywords with no justification. |
| **0.2–0.4** | A claim with at most weak, unconnected evidence; no explanation of *why*. |
| **0.4–0.6** | Claim + evidence present, but the logical connection between them is implicit or partially stated. |
| **0.6–0.8** | A clear Claim → Evidence → Reasoning chain is present, possibly missing a conclusion. |
| **0.8–1.0** | A complete, well-connected Claim → Evidence → Reasoning → Conclusion chain with no gaps. |

Use increments of 0.1 for consistency across annotators (e.g. 0.3, 0.5, 0.7), unless a
value clearly falls at a boundary.

## 6. Overall Star Rating (1–5)

The star rating is a **holistic** judgement, not a mechanical average of the other fields
— annotators should read the whole answer and assign the rating a course instructor would
realistically give, using this rubric:

| Stars | Meaning |
|-------|---------|
| **1** | Largely incorrect, off-topic, or contains almost no required concepts. |
| **2** | Attempts the question but covers few concepts and/or shows minimal reasoning. |
| **3** | Covers roughly half the required concepts with some reasoning, but has gaps or minor inaccuracies. |
| **4** | Covers most required concepts with a mostly complete reasoning chain; minor omissions only. |
| **5** | Fully covers required concepts with a complete, well-explained reasoning chain and a clear conclusion. |

Annotators should assign stars **independently** of REXA's own rating (do not look at the
REXA result before annotating) to keep the ground truth unbiased for evaluation purposes.

## 7. Inter-Annotator Agreement

For quality control, a subset of submissions (recommended: at least 20, or 20% of the
annotated set, whichever is larger) should be labeled by **two independent annotators**.
Agreement should be computed as:

- **Sentence roles:** Cohen's Kappa over the per-sentence role labels (mapped to REXA's
  4-role scheme, see §2).
- **Concept coverage:** Percent agreement / Cohen's Kappa over the present/absent binary
  decision, per concept.
- **Star rating:** Quadratic-weighted Kappa (since stars are ordinal), or Pearson/Spearman
  correlation as a secondary metric.

Report these figures in `docs/evaluation_report.md` alongside REXA-vs-human agreement, so
the reader can judge whether disagreements are due to genuine ambiguity in the task (low
inter-annotator agreement) or to weaknesses specifically in REXA's heuristics (REXA
disagrees with humans more than humans disagree with each other).

## 8. Practical Workflow

1. Run the answer through **Analysis** first (or use an existing analyzed submission) so
   it is available in the Annotation Lab's submission dropdown — annotation always happens
   against an already-analyzed submission.
2. Open **Annotation Lab**, select the submission.
3. Label every sentence's role.
4. Mark concept coverage.
5. Mark support/contradiction pairs.
6. Set depth score and star rating.
7. Add notes for anything ambiguous (this is valuable qualitative data for the evaluation
   report's error analysis).
8. Save. The annotation is stored independently in the `annotations` table and can be
   retrieved via `GET /api/annotations?submission_id=...`.

## 9. Exporting for Analysis

For offline analysis (agreement statistics, REXA-vs-human comparison tables), export
annotations via `GET /api/annotations` and store the resulting JSON/CSV under
`data/annotations/` (e.g. `data/annotations/export_YYYY-MM-DD.json`) — this directory is
the canonical location for annotation datasets used to produce
`docs/evaluation_report.md`.
