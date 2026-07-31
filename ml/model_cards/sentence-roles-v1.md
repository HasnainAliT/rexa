# Model Card: Sentence Roles Classifier

**Version:** trained-v1 (auto-generated 2026-07-29 18:05)
**Task:** Multi-class sentence classification (Claim / Evidence / Explanation / Conclusion / Other)
**Backend:** sklearn

## Intended Use

Classifies each sentence of a student's descriptive answer into a discourse role, replacing `KeywordRoleClassifier` in the heuristic REXA pipeline.

This model is a trainable counterpart to a stage in the heuristic REXA
pipeline (`backend/app/services/rexa_pipeline.py`). It is intended to
eventually replace that stage once validated on real annotated data; until
then the heuristic remains the default in production (`MODEL_MODE=heuristic`).

## Training Data

- Source: `data/processed/train.json` (see `data/README.md`)
- Train size: 102
- Validation size: 33
- Test size: 32
- Training time: 8.18s

The bundled sample dataset is synthetic (hand-authored CS/SE exam answers at
five quality tiers). Before production use, retrain on real, human-annotated
student answers collected via `data/annotations/annotation_guidelines.md`.

## Validation Metrics

| Metric | Value |
|---|---|
| accuracy | 0.9394 |
| macro_f1 | 0.9408 |
| weighted_f1 | 0.9363 |

## Test Metrics

| Metric | Value |
|---|---|
| accuracy | 0.9688 |
| macro_f1 | 0.9664 |
| weighted_f1 | 0.969 |

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
python scripts/train_sentence_roles.py
python scripts/export_model_card.py --module sentence_roles
```
