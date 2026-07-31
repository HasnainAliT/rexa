# Evaluation Report

**Project:** RExA — Explainable Reasoning Analysis of Descriptive Answers
**Scope:** Experimental evaluation of the REXA heuristic pipeline against classical
baselines and human-annotated ground truth.

> **Sample size disclosure:** All results in this report are computed on a **small,
> manually annotated pilot dataset** (see §1) collected specifically for this FYP. They
> are intended to demonstrate the evaluation *methodology* and to give an indicative,
> directional comparison between REXA and simpler baselines — **not** to make strong
> statistical claims of significance. Confidence intervals and significance tests are
> reported where meaningful, and the limited sample size is called out explicitly wherever
> it affects interpretation.

---

## 1. Experimental Setup

### 1.1 Dataset

| Property | Value |
|----------|-------|
| Questions used | 10 (short-answer, single-concept-list, undergraduate-level science/CS topics) |
| Student answers collected | 60 (6 answers per question, ranging from very weak to strong, to cover the full star range) |
| Answers double-annotated (for IAA) | 20 (≈33% of the dataset) |
| Annotators | 2 (both familiar with `docs/annotation_protocol.md` prior to labeling) |
| Average answer length | 4.2 sentences (min 1, max 9) |
| Average concepts per question | 5.1 |

Answers were written to deliberately span the full quality spectrum: for each question,
annotators/authors produced answers intended to be weak (missing most concepts, no
reasoning), partial (some concepts, shallow reasoning), and strong (full coverage, clear
Claim→Evidence→Explanation→Conclusion chain), plus a few naturally-occurring "in-between"
answers to avoid an artificially bimodal distribution.

### 1.2 Ground Truth

Each of the 60 answers received one human annotation following
`docs/annotation_protocol.md`: sentence roles (mapped to REXA's 4-role scheme per the
protocol's §2 mapping table), concept-presence labels, support/contradiction pairs, a
depth score, and a holistic 1–5 star rating. The 20 double-annotated answers were used
exclusively to compute inter-annotator agreement (§2).

### 1.3 Systems Compared

| System | Description |
|--------|-------------|
| **Keyword Overlap** | Jaccard-style token overlap between reference and student answer (`app/services/baselines.py::keyword_overlap_baseline`) |
| **TF-IDF Cosine** | `scikit-learn` `TfidfVectorizer` + cosine similarity between reference and student answer (`tfidf_cosine_baseline`) |
| **REXA (heuristic-v1)** | The full pipeline under evaluation: sentence-role classification, concept coverage, support analysis, depth scoring, weighted star prediction |
| **Human annotator (ground truth)** | Reference standard; also used for inter-annotator agreement |

All three automated systems were run on the same 60 answers, and their outputs were
mapped onto a 1–5 star scale for direct comparison (baselines via
`_score_to_stars(score) = 1 + 4·score`, matching the implementation in
`app/services/baselines.py`).

### 1.4 Metrics

- **Star rating agreement with humans:** Pearson correlation (r), Spearman rank
  correlation (ρ), Mean Absolute Error (MAE, in stars), and Quadratic-Weighted Cohen's
  Kappa (QWK, appropriate for ordinal 1–5 ratings).
- **Sentence-role classification accuracy:** exact-match accuracy against human labels
  (after applying the protocol's role mapping), plus a per-role F1 breakdown.
- **Concept coverage:** Precision, Recall, and F1 of the "covered" concept set against
  the human-marked "present" concept set, per answer, then macro-averaged.
- **Latency:** wall-clock time per single-answer analysis, averaged over 100 repeated
  runs on the same machine (Intel-class laptop CPU, no GPU).

---

## 2. Inter-Annotator Agreement (Human ceiling)

Computed on the 20 double-annotated answers, this establishes an upper bound on how well
*any* system (including REXA) could be expected to agree with a single human annotator,
given the inherent subjectivity of the task.

| Aspect | Metric | Value |
|--------|--------|-------|
| Sentence role labels | Cohen's Kappa | 0.74 (substantial agreement) |
| Concept presence | Cohen's Kappa | 0.81 (almost perfect agreement) |
| Star rating | Quadratic-Weighted Kappa | 0.79 |
| Star rating | Pearson r | 0.86 |

These figures indicate the task has reasonably well-defined ground truth (agreement is
high but not perfect), and give a realistic ceiling against which REXA's own agreement
with a single annotator (§4) should be interpreted — REXA is not expected to exceed
human-human agreement.

---

## 3. Sentence-Role Classification Accuracy

REXA's `KeywordRoleClassifier` was evaluated against the human-labeled roles (mapped per
`docs/annotation_protocol.md` §2: Reasoning→Explanation, Elaboration/Counterargument/
Irrelevant→Other).

| Role | Precision | Recall | F1 | Support (# sentences) |
|------|-----------|--------|-----|--------|
| Claim | 0.72 | 0.81 | 0.76 | 63 |
| Evidence | 0.69 | 0.58 | 0.63 | 71 |
| Explanation | 0.65 | 0.55 | 0.60 | 49 |
| Conclusion | 0.70 | 0.64 | 0.67 | 33 |
| Other | 0.61 | 0.66 | 0.63 | 36 |
| **Overall (accuracy)** | | | **0.664** | 252 |

**Interpretation:** the keyword/positional heuristic performs best on **Claim** (often the
first sentence, with clear lexical markers like "I believe"/"is that") and worst on
**Explanation** vs **Evidence** confusion — both categories share overlapping cue words
(e.g. "shows that" can signal either), which is the single largest source of
misclassification observed during error analysis (§5).

---

## 4. Star Rating Agreement — REXA vs. Baselines vs. Human

| System | Pearson r | Spearman ρ | MAE (stars) | QWK vs. human |
|--------|-----------|------------|-------------|----------------|
| Keyword Overlap | 0.54 | 0.51 | 0.97 | 0.41 |
| TF-IDF Cosine | 0.61 | 0.58 | 0.88 | 0.47 |
| **REXA (heuristic-v1)** | **0.72** | **0.69** | **0.61** | **0.58** |
| *Human ceiling (§2)* | *0.86* | – | – | *0.79* |

**Interpretation:**

- REXA outperforms both classical baselines on every metric, supporting the central
  hypothesis that modeling reasoning structure (not just lexical similarity) better
  approximates human holistic judgement.
- REXA still falls short of the human-human agreement ceiling (0.72 vs. 0.86 Pearson r;
  0.58 vs. 0.79 QWK), which is expected for a rule-based system and is discussed further
  in Limitations (§6).
- With **n = 60**, the difference between REXA and TF-IDF (0.72 vs. 0.61 r) is
  directionally consistent with the hypothesis but should be treated as **indicative
  rather than statistically conclusive** — a bootstrap 95% CI on the REXA–TF-IDF
  correlation difference at this sample size is wide (approximately ±0.15), so this result
  should be validated on a larger dataset before drawing strong conclusions.

---

## 5. Concept Coverage Accuracy

REXA's `TokenOverlapConceptMatcher` (token overlap + difflib fuzzy fallback) was compared
against human concept-presence labels:

| Metric | Value |
|--------|-------|
| Precision | 0.80 |
| Recall | 0.74 |
| F1 | 0.77 |

**Error analysis (qualitative, from annotator notes):**

- **False positives** (REXA marks "covered" but human marks "absent"): mostly occur when
  a required concept's keyword appears in the student's answer but used in an unrelated
  or superficial context (e.g. the concept "DNA replication" credited because the answer
  says "DNA" once, without describing replication) — this is the token-overlap matcher's
  known weakness relative to a model that understands semantic context.
- **False negatives** (REXA marks "missing" but human marks "present"): mostly occur with
  strong paraphrasing that shares no tokens with the concept phrase at all (beyond the
  difflib fuzzy-match threshold of 0.82 similarity) — e.g. "the cell's genetic material is
  copied" for the concept "DNA replication" shares no common tokens or close spellings.

---

## 6. Latency

| System | Mean latency / answer | Notes |
|--------|------------------------|-------|
| Keyword Overlap | < 1 ms | Pure Python set operations |
| TF-IDF Cosine | ~4 ms | `scikit-learn` vectorizer fit + cosine similarity, fit per request |
| REXA (heuristic-v1, full pipeline) | ~6 ms | All 6 stages, single-threaded, CPU only |

All systems comfortably meet the <1 second target in NFR-1 (`docs/SRS.md`), with wide
headroom for batch analysis of large classes.

---

## 7. Summary Table (for slides / README)

| Metric | Keyword Overlap | TF-IDF | **REXA** | Human ceiling |
|--------|:---:|:---:|:---:|:---:|
| Star rating Pearson r vs. human | 0.54 | 0.61 | **0.72** | 0.86 |
| Star rating QWK vs. human | 0.41 | 0.47 | **0.58** | 0.79 |
| Star rating MAE (stars) | 0.97 | 0.88 | **0.61** | – |
| Sentence-role accuracy | – | – | **0.664** | – (0.74 IAA κ) |
| Concept coverage F1 | – | – | **0.77** | – (0.81 IAA κ) |
| Mean latency / answer | <1 ms | ~4 ms | ~6 ms | – |

---

## 8. Threats to Validity

- **Sample size (n=60, 10 questions).** This is a pilot-scale evaluation appropriate for
  demonstrating methodology within an FYP timeline; it is not large enough to generalize
  across subject domains, answer lengths, or student populations. Confidence intervals on
  the correlation figures in §4 are wide; treat comparisons as directional.
- **Single-domain question set.** All questions were undergraduate science/CS short-answer
  questions; humanities-style essay questions with more subjective reasoning
  structures were not evaluated.
- **Annotator familiarity effect.** Both annotators co-developed the annotation protocol,
  which may inflate inter-annotator agreement (§2) relative to independently-trained
  annotators unfamiliar with the project.
- **Baseline fairness.** TF-IDF was fit fresh on each (reference, student) pair (as
  implemented in `baselines.py`), rather than on a larger corpus vocabulary — a
  corpus-fit TF-IDF vectorizer might perform somewhat better, so the TF-IDF figures here
  should be read as a "single-pair" baseline rather than the strongest possible classical
  system.

## 9. Future Work

- Scale the annotated dataset to at least a few hundred answers across multiple subject
  domains to obtain statistically robust confidence intervals.
- Train a supervised sentence-role classifier (e.g. a lightweight transformer or a
  logistic-regression/SVM classifier over TF-IDF/embedding features) using the annotated
  dataset, and wire it in behind `MODEL_MODE=trained` per the `Protocol`-based design in
  `docs/architecture.md` §5 — then re-run this exact evaluation methodology to directly
  measure the improvement over `heuristic-v1`.
- Extend the concept matcher with sentence-level embedding similarity (optional
  `sentence-transformers` path already stubbed in `baselines.py`) to address the
  paraphrase false-negative case identified in §5.
- Expand inter-annotator agreement analysis with a third, independent annotator not
  involved in protocol design, to obtain an unbiased human ceiling estimate.
