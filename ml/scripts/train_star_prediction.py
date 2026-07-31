#!/usr/bin/env python
"""Train Module 5: Star Prediction regressor.

Usage:
    cd ml
    python scripts/train_star_prediction.py [--config configs/star_prediction.yaml] [--backend sklearn|transformers]

Regresses a holistic 1-5 star rating from (student_answer, reference_answer)
pairs. Saves to ml/checkpoints/star_prediction/.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.data_utils import CHECKPOINTS_DIR, ML_DIR, build_star_dataset, load_split  # noqa: E402
from src.metrics import ordinal_agreement_metrics, print_metrics_summary, regression_metrics, save_metrics_json  # noqa: E402
from src.models.classifiers import StarRegressor  # noqa: E402

import numpy as np


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=str(Path(__file__).resolve().parents[1] / "configs" / "star_prediction.yaml"))
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

            print("[star_prediction] transformers backend requested but not yet implemented; falling back to sklearn.")
        except ImportError:
            print("[star_prediction] torch/transformers not installed - falling back to sklearn backend.")
        backend = "sklearn"

    train = load_split(cfg["data"]["train_split"])
    val = load_split(cfg["data"]["val_split"])
    test = load_split(cfg["data"]["test_split"])

    train_stu, train_ref, train_stars = build_star_dataset(train)
    val_stu, val_ref, val_stars = build_star_dataset(val)
    test_stu, test_ref, test_stars = build_star_dataset(test)

    print(f"[star_prediction] train answers: {len(train_stu)}, val: {len(val_stu)}, test: {len(test_stu)}")

    sk_cfg = cfg.get("sklearn", {})
    model = StarRegressor(
        max_features=sk_cfg.get("max_features", 3000),
        n_estimators=sk_cfg.get("n_estimators", 250),
    )
    model.regressor.set_params(
        learning_rate=sk_cfg.get("learning_rate", 0.05),
        max_depth=sk_cfg.get("max_depth", 3),
    )

    start = time.time()
    model.fit(train_stu, train_ref, train_stars)
    train_time = time.time() - start
    print(f"[star_prediction] training completed in {train_time:.2f}s")

    val_preds = model.predict(val_stu, val_ref) if val_stu else np.array([])
    test_preds = model.predict(test_stu, test_ref) if test_stu else np.array([])

    val_metrics = regression_metrics(val_stars, val_preds) if val_stu else {}
    test_metrics = regression_metrics(test_stars, test_preds) if test_stu else {}

    if val_stu:
        val_metrics.update(ordinal_agreement_metrics(np.round(val_stars), np.round(val_preds)))
    if test_stu:
        test_metrics.update(ordinal_agreement_metrics(np.round(test_stars), np.round(test_preds)))

    if val_metrics:
        print_metrics_summary("Star Prediction - Validation", val_metrics)
    if test_metrics:
        print_metrics_summary("Star Prediction - Test", test_metrics)

    checkpoint_dir = ML_DIR / cfg["output"]["checkpoint_dir"]
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    model_path = checkpoint_dir / "model.joblib"
    model.save(str(model_path))
    print(f"[star_prediction] saved model to {model_path}")

    metrics_out = {
        "module": "star_prediction",
        "backend": backend,
        "train_size": len(train_stu),
        "val_size": len(val_stu),
        "test_size": len(test_stu),
        "train_time_seconds": round(train_time, 3),
        "val_metrics": val_metrics,
        "test_metrics": test_metrics,
    }
    metrics_path = ML_DIR / cfg["output"]["metrics_file"]
    save_metrics_json(metrics_out, metrics_path)
    print(f"[star_prediction] wrote metrics to {metrics_path}")


if __name__ == "__main__":
    main()
