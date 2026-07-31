#!/usr/bin/env python
"""Evaluate all five trained REXA modules on the test split and compare the
star-prediction module against the keyword/TF-IDF baselines.

Usage:
    cd ml
    python scripts/evaluate_all.py

Requires checkpoints produced by the train_*.py scripts (run them first, or
via `python scripts/prepare_data.py && python scripts/train_*.py` for each
module). Writes a consolidated report to ../data/baselines/results.json.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402
from sklearn.feature_extraction.text import TfidfVectorizer  # noqa: E402
from sklearn.metrics.pairwise import cosine_similarity  # noqa: E402

from src.data_utils import (  # noqa: E402
    BASELINES_DIR,
    CHECKPOINTS_DIR,
    build_concept_dataset,
    build_depth_dataset,
    build_role_dataset,
    build_star_dataset,
    build_support_dataset,
    load_json,
    load_split,
    save_json,
)
from src.metrics import classification_metrics, ordinal_agreement_metrics, regression_metrics  # noqa: E402
from src.models.classifiers import (  # noqa: E402
    ConceptCoverageModel,
    DepthRegressor,
    SklearnRoleClassifier,
    StarRegressor,
    SupportClassifier,
)
from src.models.feature_extractors import token_overlap_ratio  # noqa: E402


def score_to_stars(score: float) -> float:
    return min(max(1 + score * 4, 1.0), 5.0)


def evaluate_sentence_roles(test: list[dict]) -> dict | None:
    path = CHECKPOINTS_DIR / "sentence_roles" / "model.joblib"
    if not path.exists():
        print(f"[evaluate_all] SKIP sentence_roles - no checkpoint at {path}")
        return None
    model = SklearnRoleClassifier.load(str(path))
    texts, pos, tot, labels = build_role_dataset(test)
    if not texts:
        return None
    preds = model.predict(texts, pos, tot)
    metrics = classification_metrics(labels, preds, labels=list(SklearnRoleClassifier.ROLES))
    print(f"[evaluate_all] sentence_roles: accuracy={metrics['accuracy']} macro_f1={metrics['macro_f1']}")
    return metrics


def evaluate_concept_coverage(test: list[dict]) -> dict | None:
    path = CHECKPOINTS_DIR / "concept_coverage" / "model.joblib"
    if not path.exists():
        print(f"[evaluate_all] SKIP concept_coverage - no checkpoint at {path}")
        return None
    model = ConceptCoverageModel.load(str(path))
    concepts, texts, labels = build_concept_dataset(test)
    if not concepts:
        return None
    preds = model.predict(concepts, texts)
    metrics = classification_metrics(labels, preds, labels=[0, 1])
    print(f"[evaluate_all] concept_coverage: accuracy={metrics['accuracy']} macro_f1={metrics['macro_f1']}")
    return metrics


def evaluate_support_contradiction(test: list[dict]) -> dict | None:
    path = CHECKPOINTS_DIR / "support_contradiction" / "model.joblib"
    if not path.exists():
        print(f"[evaluate_all] SKIP support_contradiction - no checkpoint at {path}")
        return None
    model = SupportClassifier.load(str(path))
    src, tgt, labels = build_support_dataset(test)
    if not src:
        return None
    preds = model.predict(src, tgt)
    metrics = classification_metrics(labels, preds, labels=list(SupportClassifier.LABELS))
    print(f"[evaluate_all] support_contradiction: accuracy={metrics['accuracy']} macro_f1={metrics['macro_f1']}")
    return metrics


def evaluate_reasoning_depth(test: list[dict]) -> dict | None:
    path = CHECKPOINTS_DIR / "reasoning_depth" / "model.joblib"
    if not path.exists():
        print(f"[evaluate_all] SKIP reasoning_depth - no checkpoint at {path}")
        return None
    model = DepthRegressor.load(str(path))
    texts, scores = build_depth_dataset(test)
    if not texts:
        return None
    preds = model.predict(texts)
    metrics = regression_metrics(scores, preds)
    print(f"[evaluate_all] reasoning_depth: mae={metrics['mae']} spearman_rho={metrics['spearman_rho']}")
    return metrics


def evaluate_star_prediction(test: list[dict]) -> tuple[dict | None, list[float] | None, list[float] | None]:
    path = CHECKPOINTS_DIR / "star_prediction" / "model.joblib"
    if not path.exists():
        print(f"[evaluate_all] SKIP star_prediction - no checkpoint at {path}")
        return None, None, None
    model = StarRegressor.load(str(path))
    students, references, stars = build_star_dataset(test)
    if not students:
        return None, None, None
    preds = model.predict(students, references)
    metrics = regression_metrics(stars, preds)
    metrics.update(ordinal_agreement_metrics(np.round(stars), np.round(preds)))
    print(f"[evaluate_all] star_prediction: mae={metrics['mae']} within_one_star={metrics['within_one_star_accuracy']}")
    return metrics, list(stars), list(preds)


def baseline_predictions(test: list[dict]) -> dict[str, list[float]]:
    references = [a["reference_answer"] for a in test]
    students = [a["student_answer"] for a in test]

    keyword_preds = [score_to_stars(token_overlap_ratio(r, s)) for r, s in zip(references, students)]

    vectorizer = TfidfVectorizer(stop_words="english")
    corpus = references + students
    matrix = vectorizer.fit_transform(corpus)
    n = len(test)
    ref_matrix, stu_matrix = matrix[:n], matrix[n:]
    tfidf_preds = [
        score_to_stars(float(cosine_similarity(ref_matrix[i], stu_matrix[i])[0][0])) for i in range(n)
    ]
    return {"keyword_overlap": keyword_preds, "tfidf_cosine": tfidf_preds}


def main() -> None:
    test = load_split("test")
    print(f"[evaluate_all] evaluating on {len(test)} test answers")

    report: dict = {"n_test_samples": len(test), "modules": {}}

    role_metrics = evaluate_sentence_roles(test)
    if role_metrics:
        report["modules"]["sentence_roles"] = role_metrics

    coverage_metrics = evaluate_concept_coverage(test)
    if coverage_metrics:
        report["modules"]["concept_coverage"] = coverage_metrics

    support_metrics = evaluate_support_contradiction(test)
    if support_metrics:
        report["modules"]["support_contradiction"] = support_metrics

    depth_metrics = evaluate_reasoning_depth(test)
    if depth_metrics:
        report["modules"]["reasoning_depth"] = depth_metrics

    star_metrics, y_true_stars, star_preds = evaluate_star_prediction(test)
    if star_metrics:
        report["modules"]["star_prediction"] = star_metrics

    if y_true_stars is not None:
        baselines = baseline_predictions(test)
        comparison = {"trained_model": star_metrics}
        for name, preds in baselines.items():
            reg = regression_metrics(y_true_stars, preds)
            ord_m = ordinal_agreement_metrics(np.round(y_true_stars), np.round(preds))
            comparison[name] = {**reg, **ord_m}
            print(f"[evaluate_all] baseline {name}: mae={reg['mae']} within_one_star={ord_m['within_one_star_accuracy']}")
        report["star_prediction_vs_baselines"] = comparison

    output_path = BASELINES_DIR / "results.json"
    existing = {}
    if output_path.exists():
        try:
            existing = load_json(output_path)
        except Exception:
            existing = {}
    existing["evaluate_all"] = report
    save_json(existing, output_path)
    print(f"\n[evaluate_all] wrote consolidated report to {output_path}")


if __name__ == "__main__":
    main()
