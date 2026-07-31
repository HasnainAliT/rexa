#!/usr/bin/env python
"""Train Module 1: Sentence Roles classifier.

Usage:
    cd ml
    python scripts/train_sentence_roles.py [--config configs/sentence_roles.yaml] [--backend sklearn|transformers]

Loads data from ../data/processed, trains a TF-IDF + LogisticRegression
classifier (sklearn backend, works without GPU/torch), evaluates on val/test,
saves the model to ml/checkpoints/sentence_roles/ and writes metrics.json
beside it.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.data_utils import CHECKPOINTS_DIR, ML_DIR, build_role_dataset, load_split  # noqa: E402
from src.metrics import classification_metrics, print_metrics_summary, save_metrics_json  # noqa: E402
from src.models.classifiers import SklearnRoleClassifier  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=str(Path(__file__).resolve().parents[1] / "configs" / "sentence_roles.yaml"))
    parser.add_argument("--backend", choices=["sklearn", "transformers"], default=None)
    return parser.parse_args()


def load_config(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def try_transformers_backend(cfg: dict) -> bool:
    try:
        import torch  # noqa: F401
        import transformers  # noqa: F401
    except ImportError:
        print("[sentence_roles] torch/transformers not installed - falling back to sklearn backend.")
        return False
    print(
        "[sentence_roles] transformers backend requested but not yet implemented in this "
        "reference pipeline; falling back to sklearn backend. Extend train_sentence_roles.py "
        "to add a Trainer-based fine-tuning loop for the configured model_name."
    )
    return False


def main() -> None:
    args = parse_args()
    cfg = load_config(args.config)
    backend = args.backend or cfg.get("backend", "sklearn")

    if backend == "transformers":
        used_transformers = try_transformers_backend(cfg)
        if not used_transformers:
            backend = "sklearn"

    train = load_split(cfg["data"]["train_split"])
    val = load_split(cfg["data"]["val_split"])
    test = load_split(cfg["data"]["test_split"])

    train_texts, train_pos, train_tot, train_labels = build_role_dataset(train)
    val_texts, val_pos, val_tot, val_labels = build_role_dataset(val)
    test_texts, test_pos, test_tot, test_labels = build_role_dataset(test)

    print(f"[sentence_roles] train sentences: {len(train_texts)}, val: {len(val_texts)}, test: {len(test_texts)}")

    sk_cfg = cfg.get("sklearn", {})
    model = SklearnRoleClassifier(
        max_features=sk_cfg.get("max_features", 3000),
        C=sk_cfg.get("C", 2.0),
    )

    start = time.time()
    model.fit(train_texts, train_pos, train_tot, train_labels)
    train_time = time.time() - start
    print(f"[sentence_roles] training completed in {train_time:.2f}s")

    labels = cfg.get("labels", list(SklearnRoleClassifier.ROLES))

    val_preds = model.predict(val_texts, val_pos, val_tot) if val_texts else []
    test_preds = model.predict(test_texts, test_pos, test_tot) if test_texts else []

    val_metrics = classification_metrics(val_labels, val_preds, labels=labels) if val_texts else {}
    test_metrics = classification_metrics(test_labels, test_preds, labels=labels) if test_texts else {}

    if val_metrics:
        print_metrics_summary("Sentence Roles - Validation", val_metrics)
    if test_metrics:
        print_metrics_summary("Sentence Roles - Test", test_metrics)
        print("\nFull test classification report:")
        for label, stats in test_metrics["classification_report"].items():
            if isinstance(stats, dict):
                print(f"  {label}: precision={stats.get('precision', 0):.3f} recall={stats.get('recall', 0):.3f} f1={stats.get('f1-score', 0):.3f} support={stats.get('support', 0)}")

    checkpoint_dir = ML_DIR / cfg["output"]["checkpoint_dir"]
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    model_path = checkpoint_dir / "model.joblib"
    model.save(str(model_path))
    print(f"[sentence_roles] saved model to {model_path}")

    metrics_out = {
        "module": "sentence_roles",
        "backend": backend,
        "train_size": len(train_texts),
        "val_size": len(val_texts),
        "test_size": len(test_texts),
        "train_time_seconds": round(train_time, 3),
        "val_metrics": val_metrics,
        "test_metrics": test_metrics,
    }
    metrics_path = ML_DIR / cfg["output"]["metrics_file"]
    save_metrics_json(metrics_out, metrics_path)
    print(f"[sentence_roles] wrote metrics to {metrics_path}")


if __name__ == "__main__":
    main()
