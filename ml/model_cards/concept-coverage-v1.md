# Model Card: Concept Coverage Model

**Version:** trained-v1 (auto-generated 2026-07-29 18:05)
**Task:** Binary classification: is a given concept covered by the student answer?
**Backend:** sklearn

## Intended Use

Predicts, per (concept, answer) pair, whether a required concept is present, replacing `TokenOverlapConceptMatcher`.

This model is a trainable counterpart to a stage in the heuristic REXA
pipeline (`backend/app/services/rexa_pipeline.py`). It is intended to
eventually replace that stage once validated on real annotated data; until
then the heuristic remains the default in production (`MODEL_MODE=heuristic`).

## Training Data

- Source: `data/processed/train.json` (see `data/README.md`)
- Train size: 165
- Validation size: 55
- Test size: 55
- Training time: 0.344s

The bundled sample dataset is synthetic (hand-authored CS/SE exam answers at
five quality tiers). Before production use, retrain on real, human-annotated
student answers collected via `data/annotations/annotation_guidelines.md`.

## Validation Metrics

| Metric | Value |
|---|---|
| accuracy | 0.9091 |
| macro_f1 | 0.9028 |
| weighted_f1 | 0.9095 |

## Test Metrics

| Metric | Value |
|---|---|
| accuracy | 0.8545 |
| macro_f1 | 0.8505 |
| weighted_f1 | 0.8563 |

## Limitations

- Trained on a small (n=50) synthetic sample dataset; metrics will not
  generalize to real student answers or other course domains without
  retraining on representative data.
- TF-IDF features do not capture semantic paraphrase (e.g., a correct answer
  phrased very differently from the training vocabulary may be
  under-scored). Consider a transformer backend (`--backend transformers`)
  once sufficient labeled data is available.
- No fairness/bias auditing has been performed across student demographics,
  languages, or writing styles.

## How to Reproduce

```bash
cd ml
python scripts/prepare_data.py
python scripts/train_concept_coverage.py
python scripts/export_model_card.py --module concept_coverage
```
