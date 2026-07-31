"""Shared evaluation metrics for the REXA ML modules."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
from scipy.stats import spearmanr
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    cohen_kappa_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)


def classification_metrics(y_true, y_pred, labels: list[str] | None = None) -> dict[str, Any]:
    report = classification_report(y_true, y_pred, labels=labels, output_dict=True, zero_division=0)
    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "macro_f1": round(float(f1_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        "weighted_f1": round(float(f1_score(y_true, y_pred, average="weighted", zero_division=0)), 4),
        "classification_report": report,
    }


def ordinal_agreement_metrics(y_true, y_pred) -> dict[str, Any]:
    """Metrics appropriate for an ordinal target such as star ratings when
    treated as a classification/rounded task (exact + within-1 accuracy plus
    quadratic-weighted kappa).
    """
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    exact = float(np.mean(y_true == y_pred))
    within_one = float(np.mean(np.abs(y_true - y_pred) <= 1))
    try:
        kappa = float(cohen_kappa_score(y_true, y_pred, weights="quadratic"))
    except ValueError:
        kappa = 0.0
    return {
        "exact_accuracy": round(exact, 4),
        "within_one_star_accuracy": round(within_one, 4),
        "quadratic_weighted_kappa": round(kappa, 4),
    }


def regression_metrics(y_true, y_pred) -> dict[str, Any]:
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    try:
        r2 = float(r2_score(y_true, y_pred))
    except ValueError:
        r2 = 0.0
    if len(y_true) >= 2 and np.std(y_true) > 0 and np.std(y_pred) > 0:
        rho, pvalue = spearmanr(y_true, y_pred)
        rho = float(rho) if rho == rho else 0.0  # guard against NaN
        pvalue = float(pvalue) if pvalue == pvalue else 1.0
    else:
        rho, pvalue = 0.0, 1.0
    return {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "r2": round(r2, 4),
        "spearman_rho": round(rho, 4),
        "spearman_pvalue": round(pvalue, 4),
        "n_samples": int(len(y_true)),
    }


def save_metrics_json(metrics: dict[str, Any], path: str | Path) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2, ensure_ascii=False)


def print_metrics_summary(title: str, metrics: dict[str, Any]) -> None:
    print(f"\n=== {title} ===")
    for key, value in metrics.items():
        if key == "classification_report":
            continue
        print(f"  {key}: {value}")
