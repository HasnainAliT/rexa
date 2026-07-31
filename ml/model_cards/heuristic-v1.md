# Model Card: REXA Heuristic Pipeline (heuristic-v1)

**Version:** heuristic-v1
**Task:** End-to-end descriptive-answer assessment (all 5 REXA modules)
**Backend:** rule-based (no ML dependencies beyond `difflib`/`re`)

## Intended Use

`heuristic-v1` is the current production default (`MODEL_MODE=heuristic`) in
`backend/app/services/rexa_pipeline.py`. It implements all five REXA stages
with hand-written rules:

| Stage | Class | Approach |
|---|---|---|
| Sentence Roles | `KeywordRoleClassifier` | Keyword marker counts + positional priors |
| Concept Coverage | `TokenOverlapConceptMatcher` | Token overlap + `difflib` fuzzy matching |
| Support & Contradiction | `CueBasedSupportAnalyzer` | Cue-word lookup on adjacent sentence pairs |
| Reasoning Depth | `ChainReasoningDepthScorer` | Weighted formula over role diversity, support ratio, length |
| Star Prediction | `WeightedStarPredictor` | Weighted linear combination of the above dimension scores |

It requires zero training data and runs with no GPU/torch dependency,
making it a safe, always-available fallback and a useful comparison
baseline for the trainable modules in `ml/`.

## Training Data

None — this is a deterministic, rule-based system. Rules were authored by
inspecting representative CS/SE exam answers and common discourse markers
(e.g. "for example", "because", "in conclusion", "however").

## Metrics

The heuristic pipeline has no learned parameters, so traditional train/test
metrics do not apply. Instead, `ml/scripts/evaluate_all.py` and
`ml/scripts/run_baselines.py` compare **trained** REXA modules against two
classical baselines (`Keyword Overlap`, `TF-IDF Cosine Similarity`) on the
star-prediction task; results are written to `data/baselines/results.json`.
As a rough proxy, the heuristic pipeline's star-prediction formula and the
`TF-IDF Cosine Similarity` baseline are structurally similar (both are
coverage/similarity-driven linear combinations), so that baseline's numbers
are a reasonable stand-in for the heuristic's expected behavior on this
sample dataset.

## Limitations

- Keyword/cue lists are English-only and were not exhaustively validated
  against diverse student writing styles, so recall on unusual phrasing is
  limited.
- No handling of paraphrase, synonymy beyond simple fuzzy string matching,
  or multi-sentence reasoning spanning more than adjacent sentence pairs.
- Deterministic and fully explainable, but a ceiling exists on achievable
  accuracy since it cannot learn from labeled examples.
- Intended to be superseded by the trained modules in `ml/checkpoints/`
  once those are validated on sufficient real annotated data (see
  `ml/model_cards/sentence-roles-v1.md`, `concept-coverage-v1.md`,
  `support-contradiction-v1.md`, `reasoning-depth-v1.md`,
  `star-prediction-v1.md`).

## How to Compare Against Trained Models

```bash
cd ml
python scripts/prepare_data.py
python scripts/train_sentence_roles.py
python scripts/train_concept_coverage.py
python scripts/train_support_contradiction.py
python scripts/train_reasoning_depth.py
python scripts/train_star_prediction.py
python scripts/evaluate_all.py     # writes ../data/baselines/results.json
python scripts/run_baselines.py    # adds keyword/TF-IDF baseline numbers
```
