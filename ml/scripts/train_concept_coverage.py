#!/usr/bin/env python
"""Train Module 2: Concept Coverage classifier.

Usage:
    cd ml
    python scripts/train_concept_coverage.py [--config configs/concept_coverage.yaml] [--backend sklearn|transformers]

Binary classification: given a (concept, student_answer) pair, predict
whether the concept is covered. Saves to ml/checkpoints/concept_coverage/.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.data_utils import CHECKPOINTS_DIR, ML_DIR, build_concept_dataset, load_split  # noqa: E402
from src.metrics import classification_metrics, print_metrics_summary, save_metrics_json  # noqa: E402
from src.models.classifiers import ConceptCoverageModel  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=str(Path(__file__).resolve().parents[1] / "configs" / "concept_coverage.yaml"))
    parser.add_argument("--backend", choices=["sklearn", "transformers"], default=None)
    return parser.parse_args()


def load_config(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def main() -> None:
    args = parse_args()
    cfg = load_config(args.config)
    backend = args.backend or cfg.get("backend", "sklearn")
    if backend == "transformers":
        try:
            import torch  # noqa: F401
            import transformers  # noqa: F401

            print(
                "[concept_coverage] transformers backend requested but not yet implemented; "
                "falling back to sklearn."
            )
        except ImportError:
            print("[concept_coverage] torch/transformers not installed - falling back to sklearn backend.")
        backend = "sklearn"

    train = load_split(cfg["data"]["train_split"])
    val = load_split(cfg["data"]["val_split"])
    test = load_split(cfg["data"]["test_split"])

    train_concepts, train_answers, train_labels = build_concept_dataset(train)
    val_concepts, val_answers, val_labels = build_concept_dataset(val)
    test_concepts, test_answers, test_labels = build_concept_dataset(test)

    print(
        f"[concept_coverage] train pairs: {len(train_concepts)}, "
        f"val: {len(val_concepts)}, test: {len(test_concepts)}"
    )

    sk_cfg = cfg.get("sklearn", {})
    model = ConceptCoverageModel(
        max_features=sk_cfg.get("max_features", 2000),
        C=sk_cfg.get("C", 1.0),
    )

    start = time.time()
    model.fit(train_concepts, train_answers, train_labels)
    train_time = time.time() - start
    print(f"[concept_coverage] training completed in {train_time:.2f}s")

    val_preds = model.predict(val_concepts, val_answers) if val_concepts else []
    test_preds = model.predict(test_concepts, test_answers) if test_concepts else []

    val_metrics = classification_metrics(val_labels, val_preds, labels=[0, 1]) if val_concepts else {}
    test_metrics = classification_metrics(test_labels, test_preds, labels=[0, 1]) if test_concepts else {}

    if val_metrics:
        print_metrics_summary("Concept Coverage - Validation", val_metrics)
    if test_metrics:
        print_metrics_summary("Concept Coverage - Test", test_metrics)

    checkpoint_dir = ML_DIR / cfg["output"]["checkpoint_dir"]
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    model_path = checkpoint_dir / "model.joblib"
    model.save(str(model_path))
    print(f"[concept_coverage] saved model to {model_path}")

    metrics_out = {
        "module": "concept_coverage",
        "backend": backend,
        "train_size": len(train_concepts),
        "val_size": len(val_concepts),
        "test_size": len(test_concepts),
        "train_time_seconds": round(train_time, 3),
        "val_metrics": val_metrics,
        "test_metrics": test_metrics,
    }
    metrics_path = ML_DIR / cfg["output"]["metrics_file"]
    save_metrics_json(metrics_out, metrics_path)
    print(f"[concept_coverage] wrote metrics to {metrics_path}")


if __name__ == "__main__":
    main()
