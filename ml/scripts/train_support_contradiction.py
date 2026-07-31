#!/usr/bin/env python
"""Train Module 3: Support & Contradiction classifier.

Usage:
    cd ml
    python scripts/train_support_contradiction.py [--config configs/support_contradiction.yaml] [--backend sklearn|transformers]

3-way classification (Supports/Contradicts/Neutral) of adjacent sentence
pairs. Saves to ml/checkpoints/support_contradiction/.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.data_utils import CHECKPOINTS_DIR, ML_DIR, build_support_dataset, load_split  # noqa: E402
from src.metrics import classification_metrics, print_metrics_summary, save_metrics_json  # noqa: E402
from src.models.classifiers import SupportClassifier  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=str(Path(__file__).resolve().parents[1] / "configs" / "support_contradiction.yaml"))
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
                "[support_contradiction] transformers backend requested but not yet implemented; "
                "falling back to sklearn."
            )
        except ImportError:
            print("[support_contradiction] torch/transformers not installed - falling back to sklearn backend.")
        backend = "sklearn"

    train = load_split(cfg["data"]["train_split"])
    val = load_split(cfg["data"]["val_split"])
    test = load_split(cfg["data"]["test_split"])

    train_src, train_tgt, train_labels = build_support_dataset(train)
    val_src, val_tgt, val_labels = build_support_dataset(val)
    test_src, test_tgt, test_labels = build_support_dataset(test)

    print(
        f"[support_contradiction] train pairs: {len(train_src)}, "
        f"val: {len(val_src)}, test: {len(test_src)}"
    )

    sk_cfg = cfg.get("sklearn", {})
    model = SupportClassifier(max_features=sk_cfg.get("max_features", 2500))
    model.classifier.set_params(
        n_estimators=sk_cfg.get("n_estimators", 200),
        learning_rate=sk_cfg.get("learning_rate", 0.1),
        max_depth=sk_cfg.get("max_depth", 3),
    )

    start = time.time()
    model.fit(train_src, train_tgt, train_labels)
    train_time = time.time() - start
    print(f"[support_contradiction] training completed in {train_time:.2f}s")

    labels = cfg.get("labels", list(SupportClassifier.LABELS))

    val_preds = model.predict(val_src, val_tgt) if val_src else []
    test_preds = model.predict(test_src, test_tgt) if test_src else []

    val_metrics = classification_metrics(val_labels, val_preds, labels=labels) if val_src else {}
    test_metrics = classification_metrics(test_labels, test_preds, labels=labels) if test_src else {}

    if val_metrics:
        print_metrics_summary("Support & Contradiction - Validation", val_metrics)
    if test_metrics:
        print_metrics_summary("Support & Contradiction - Test", test_metrics)

    checkpoint_dir = ML_DIR / cfg["output"]["checkpoint_dir"]
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    model_path = checkpoint_dir / "model.joblib"
    model.save(str(model_path))
    print(f"[support_contradiction] saved model to {model_path}")

    metrics_out = {
        "module": "support_contradiction",
        "backend": backend,
        "train_size": len(train_src),
        "val_size": len(val_src),
        "test_size": len(test_src),
        "train_time_seconds": round(train_time, 3),
        "val_metrics": val_metrics,
        "test_metrics": test_metrics,
    }
    metrics_path = ML_DIR / cfg["output"]["metrics_file"]
    save_metrics_json(metrics_out, metrics_path)
    print(f"[support_contradiction] wrote metrics to {metrics_path}")


if __name__ == "__main__":
    main()
