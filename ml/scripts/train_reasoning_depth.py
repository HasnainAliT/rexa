#!/usr/bin/env python
"""Train Module 4: Reasoning Depth regressor.

Usage:
    cd ml
    python scripts/train_reasoning_depth.py [--config configs/reasoning_depth.yaml] [--backend sklearn|transformers]

Regresses a continuous [0, 1] reasoning-depth score from raw student answer
text. Saves to ml/checkpoints/reasoning_depth/.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.data_utils import CHECKPOINTS_DIR, ML_DIR, build_depth_dataset, load_split  # noqa: E402
from src.metrics import print_metrics_summary, regression_metrics, save_metrics_json  # noqa: E402
from src.models.classifiers import DepthRegressor  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=str(Path(__file__).resolve().parents[1] / "configs" / "reasoning_depth.yaml"))
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

            print("[reasoning_depth] transformers backend requested but not yet implemented; falling back to sklearn.")
        except ImportError:
            print("[reasoning_depth] torch/transformers not installed - falling back to sklearn backend.")
        backend = "sklearn"

    train = load_split(cfg["data"]["train_split"])
    val = load_split(cfg["data"]["val_split"])
    test = load_split(cfg["data"]["test_split"])

    train_texts, train_scores = build_depth_dataset(train)
    val_texts, val_scores = build_depth_dataset(val)
    test_texts, test_scores = build_depth_dataset(test)

    print(f"[reasoning_depth] train answers: {len(train_texts)}, val: {len(val_texts)}, test: {len(test_texts)}")

    sk_cfg = cfg.get("sklearn", {})
    model = DepthRegressor(
        max_features=sk_cfg.get("max_features", 3000),
        n_estimators=sk_cfg.get("n_estimators", 200),
    )
    model.regressor.set_params(max_depth=sk_cfg.get("max_depth", 8))

    start = time.time()
    model.fit(train_texts, train_scores)
    train_time = time.time() - start
    print(f"[reasoning_depth] training completed in {train_time:.2f}s")

    val_preds = model.predict(val_texts) if val_texts else []
    test_preds = model.predict(test_texts) if test_texts else []

    val_metrics = regression_metrics(val_scores, val_preds) if val_texts else {}
    test_metrics = regression_metrics(test_scores, test_preds) if test_texts else {}

    if val_metrics:
        print_metrics_summary("Reasoning Depth - Validation", val_metrics)
    if test_metrics:
        print_metrics_summary("Reasoning Depth - Test", test_metrics)

    checkpoint_dir = ML_DIR / cfg["output"]["checkpoint_dir"]
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    model_path = checkpoint_dir / "model.joblib"
    model.save(str(model_path))
    print(f"[reasoning_depth] saved model to {model_path}")

    metrics_out = {
        "module": "reasoning_depth",
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
    print(f"[reasoning_depth] wrote metrics to {metrics_path}")


if __name__ == "__main__":
    main()
