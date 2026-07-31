# Model Card: Reasoning Depth Regressor

**Version:** trained-v1 (auto-generated 2026-07-29 18:05)
**Task:** Regression: continuous [0, 1] reasoning-depth score from raw answer text
**Backend:** sklearn

## Intended Use

Scores how complete a Claim->Evidence->Explanation->Conclusion chain is, replacing `ChainReasoningDepthScorer`.

This model is a trainable counterpart to a stage in the heuristic REXA
pipeline (`backend/app/services/rexa_pipeline.py`). It is intended to
eventually replace that stage once validated on real annotated data; until
then the heuristic remains the default in production (`MODEL_MODE=heuristic`).

## Training Data

- Source: `data/processed/train.json` (see `data/README.md`)
- Train size: 30
- Validation size: 10
- Test size: 10
- Training time: 2.574s

The bundled sample dataset is synthetic (hand-authored CS/SE exam answers at
five quality tiers). Before production use, retrain on real, human-annotated
student answers collected via `data/annotations/annotation_guidelines.md`.

## Validation Metrics

| Metric | Value |
|---|---|
| mae | 0.034 |
| rmse | 0.0388 |
| spearman_rho | 0.9394 |
| r2 | 0.9897 |

## Test Metrics

| Metric | Value |
|---|---|
| mae | 0.0286 |
| rmse | 0.0416 |
| spearman_rho | 0.9515 |
| r2 | 0.9887 |

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
python scripts/train_reasoning_depth.py
python scripts/export_model_card.py --module reasoning_depth
```
