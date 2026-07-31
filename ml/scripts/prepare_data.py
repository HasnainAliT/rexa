#!/usr/bin/env python
"""Rebuild train/val/test splits in data/processed/ from data/raw/ (+ any
review edits made under data/annotations/).

Usage:
    cd ml
    python scripts/prepare_data.py [--seed 42] [--train-per-question 3] [--val-per-question 1]

Splitting is stratified by question_id so every question is represented in
every split even with a small sample dataset.
"""
from __future__ import annotations

import argparse
import random
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.data_utils import PROCESSED_DIR, load_questions, load_raw_answers, save_json  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--train-per-question",
        type=int,
        default=3,
        help="Number of answers per question routed to the train split.",
    )
    parser.add_argument(
        "--val-per-question",
        type=int,
        default=1,
        help="Number of answers per question routed to the val split (remainder goes to test).",
    )
    return parser.parse_args()


def stratified_split(
    answers: list[dict], seed: int, train_n: int, val_n: int
) -> tuple[list[dict], list[dict], list[dict]]:
    by_question: dict[str, list[dict]] = defaultdict(list)
    for a in answers:
        by_question[a["question_id"]].append(a)

    rng = random.Random(seed)
    train, val, test = [], [], []
    for qid in sorted(by_question):
        items = list(by_question[qid])
        rng.shuffle(items)
        train.extend(items[:train_n])
        val.extend(items[train_n : train_n + val_n])
        test.extend(items[train_n + val_n :])
    return train, val, test


def main() -> None:
    args = parse_args()

    questions = load_questions()
    answers = load_raw_answers()

    question_ids = {q["id"] for q in questions}
    missing = [a["id"] for a in answers if a["question_id"] not in question_ids]
    if missing:
        print(f"WARNING: {len(missing)} answers reference unknown question_ids: {missing[:5]}...")

    train, val, test = stratified_split(
        answers, seed=args.seed, train_n=args.train_per_question, val_n=args.val_per_question
    )

    save_json(train, PROCESSED_DIR / "train.json")
    save_json(val, PROCESSED_DIR / "val.json")
    save_json(test, PROCESSED_DIR / "test.json")

    print(f"Loaded {len(questions)} questions and {len(answers)} raw answers.")
    print(f"Wrote splits -> train: {len(train)}, val: {len(val)}, test: {len(test)}")
    print(f"Output dir: {PROCESSED_DIR}")

    for name, split in (("train", train), ("val", val), ("test", test)):
        star_counts: dict[int, int] = defaultdict(int)
        for a in split:
            star_counts[int(a.get("stars", 0))] += 1
        print(f"  {name} star distribution: {dict(sorted(star_counts.items()))}")


if __name__ == "__main__":
    main()
