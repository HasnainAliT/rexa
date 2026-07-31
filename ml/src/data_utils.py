"""Data loading + dataset-building helpers shared by all training scripts.

Resolves paths relative to the repository layout:

    earas/
      data/{raw,processed,annotations,baselines}/
      ml/{src,scripts,configs,checkpoints,model_cards}/
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ML_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = ML_DIR.parent
DATA_DIR = ROOT_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
ANNOTATIONS_DIR = DATA_DIR / "annotations"
BASELINES_DIR = DATA_DIR / "baselines"
CHECKPOINTS_DIR = ML_DIR / "checkpoints"
CONFIGS_DIR = ML_DIR / "configs"


def load_json(path: str | Path) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(obj: Any, path: str | Path) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)


def load_questions() -> list[dict]:
    return load_json(RAW_DIR / "sample_questions.json")


def load_raw_answers() -> list[dict]:
    return load_json(RAW_DIR / "sample_answers.json")


def load_split(name: str) -> list[dict]:
    """Load one of the processed train/val/test splits.

    ``name`` should be one of "train", "val", "test".
    """
    path = PROCESSED_DIR / f"{name}.json"
    if not path.exists():
        raise FileNotFoundError(
            f"Processed split '{name}' not found at {path}. "
            "Run `python scripts/prepare_data.py` first."
        )
    return load_json(path)


def load_all_splits() -> dict[str, list[dict]]:
    return {name: load_split(name) for name in ("train", "val", "test")}


# ---------------------------------------------------------------------------
# Per-module dataset builders
# ---------------------------------------------------------------------------


def build_role_dataset(answers: list[dict]) -> tuple[list[str], list[float], list[int], list[str]]:
    """Flattens answers into (sentence_text, position_ratio, total_sentences,
    role_label) tuples for Module 1 (Sentence Roles).
    """
    texts: list[str] = []
    positions: list[float] = []
    totals: list[int] = []
    labels: list[str] = []
    for answer in answers:
        roles = answer.get("sentence_roles", [])
        total = len(roles)
        if total == 0:
            continue
        for idx, sr in enumerate(roles):
            texts.append(sr["text"])
            positions.append(idx / max(total - 1, 1))
            totals.append(total)
            labels.append(sr["role"])
    return texts, positions, totals, labels


def build_concept_dataset(answers: list[dict]) -> tuple[list[str], list[str], list[int]]:
    """Builds (concept, answer_text) -> {0,1} pairs for Module 2 (Concept
    Coverage). Every concept in the question's full concept list becomes one
    training example per answer.
    """
    concepts_list: list[str] = []
    answers_list: list[str] = []
    labels: list[int] = []
    for answer in answers:
        concepts = answer.get("concepts", [])
        present = set(answer.get("concepts_present", []))
        student_answer = answer.get("student_answer", "")
        for concept in concepts:
            concepts_list.append(concept)
            answers_list.append(student_answer)
            labels.append(1 if concept in present else 0)
    return concepts_list, answers_list, labels


def build_support_dataset(answers: list[dict]) -> tuple[list[str], list[str], list[str]]:
    """Builds (source_sentence, target_sentence) -> label triples for
    Module 3 (Support & Contradiction), using ``support_pairs`` indices into
    ``sentence_roles``.
    """
    sources: list[str] = []
    targets: list[str] = []
    labels: list[str] = []
    for answer in answers:
        roles = answer.get("sentence_roles", [])
        for pair in answer.get("support_pairs", []):
            i, j = pair["i"], pair["j"]
            if i < 0 or j < 0 or i >= len(roles) or j >= len(roles):
                continue
            sources.append(roles[i]["text"])
            targets.append(roles[j]["text"])
            labels.append(pair["label"])
    return sources, targets, labels


def build_depth_dataset(answers: list[dict]) -> tuple[list[str], list[float]]:
    """Builds (answer_text -> depth_score) pairs for Module 4 (Reasoning
    Depth).
    """
    texts = [a.get("student_answer", "") for a in answers]
    scores = [float(a.get("depth_score", 0.0)) for a in answers]
    return texts, scores


def build_star_dataset(answers: list[dict]) -> tuple[list[str], list[str], list[float]]:
    """Builds (student_answer, reference_answer) -> stars triples for
    Module 5 (Star Prediction). Uses ``stars_continuous`` when available for
    a smoother regression target, falling back to the integer ``stars``.
    """
    students = [a.get("student_answer", "") for a in answers]
    references = [a.get("reference_answer", "") for a in answers]
    stars = [float(a.get("stars_continuous", a.get("stars", 0))) for a in answers]
    return students, references, stars
