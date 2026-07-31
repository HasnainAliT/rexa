#!/usr/bin/env python
"""Run simple classical baselines for the star-prediction task and compare
them against the ground-truth star labels across the full sample dataset.

Baselines:
  - Keyword overlap (Jaccard-style token overlap between student & reference)
  - TF-IDF cosine similarity between student & reference

Both mirror backend/app/services/baselines.py so the ML-side numbers are
directly comparable to what the FastAPI backend reports.

Usage:
    cd ml
    python scripts/run_baselines.py

Writes results to ../data/baselines/results.json (merged with any existing
content, e.g. trained-model metrics written by evaluate_all.py).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sklearn.feature_extraction.text import TfidfVectorizer  # noqa: E402
from sklearn.metrics.pairwise import cosine_similarity  # noqa: E402

from src.data_utils import BASELINES_DIR, load_json, load_raw_answers, save_json  # noqa: E402
from src.metrics import ordinal_agreement_metrics, regression_metrics  # noqa: E402
from src.models.feature_extractors import token_overlap_ratio  # noqa: E402


def score_to_stars(score: float) -> float:
    stars = 1 + score * 4
    return min(max(stars, 1.0), 5.0)


def keyword_overlap_baseline(answers: list[dict]) -> dict:
    preds = []
    for a in answers:
        score = token_overlap_ratio(a["reference_answer"], a["student_answer"])
        preds.append(score_to_stars(score))
    return {"name": "Keyword Overlap", "predictions": preds}


def tfidf_cosine_baseline(answers: list[dict]) -> dict:
    references = [a["reference_answer"] for a in answers]
    students = [a["student_answer"] for a in answers]
    vectorizer = TfidfVectorizer(stop_words="english")
    corpus = references + students
    matrix = vectorizer.fit_transform(corpus)
    n = len(answers)
    ref_matrix = matrix[:n]
    stu_matrix = matrix[n:]
    preds = []
    for i in range(n):
        sim = float(cosine_similarity(ref_matrix[i], stu_matrix[i])[0][0])
        preds.append(score_to_stars(sim))
    return {"name": "TF-IDF Cosine Similarity", "predictions": preds}


def main() -> None:
    answers = load_raw_answers()
    y_true_stars = [float(a.get("stars_continuous", a.get("stars", 0))) for a in answers]
    y_true_rounded = [round(s) for s in [a.get("stars", 0) for a in answers]]

    baselines = [keyword_overlap_baseline(answers), tfidf_cosine_baseline(answers)]

    results = {"n_samples": len(answers), "baselines": []}
    for baseline in baselines:
        preds = baseline["predictions"]
        reg_metrics = regression_metrics(y_true_stars, preds)
        ord_metrics = ordinal_agreement_metrics(y_true_rounded, [round(p) for p in preds])
        entry = {
            "name": baseline["name"],
            "task": "star_prediction",
            **reg_metrics,
            **ord_metrics,
        }
        results["baselines"].append(entry)
        print(f"\n=== Baseline: {baseline['name']} ===")
        for k, v in reg_metrics.items():
            print(f"  {k}: {v}")
        for k, v in ord_metrics.items():
            print(f"  {k}: {v}")

    output_path = BASELINES_DIR / "results.json"
    existing = {}
    if output_path.exists():
        try:
            existing = load_json(output_path)
        except Exception:
            existing = {}
    existing["baselines_comparison"] = results
    save_json(existing, output_path)
    print(f"\nWrote baseline results to {output_path}")


if __name__ == "__main__":
    main()
