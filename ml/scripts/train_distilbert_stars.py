#!/usr/bin/env python
"""Fine-tune DistilBERT for RExA star prediction (Colab or local GPU/CPU).

Examples:
  # Preferred in Colab / with network: download ASAP corpora from Hugging Face
  python scripts/train_distilbert_stars.py --source hf

  # Use already-built local large corpus
  python scripts/train_distilbert_stars.py --source local

  # Smoke test on a tiny subset
  python scripts/train_distilbert_stars.py --source local --max-train-samples 512 --epochs 1
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.models.distilbert_stars import (  # noqa: E402
    DistilBertTrainConfig,
    load_asap_corpus_from_hf,
    load_asap_corpus_from_local,
    stratified_split,
    train_distilbert_stars,
)

ROOT = Path(__file__).resolve().parents[2]
LOCAL_LARGE = ROOT / "data" / "processed" / "large"
OUT_DIR = ROOT / "ml" / "checkpoints" / "distilbert_stars"
BASELINES = ROOT / "data" / "baselines" / "distilbert_results.json"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source", choices=["hf", "local", "auto"], default="auto")
    p.add_argument("--model-name", default="distilbert-base-uncased")
    p.add_argument("--epochs", type=int, default=3)
    p.add_argument("--batch-size", type=int, default=16)
    p.add_argument("--max-length", type=int, default=256)
    p.add_argument("--lr", type=float, default=2e-5)
    p.add_argument("--max-train-samples", type=int, default=None)
    p.add_argument("--output-dir", default=str(OUT_DIR))
    return p.parse_args()


def main() -> None:
    args = parse_args()
    source = args.source
    rows: list[dict] = []

    if source in ("local", "auto"):
        rows = load_asap_corpus_from_local(LOCAL_LARGE)
        if rows:
            print(f"[distilbert] loaded local large corpus: {len(rows)}")
            source = "local"
        elif source == "local":
            raise SystemExit(f"No local corpus at {LOCAL_LARGE}. Run build_large_corpus.py or use --source hf")

    if source in ("hf", "auto") and not rows:
        print("[distilbert] downloading ASAP corpora from Hugging Face ...")
        rows = load_asap_corpus_from_hf()
        print(f"[distilbert] HF corpus size: {len(rows)}")

    if len(rows) < 100:
        raise SystemExit(f"Corpus too small ({len(rows)}). Check --source.")

    train, val, test = stratified_split(rows)
    print(f"[distilbert] split train={len(train)} val={len(val)} test={len(test)}")

    cfg = DistilBertTrainConfig(
        model_name=args.model_name,
        max_length=args.max_length,
        batch_size=args.batch_size,
        learning_rate=args.lr,
        num_epochs=args.epochs,
        max_train_samples=args.max_train_samples,
    )
    metrics = train_distilbert_stars(train, val, test, Path(args.output_dir), cfg)
    print(json.dumps(metrics, indent=2))

    BASELINES.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "model": "distilbert-base-uncased",
        "task": "rexa_star_prediction",
        "corpus_source": source,
        "metrics": metrics,
        "comparison_note": (
            "Compare MAE / Spearman / within-1-star against "
            "data/baselines/large_results.json (sklearn star model) and keyword baseline."
        ),
    }
    BASELINES.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"[distilbert] wrote {BASELINES}")
    print(f"[distilbert] model saved to {Path(args.output_dir) / 'model'}")


if __name__ == "__main__":
    main()
