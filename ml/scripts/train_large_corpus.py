#!/usr/bin/env python
"""Train all RExA modules on the large AES/SAS corpus and export FYP metrics.

Usage:
  cd ml
  python scripts/build_large_corpus.py          # once
  python scripts/train_large_corpus.py

Reads:  ../data/processed/large/{train,val,test}.json
Writes: checkpoints/large/<module>/{model.joblib,metrics.json}
        ../data/baselines/large_results.json
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.data_utils import (  # noqa: E402
    CHECKPOINTS_DIR,
    build_concept_dataset,
    build_depth_dataset,
    build_role_dataset,
    build_star_dataset,
    build_support_dataset,
)
from src.metrics import (  # noqa: E402
    classification_metrics,
    ordinal_agreement_metrics,
    print_metrics_summary,
    regression_metrics,
    save_metrics_json,
)
from src.models.classifiers import (  # noqa: E402
    ConceptCoverageModel,
    DepthRegressor,
    SklearnRoleClassifier,
    StarRegressor,
    SupportClassifier,
)

DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "processed" / "large"
OUT_ROOT = CHECKPOINTS_DIR / "large"
BASELINES_OUT = Path(__file__).resolve().parents[2] / "data" / "baselines" / "large_results.json"


def load_split(name: str) -> list[dict]:
    path = DATA_DIR / f"{name}.json"
    if not path.exists():
        raise FileNotFoundError(f"Missing {path}. Run scripts/build_large_corpus.py first.")
    return json.loads(path.read_text(encoding="utf-8"))


def keyword_baseline_stars(students: list[str], references: list[str]) -> np.ndarray:
    preds = []
    for s, r in zip(students, references):
        st = set((s or "").lower().split())
        rt = set((r or "").lower().split())
        if not st or not rt:
            preds.append(1.0)
            continue
        overlap = len(st & rt) / max(len(st | rt), 1)
        preds.append(1.0 + 4.0 * overlap)
    return np.array(preds, dtype=float)


def train_roles(train, val, test) -> dict:
    print("\n=== Sentence Roles ===")
    tr_t, tr_p, tr_n, tr_y = build_role_dataset(train)
    va_t, va_p, va_n, va_y = build_role_dataset(val)
    te_t, te_p, te_n, te_y = build_role_dataset(test)
    # Subsample roles if enormous (long essays → many sentences)
    max_train = 80000
    if len(tr_t) > max_train:
        idx = np.random.RandomState(42).choice(len(tr_t), max_train, replace=False)
        tr_t = [tr_t[i] for i in idx]
        tr_p = [tr_p[i] for i in idx]
        tr_n = [tr_n[i] for i in idx]
        tr_y = [tr_y[i] for i in idx]
    print(f"train sentences={len(tr_t)} val={len(va_t)} test={len(te_t)}")
    model = SklearnRoleClassifier(max_features=5000, C=2.0)
    t0 = time.time()
    model.fit(tr_t, tr_p, tr_n, tr_y)
    print(f"trained in {time.time() - t0:.1f}s")
    pred = model.predict(te_t, te_p, te_n)
    metrics = classification_metrics(te_y, pred)
    print_metrics_summary("Sentence Roles (test)", metrics)
    out = OUT_ROOT / "sentence_roles"
    out.mkdir(parents=True, exist_ok=True)
    model.save(str(out / "model.joblib"))
    save_metrics_json(metrics, out / "metrics.json")
    return metrics


def train_concepts(train, val, test) -> dict:
    print("\n=== Concept Coverage ===")
    tr_c, tr_a, tr_y = build_concept_dataset(train)
    te_c, te_a, te_y = build_concept_dataset(test)
    max_train = 60000
    if len(tr_c) > max_train:
        idx = np.random.RandomState(42).choice(len(tr_c), max_train, replace=False)
        tr_c = [tr_c[i] for i in idx]
        tr_a = [tr_a[i] for i in idx]
        tr_y = [tr_y[i] for i in idx]
    print(f"train pairs={len(tr_c)} test={len(te_c)}")
    model = ConceptCoverageModel(max_features=4000, C=1.0)
    model.fit(tr_c, tr_a, tr_y)
    pred = model.predict(te_c, te_a)
    metrics = classification_metrics(te_y, pred)
    print_metrics_summary("Concept Coverage (test)", metrics)
    out = OUT_ROOT / "concept_coverage"
    out.mkdir(parents=True, exist_ok=True)
    model.save(str(out / "model.joblib"))
    save_metrics_json(metrics, out / "metrics.json")
    return metrics


def train_support(train, val, test) -> dict:
    print("\n=== Support & Contradiction ===")
    tr_s, tr_t, tr_y = build_support_dataset(train)
    te_s, te_t, te_y = build_support_dataset(test)
    max_train = 60000
    if len(tr_s) > max_train:
        idx = np.random.RandomState(42).choice(len(tr_s), max_train, replace=False)
        tr_s = [tr_s[i] for i in idx]
        tr_t = [tr_t[i] for i in idx]
        tr_y = [tr_y[i] for i in idx]
    print(f"train pairs={len(tr_s)} test={len(te_s)}")
    if len(tr_s) < 10:
        return {"skipped": True, "reason": "too few support pairs"}
    model = SupportClassifier(max_features=4000)
    model.fit(tr_s, tr_t, tr_y)
    pred = model.predict(te_s, te_t)
    metrics = classification_metrics(te_y, pred)
    print_metrics_summary("Support (test)", metrics)
    out = OUT_ROOT / "support_contradiction"
    out.mkdir(parents=True, exist_ok=True)
    model.save(str(out / "model.joblib"))
    save_metrics_json(metrics, out / "metrics.json")
    return metrics


def train_depth(train, val, test) -> dict:
    print("\n=== Reasoning Depth ===")
    tr_x, tr_y = build_depth_dataset(train)
    te_x, te_y = build_depth_dataset(test)
    print(f"train={len(tr_x)} test={len(te_x)}")
    model = DepthRegressor(max_features=5000, n_estimators=150)
    model.fit(tr_x, tr_y)
    pred = model.predict(te_x)
    metrics = regression_metrics(te_y, pred)
    print_metrics_summary("Reasoning Depth (test)", metrics)
    out = OUT_ROOT / "reasoning_depth"
    out.mkdir(parents=True, exist_ok=True)
    model.save(str(out / "model.joblib"))
    save_metrics_json(metrics, out / "metrics.json")
    return metrics


def train_stars(train, val, test) -> dict:
    print("\n=== Star Prediction (gold human scores) ===")
    tr_s, tr_r, tr_y = build_star_dataset(train)
    te_s, te_r, te_y = build_star_dataset(test)
    print(f"train={len(tr_s)} test={len(te_s)}")
    # Lighter model for 18k+ essays (full GBDT is too slow on high-dim TF-IDF)
    model = StarRegressor(max_features=3000, n_estimators=80)
    t0 = time.time()
    model.fit(tr_s, tr_r, tr_y)
    print(f"trained in {time.time() - t0:.1f}s")
    pred = model.predict(te_s, te_r)
    metrics = {
        **regression_metrics(te_y, pred),
        **ordinal_agreement_metrics(te_y, pred),
    }
    print_metrics_summary("Star Prediction (test)", metrics)

    baseline = keyword_baseline_stars(te_s, te_r)
    baseline_metrics = {
        **regression_metrics(te_y, baseline),
        **ordinal_agreement_metrics(te_y, baseline),
    }
    print_metrics_summary("Keyword baseline (test)", baseline_metrics)

    out = OUT_ROOT / "star_prediction"
    out.mkdir(parents=True, exist_ok=True)
    model.save(str(out / "model.joblib"))
    save_metrics_json(metrics, out / "metrics.json")
    return {"rexa": metrics, "keyword_baseline": baseline_metrics}


def main() -> None:
    train = load_split("train")
    val = load_split("val")
    test = load_split("test")
    print(f"Loaded large corpus: train={len(train)} val={len(val)} test={len(test)}")
    OUT_ROOT.mkdir(parents=True, exist_ok=True)

    report = {
        "corpus": {
            "train": len(train),
            "val": len(val),
            "test": len(test),
            "total": len(train) + len(val) + len(test),
            "sources": ["asap2 (HF/Kaggle AES 2.0)", "aera-asap-sas (HF AERA)"],
        },
        "modules": {},
    }
    report["modules"]["sentence_roles"] = train_roles(train, val, test)
    report["modules"]["concept_coverage"] = train_concepts(train, val, test)
    report["modules"]["support_contradiction"] = train_support(train, val, test)
    report["modules"]["reasoning_depth"] = train_depth(train, val, test)
    report["modules"]["star_prediction"] = train_stars(train, val, test)

    BASELINES_OUT.parent.mkdir(parents=True, exist_ok=True)
    BASELINES_OUT.write_text(json.dumps(report, indent=2, default=float), encoding="utf-8")
    print(f"\n[large] wrote consolidated metrics to {BASELINES_OUT}")


if __name__ == "__main__":
    main()
