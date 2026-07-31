"""DistilBERT star / score regressor for RExA.

Designed to run in Google Colab (GPU) or locally when torch + transformers
are installed. Saves a Hugging Face-style directory checkpoint.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np


@dataclass
class DistilBertTrainConfig:
    model_name: str = "distilbert-base-uncased"
    max_length: int = 256
    batch_size: int = 16
    learning_rate: float = 2e-5
    num_epochs: int = 3
    weight_decay: float = 0.01
    warmup_ratio: float = 0.06
    seed: int = 42
    max_train_samples: int | None = None  # optional subsample for smoke tests


def _require_transformers(*, for_training: bool = False):
    try:
        import torch  # noqa: F401
        import transformers  # noqa: F401
        if for_training:
            from datasets import Dataset  # noqa: F401
    except ImportError as exc:
        extras = " datasets accelerate sentencepiece evaluate" if for_training else ""
        raise ImportError(
            f"DistilBERT requires: pip install torch transformers{extras} "
            "(or use the Colab notebook which installs these)."
        ) from exc


class EssayStarsDataset:
    """Simple list wrapper converted to HF Dataset inside the trainer."""

    def __init__(self, texts: list[str], stars: list[float]):
        self.texts = texts
        self.stars = [float(s) for s in stars]

    def __len__(self) -> int:
        return len(self.texts)


def map_aes_score_to_stars(score: float, lo: float, hi: float) -> float:
    if hi <= lo:
        return 3.0
    norm = (float(score) - lo) / (hi - lo)
    return float(np.clip(1.0 + 4.0 * norm, 1.0, 5.0))


def load_asap_corpus_from_hf() -> list[dict[str, Any]]:
    """Download ASAP 2.0 + AERA from Hugging Face and return [{text, stars, source}]."""
    _require_transformers(for_training=True)
    from datasets import load_dataset

    rows: list[dict[str, Any]] = []

    # ASAP 2.0 / AES 2.0
    aes = load_dataset("jatinmehra/Automated-Essay-Scoring-2.0")
    split_name = list(aes.keys())[0]
    for item in aes[split_name]:
        text = (item.get("full_text") or "").strip()
        if len(text) < 40:
            continue
        score = float(item["score"])
        rows.append(
            {
                "text": text[:4000],
                "stars": map_aes_score_to_stars(score, 1, 6),
                "source": "asap2",
            }
        )

    # AERA / ASAP-SAS
    try:
        aera = load_dataset("jiazhengli/AERA", data_files={
            "train": "simple/train.json",
            "val": "simple/val.json",
            "test": "simple/test.json",
        })
        for split in aera:
            for item in aera[split]:
                text = (item.get("EssayText") or "").strip()
                if len(text) < 20:
                    continue
                score = item.get("Score1")
                if score is None:
                    continue
                rows.append(
                    {
                        "text": text[:4000],
                        "stars": map_aes_score_to_stars(float(score), 0, 3),
                        "source": "aera-asap-sas",
                    }
                )
    except Exception as exc:  # noqa: BLE001
        print(f"[distilbert] AERA load skipped: {exc}")

    return rows


def load_asap_corpus_from_local(root: Path) -> list[dict[str, Any]]:
    """Load from data/processed/large if available (offline / already built)."""
    rows: list[dict[str, Any]] = []
    for name in ("train", "val", "test"):
        path = root / f"{name}.json"
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        for item in data:
            text = (item.get("student_answer") or "").strip()
            if len(text) < 20:
                continue
            rows.append(
                {
                    "text": text[:4000],
                    "stars": float(item.get("stars", 3.0)),
                    "source": item.get("source", "local-large"),
                }
            )
    return rows


def stratified_split(
    rows: list[dict[str, Any]], seed: int = 42
) -> tuple[list[dict], list[dict], list[dict]]:
    import random

    rng = random.Random(seed)
    buckets: dict[int, list[dict]] = {}
    for r in rows:
        buckets.setdefault(int(round(r["stars"])), []).append(r)
    train, val, test = [], [], []
    for bucket in buckets.values():
        rng.shuffle(bucket)
        n = len(bucket)
        n_test = max(1, int(0.15 * n))
        n_val = max(1, int(0.10 * n))
        test.extend(bucket[:n_test])
        val.extend(bucket[n_test : n_test + n_val])
        train.extend(bucket[n_test + n_val :])
    rng.shuffle(train)
    rng.shuffle(val)
    rng.shuffle(test)
    return train, val, test


def compute_star_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, Any]:
    from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
    from scipy.stats import spearmanr

    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    y_pred = np.clip(y_pred, 1.0, 5.0)
    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    r2 = float(r2_score(y_true, y_pred)) if len(y_true) > 1 else 0.0
    if len(y_true) >= 2 and np.std(y_true) > 0 and np.std(y_pred) > 0:
        rho, p = spearmanr(y_true, y_pred)
        rho, p = float(rho), float(p)
    else:
        rho, p = 0.0, 1.0
    rounded_t = np.rint(y_true)
    rounded_p = np.rint(y_pred)
    within_one = float(np.mean(np.abs(rounded_t - rounded_p) <= 1))
    exact = float(np.mean(rounded_t == rounded_p))
    return {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "r2": round(r2, 4),
        "spearman_rho": round(rho, 4),
        "spearman_pvalue": round(p, 4),
        "exact_accuracy": round(exact, 4),
        "within_one_star_accuracy": round(within_one, 4),
        "n_samples": int(len(y_true)),
    }


def train_distilbert_stars(
    train_rows: list[dict[str, Any]],
    val_rows: list[dict[str, Any]],
    test_rows: list[dict[str, Any]],
    output_dir: Path,
    cfg: DistilBertTrainConfig | None = None,
) -> dict[str, Any]:
    """Fine-tune DistilBERT for star regression and evaluate on test."""
    _require_transformers(for_training=True)
    import torch
    from datasets import Dataset
    from transformers import (
        AutoModelForSequenceClassification,
        AutoTokenizer,
        DataCollatorWithPadding,
        Trainer,
        TrainingArguments,
        set_seed,
    )

    cfg = cfg or DistilBertTrainConfig()
    set_seed(cfg.seed)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if cfg.max_train_samples and len(train_rows) > cfg.max_train_samples:
        train_rows = train_rows[: cfg.max_train_samples]

    tokenizer = AutoTokenizer.from_pretrained(cfg.model_name)

    def to_hf(rows: list[dict]) -> Dataset:
        return Dataset.from_dict(
            {
                "text": [r["text"] for r in rows],
                "labels": [float(r["stars"]) for r in rows],
            }
        )

    def tokenize(batch):
        return tokenizer(
            batch["text"],
            truncation=True,
            max_length=cfg.max_length,
        )

    train_ds = to_hf(train_rows).map(tokenize, batched=True, remove_columns=["text"])
    val_ds = to_hf(val_rows).map(tokenize, batched=True, remove_columns=["text"])
    test_ds = to_hf(test_rows).map(tokenize, batched=True, remove_columns=["text"])

    model = AutoModelForSequenceClassification.from_pretrained(
        cfg.model_name,
        num_labels=1,
        problem_type="regression",
    )

    use_fp16 = torch.cuda.is_available()
    args = TrainingArguments(
        output_dir=str(output_dir / "runs"),
        learning_rate=cfg.learning_rate,
        per_device_train_batch_size=cfg.batch_size,
        per_device_eval_batch_size=cfg.batch_size,
        num_train_epochs=cfg.num_epochs,
        weight_decay=cfg.weight_decay,
        warmup_ratio=cfg.warmup_ratio,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="mae",
        greater_is_better=False,
        logging_steps=50,
        fp16=use_fp16,
        report_to=[],
        seed=cfg.seed,
    )

    def compute_metrics(eval_pred):
        logits, labels = eval_pred
        preds = np.asarray(logits).reshape(-1)
        labels = np.asarray(labels).reshape(-1)
        m = compute_star_metrics(labels, preds)
        return {"mae": m["mae"], "spearman": m["spearman_rho"], "within_one": m["within_one_star_accuracy"]}

    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        tokenizer=tokenizer,
        data_collator=DataCollatorWithPadding(tokenizer=tokenizer),
        compute_metrics=compute_metrics,
    )

    train_result = trainer.train()
    test_metrics_raw = trainer.predict(test_ds)
    preds = np.asarray(test_metrics_raw.predictions).reshape(-1)
    labels = np.asarray(test_metrics_raw.label_ids).reshape(-1)
    test_metrics = compute_star_metrics(labels, preds)

    # Save final model for serving
    model_dir = output_dir / "model"
    trainer.save_model(str(model_dir))
    tokenizer.save_pretrained(str(model_dir))

    metrics = {
        "model_name": cfg.model_name,
        "train_samples": len(train_rows),
        "val_samples": len(val_rows),
        "test_samples": len(test_rows),
        "device": "cuda" if use_fp16 else "cpu",
        "train_loss": float(train_result.training_loss) if train_result.training_loss is not None else None,
        "test": test_metrics,
        "config": {
            "max_length": cfg.max_length,
            "batch_size": cfg.batch_size,
            "learning_rate": cfg.learning_rate,
            "num_epochs": cfg.num_epochs,
        },
    }
    (output_dir / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    (output_dir / "model_card.md").write_text(
        _model_card_md(metrics),
        encoding="utf-8",
    )
    return metrics


def _model_card_md(metrics: dict[str, Any]) -> str:
    t = metrics.get("test", {})
    return f"""# DistilBERT Star Predictor (RExA)

## Intended use
Predict a 1–5 star quality score for student descriptive / essay answers.

## Base model
`{metrics.get("model_name")}`

## Training data
ASAP 2.0 (AES) + ASAP-SAS via AERA (Hugging Face), scores mapped to RExA stars 1–5.

## Test metrics
- MAE: {t.get("mae")}
- RMSE: {t.get("rmse")}
- Spearman ρ: {t.get("spearman_rho")}
- Within-1-star accuracy: {t.get("within_one_star_accuracy")}
- N: {t.get("n_samples")}

## Device
{metrics.get("device")}
"""


class DistilBertStarPredictor:
    """Inference wrapper used by the FastAPI backend."""

    def __init__(self, model_dir: Path):
        _require_transformers()
        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tokenizer = AutoTokenizer.from_pretrained(str(model_dir))
        self.model = AutoModelForSequenceClassification.from_pretrained(str(model_dir))
        self.model.to(self.device)
        self.model.eval()
        self._torch = torch

    def predict(self, texts: list[str]) -> list[float]:
        import torch

        preds: list[float] = []
        with torch.no_grad():
            for i in range(0, len(texts), 8):
                batch = texts[i : i + 8]
                enc = self.tokenizer(
                    batch,
                    truncation=True,
                    max_length=256,
                    padding=True,
                    return_tensors="pt",
                )
                enc = {k: v.to(self.device) for k, v in enc.items()}
                out = self.model(**enc).logits.view(-1).detach().cpu().numpy()
                for v in out:
                    preds.append(float(np.clip(v, 1.0, 5.0)))
        return preds
