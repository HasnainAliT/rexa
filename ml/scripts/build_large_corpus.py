#!/usr/bin/env python
"""Build a large RExA training corpus (20k–30k+) from public AES/SAS datasets.

Primary sources (Hugging Face / Kaggle-origin):
  1. Learning Agency Lab ASAP 2.0 — jatinmehra/Automated-Essay-Scoring-2.0
     (~17,307 argumentative essays, human scores 1–6)
  2. AERA / ASAP-SAS (Hewlett Short Answer Scoring) — jiazhengli/AERA
     (science/biology short answers with Score1)

Outputs:
  data/raw/large/corpus_manifest.json
  data/processed/large/{train,val,test}.json

Scores are mapped to RExA 1–5 stars. RExA structural labels (roles, support,
depth, concepts) are produced as *silver labels* via the heuristic REXA
pipeline — a standard semi-supervised approach when public corpora only
provide holistic scores. Human ASAP/AES scores remain the gold target for
star prediction metrics.
"""
from __future__ import annotations

import json
import random
import re
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
LARGE_RAW = ROOT / "data" / "raw" / "large"
OUT_DIR = ROOT / "data" / "processed" / "large"
BACKEND = ROOT / "backend"

sys.path.insert(0, str(BACKEND))

SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'])|\n+")


def map_score_to_stars(score: float, lo: float, hi: float) -> float:
    """Linearly map a dataset score range onto RExA stars [1, 5]."""
    if hi <= lo:
        return 3.0
    norm = (float(score) - lo) / (hi - lo)
    stars = 1.0 + 4.0 * max(0.0, min(1.0, norm))
    return round(stars, 2)


def split_sentences(text: str) -> list[str]:
    text = (text or "").strip()
    if not text:
        return []
    parts = [p.strip() for p in SENTENCE_SPLIT_RE.split(text) if p and p.strip()]
    return parts[:40]  # cap very long essays for silver labeling speed


def load_asap2() -> list[dict]:
    path = LARGE_RAW / "asap2_train.csv"
    if not path.exists():
        raise FileNotFoundError(f"Missing {path}. Download ASAP 2.0 train.csv first.")
    df = pd.read_csv(path)
    rows = []
    for _, r in df.iterrows():
        text = str(r["full_text"]).strip()
        if len(text) < 40:
            continue
        score = float(r["score"])
        rows.append(
            {
                "id": f"asap2-{r['essay_id']}",
                "source": "asap2",
                "question_id": "asap2-argumentative",
                "question_text": (
                    "Write an argumentative essay that presents a clear claim, "
                    "supports it with evidence from the source material, and "
                    "explains your reasoning."
                ),
                "reference_answer": (
                    "A strong response states a clear claim, cites relevant evidence, "
                    "explains how the evidence supports the claim, addresses the topic "
                    "thoroughly, and ends with a coherent conclusion."
                ),
                "concepts": [
                    "claim",
                    "evidence",
                    "reasoning",
                    "conclusion",
                    "source material",
                ],
                "student_answer": text,
                "raw_score": score,
                "stars": map_score_to_stars(score, 1, 6),
                "course": "Argumentative Writing (ASAP 2.0)",
            }
        )
    return rows


def load_aera() -> list[dict]:
    rows: list[dict] = []
    for split_name, fname in (
        ("train", "aera_train.json"),
        ("val", "aera_val.json"),
        ("test", "aera_test.json"),
    ):
        path = LARGE_RAW / fname
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            # possible {data: [...]} wrappers
            data = data.get("data") or data.get("rows") or list(data.values())[0]
        for i, item in enumerate(data):
            text = (
                item.get("EssayText")
                or item.get("essay_text")
                or item.get("answer")
                or item.get("text")
                or ""
            ).strip()
            if len(text) < 20:
                continue
            score = item.get("Score1", item.get("score", item.get("llm_rationale_score")))
            if score is None:
                continue
            try:
                score_f = float(score)
            except (TypeError, ValueError):
                continue
            essay_set = item.get("EssaySet", item.get("essay_set", "sas"))
            # ASAP-SAS scores are typically 0–3 (sometimes 0–2 per set)
            stars = map_score_to_stars(score_f, 0, 3)
            rows.append(
                {
                    "id": f"aera-{split_name}-{item.get('Id', i)}",
                    "source": "aera-asap-sas",
                    "question_id": f"asap-sas-{essay_set}",
                    "question_text": f"Short-answer science/biology prompt set {essay_set}.",
                    "reference_answer": (
                        "A complete short answer covers the required scientific concepts, "
                        "states the main claim clearly, and supports it with explanation."
                    ),
                    "concepts": [
                        "scientific concept",
                        "explanation",
                        "evidence",
                        "conclusion",
                    ],
                    "student_answer": text,
                    "raw_score": score_f,
                    "stars": stars,
                    "course": "ASAP-SAS Science (via AERA)",
                }
            )
    return rows


def silver_label(record: dict, pipeline) -> dict:
    """Attach RExA silver labels using the heuristic pipeline + gold stars."""
    # Truncate ultra-long essays so silver labeling stays tractable at 20k+ scale
    answer = record["student_answer"]
    if len(answer) > 2500:
        answer = answer[:2500]

    result = pipeline.run(
        question_text=record["question_text"],
        reference_answer=record["reference_answer"],
        student_answer=answer,
        concepts=record["concepts"],
    )
    highlights = result.get("highlights") or []
    sentence_roles = [
        {"text": h["text"], "role": h["role"]} for h in highlights if h.get("text")
    ]
    if not sentence_roles:
        # fallback: mark first/last if splitter failed
        sents = split_sentences(record["student_answer"])
        sentence_roles = [{"text": s, "role": "Other"} for s in sents[:12]]

    coverage = result.get("concept_coverage") or {}
    support = result.get("support_pairs") or []
    support_pairs = [
        {
            "i": p.get("source_index", 0),
            "j": p.get("target_index", 0),
            "label": p.get("relation", "Neutral"),
        }
        for p in support
    ]

    out = dict(record)
    out.update(
        {
            "sentence_roles": sentence_roles,
            "concepts_present": coverage.get("covered") or [],
            "support_pairs": support_pairs,
            # Blend silver depth with score-derived depth for stability
            "depth_score": round(
                0.5 * float(result.get("reasoning_depth") or 0.0)
                + 0.5 * ((record["stars"] - 1.0) / 4.0),
                4,
            ),
            # Gold human score mapped to stars (do NOT overwrite with heuristic)
            "stars": record["stars"],
            "stars_continuous": record["stars"],
            "quality_tier": _tier(record["stars"]),
            "silver_model_version": result.get("model_version", "heuristic-v1"),
        }
    )
    return out


def _tier(stars: float) -> str:
    if stars >= 4.5:
        return "excellent"
    if stars >= 3.5:
        return "good"
    if stars >= 2.5:
        return "average"
    if stars >= 1.5:
        return "weak"
    return "poor"


def stratified_split(rows: list[dict], seed: int = 42):
    random.Random(seed).shuffle(rows)
    # Stratify roughly by rounded stars
    buckets: dict[int, list[dict]] = {}
    for r in rows:
        buckets.setdefault(int(round(r["stars"])), []).append(r)

    train, val, test = [], [], []
    for bucket in buckets.values():
        n = len(bucket)
        n_test = max(1, int(0.15 * n))
        n_val = max(1, int(0.15 * n))
        test.extend(bucket[:n_test])
        val.extend(bucket[n_test : n_test + n_val])
        train.extend(bucket[n_test + n_val :])
    return train, val, test


def main() -> None:
    LARGE_RAW.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print("[large] loading ASAP 2.0 ...")
    asap2 = load_asap2()
    print(f"[large] ASAP 2.0 rows: {len(asap2)}")

    print("[large] loading AERA / ASAP-SAS ...")
    aera = load_aera()
    print(f"[large] AERA rows: {len(aera)}")

    combined = asap2 + aera
    print(f"[large] combined before labeling: {len(combined)}")
    if len(combined) < 15000:
        raise SystemExit(
            f"Only {len(combined)} rows — expected ~20k+. "
            "Ensure asap2_train.csv and aera_*.json are present."
        )

    labeled: list[dict] = []
    checkpoint_path = OUT_DIR / "_labeling_checkpoint.jsonl"
    done_ids: set[str] = set()
    if checkpoint_path.exists():
        with checkpoint_path.open(encoding="utf-8") as fh:
            for line in fh:
                try:
                    obj = json.loads(line)
                    labeled.append(obj)
                    done_ids.add(obj["id"])
                except json.JSONDecodeError:
                    continue
        print(f"[large] resumed {len(done_ids)} labeled rows from checkpoint")

    from app.services.rexa_pipeline import RexaPipeline

    pipeline = RexaPipeline()

    total = len(combined)
    with checkpoint_path.open("a", encoding="utf-8") as fh:
        for idx, rec in enumerate(combined):
            if rec["id"] in done_ids:
                continue
            try:
                row = silver_label(rec, pipeline)
                labeled.append(row)
                fh.write(json.dumps(row, ensure_ascii=False) + "\n")
                done_ids.add(rec["id"])
            except Exception as exc:  # noqa: BLE001
                print(f"[large] skip {rec.get('id')}: {exc}")
            if (idx + 1) % 500 == 0:
                print(f"[large] progress {idx + 1}/{total} (labeled={len(done_ids)})")
                fh.flush()

    print(f"[large] labeled rows: {len(labeled)}")
    train, val, test = stratified_split(labeled)

    for name, split in ("train", train), ("val", val), ("test", test):
        path = OUT_DIR / f"{name}.json"
        path.write_text(json.dumps(split, ensure_ascii=False), encoding="utf-8")
        print(f"[large] wrote {path} ({len(split)} rows)")

    if checkpoint_path.exists():
        checkpoint_path.unlink()

    manifest = {
        "total": len(labeled),
        "train": len(train),
        "val": len(val),
        "test": len(test),
        "sources": {
            "asap2": len([r for r in labeled if r["source"] == "asap2"]),
            "aera-asap-sas": len([r for r in labeled if r["source"] == "aera-asap-sas"]),
        },
        "star_min": min(r["stars"] for r in labeled) if labeled else None,
        "star_max": max(r["stars"] for r in labeled) if labeled else None,
        "citations": [
            "Learning Agency Lab ASAP 2.0 / Kaggle AES 2.0 (jatinmehra/Automated-Essay-Scoring-2.0)",
            "ASAP-SAS via AERA (jiazhengli/AERA) — Hewlett Foundation Short Answer Scoring",
        ],
        "labeling": {
            "stars": "gold human scores mapped to 1–5",
            "roles_support_concepts_depth": "silver labels from RExA heuristic pipeline",
        },
    }
    (LARGE_RAW / "corpus_manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    print("[large] manifest:", json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
