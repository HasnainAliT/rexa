#!/usr/bin/env python
"""Train only star prediction on the large corpus + write consolidated metrics."""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.train_large_corpus import (  # noqa: E402
    BASELINES_OUT,
    OUT_ROOT,
    load_split,
    train_stars,
)

def main() -> None:
    train = load_split("train")
    val = load_split("val")
    test = load_split("test")
    print(f"train={len(train)} val={len(val)} test={len(test)}")

    star = train_stars(train, val, test)

    # Merge with existing module metrics if present
    modules = {"star_prediction": star}
    for name in (
        "sentence_roles",
        "concept_coverage",
        "support_contradiction",
        "reasoning_depth",
    ):
        metrics_path = OUT_ROOT / name / "metrics.json"
        if metrics_path.exists():
            modules[name] = json.loads(metrics_path.read_text(encoding="utf-8"))

    report = {
        "corpus": {
            "train": len(train),
            "val": len(val),
            "test": len(test),
            "total": len(train) + len(val) + len(test),
            "sources": ["asap2 (HF/Kaggle AES 2.0)", "aera-asap-sas (HF AERA)"],
        },
        "modules": modules,
    }
    BASELINES_OUT.parent.mkdir(parents=True, exist_ok=True)
    BASELINES_OUT.write_text(json.dumps(report, indent=2, default=float), encoding="utf-8")
    print(f"wrote {BASELINES_OUT}")


if __name__ == "__main__":
    main()
