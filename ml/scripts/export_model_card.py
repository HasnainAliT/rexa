#!/usr/bin/env python
"""Generate/update a model card markdown file from a trained module's
metrics.json, so model_cards/ always reflects the latest training run.

Usage:
    cd ml
    python scripts/export_model_card.py --module sentence_roles
    python scripts/export_model_card.py --module all
"""
from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.data_utils import CHECKPOINTS_DIR, ML_DIR, load_json  # noqa: E402

MODULE_INFO = {
    "sentence_roles": {
        "title": "Sentence Roles Classifier",
        "task": "Multi-class sentence classification (Claim / Evidence / Explanation / Conclusion / Other)",
        "intended_use": (
            "Classifies each sentence of a student's descriptive answer into a discourse role, "
            "replacing `KeywordRoleClassifier` in the heuristic REXA pipeline."
        ),
        "metric_keys": ["accuracy", "macro_f1", "weighted_f1"],
    },
    "concept_coverage": {
        "title": "Concept Coverage Model",
        "task": "Binary classification: is a given concept covered by the student answer?",
        "intended_use": (
            "Predicts, per (concept, answer) pair, whether a required concept is present, "
            "replacing `TokenOverlapConceptMatcher`."
        ),
        "metric_keys": ["accuracy", "macro_f1", "weighted_f1"],
    },
    "support_contradiction": {
        "title": "Support & Contradiction Classifier",
        "task": "3-class classification (Supports / Contradicts / Neutral) of adjacent sentence pairs",
        "intended_use": "Labels the logical relation between consecutive sentences, replacing `CueBasedSupportAnalyzer`.",
        "metric_keys": ["accuracy", "macro_f1", "weighted_f1"],
    },
    "reasoning_depth": {
        "title": "Reasoning Depth Regressor",
        "task": "Regression: continuous [0, 1] reasoning-depth score from raw answer text",
        "intended_use": "Scores how complete a Claim->Evidence->Explanation->Conclusion chain is, replacing `ChainReasoningDepthScorer`.",
        "metric_keys": ["mae", "rmse", "spearman_rho", "r2"],
    },
    "star_prediction": {
        "title": "Star Prediction Regressor",
        "task": "Regression: holistic 1-5 star rating from (student_answer, reference_answer)",
        "intended_use": "Aggregates coverage/depth/structure signals into a final rating, replacing `WeightedStarPredictor`.",
        "metric_keys": ["mae", "rmse", "spearman_rho", "within_one_star_accuracy", "quadratic_weighted_kappa"],
    },
}


def render_card(module: str, metrics: dict) -> str:
    info = MODULE_INFO[module]
    generated = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    test_metrics = metrics.get("test_metrics", {})
    val_metrics = metrics.get("val_metrics", {})

    def fmt_table(m: dict) -> str:
        if not m:
            return "_not available_"
        lines = ["| Metric | Value |", "|---|---|"]
        for key in info["metric_keys"]:
            if key in m:
                lines.append(f"| {key} | {m[key]} |")
        return "\n".join(lines)

    return f"""# Model Card: {info['title']}

**Version:** trained-v1 (auto-generated {generated})
**Task:** {info['task']}
**Backend:** {metrics.get('backend', 'sklearn')}

## Intended Use

{info['intended_use']}

This model is a trainable counterpart to a stage in the heuristic REXA
pipeline (`backend/app/services/rexa_pipeline.py`). It is intended to
eventually replace that stage once validated on real annotated data; until
then the heuristic remains the default in production (`MODEL_MODE=heuristic`).

## Training Data

- Source: `data/processed/train.json` (see `data/README.md`)
- Train size: {metrics.get('train_size', 'n/a')}
- Validation size: {metrics.get('val_size', 'n/a')}
- Test size: {metrics.get('test_size', 'n/a')}
- Training time: {metrics.get('train_time_seconds', 'n/a')}s

The bundled sample dataset is synthetic (hand-authored CS/SE exam answers at
five quality tiers). Before production use, retrain on real, human-annotated
student answers collected via `data/annotations/annotation_guidelines.md`.

## Validation Metrics

{fmt_table(val_metrics)}

## Test Metrics

{fmt_table(test_metrics)}

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
python scripts/train_{module}.py
python scripts/export_model_card.py --module {module}
```
"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--module", default="all", choices=list(MODULE_INFO.keys()) + ["all"])
    args = parser.parse_args()

    modules = list(MODULE_INFO.keys()) if args.module == "all" else [args.module]
    model_cards_dir = ML_DIR / "model_cards"
    model_cards_dir.mkdir(parents=True, exist_ok=True)

    for module in modules:
        metrics_path = CHECKPOINTS_DIR / module / "metrics.json"
        if not metrics_path.exists():
            print(f"[export_model_card] SKIP {module} - no metrics.json at {metrics_path}. Train it first.")
            continue
        metrics = load_json(metrics_path)
        card_name = module.replace("_", "-") + "-v1.md"
        card_path = model_cards_dir / card_name
        card_path.write_text(render_card(module, metrics), encoding="utf-8")
        print(f"[export_model_card] wrote {card_path}")


if __name__ == "__main__":
    main()
