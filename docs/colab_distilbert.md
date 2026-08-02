# DistilBERT + Google Colab — Comparative Experiment for RExA

> **Viva framing:** DistilBERT is a **comparative experiment** (supervised score
> regression). The **proposed system** is Core RExA (sentence roles, coverage,
> reasoning depth, explainable feedback) — see
> [`ml/notebooks/05_rexa_v2_core_pipeline.ipynb`](../ml/notebooks/05_rexa_v2_core_pipeline.ipynb)
> and [`rexa_v2_notebook_integration.md`](rexa_v2_notebook_integration.md).

This guide fine-tunes DistilBERT on public AES/SAS / ASAG-style corpora so you
can compare it against Core RExA in results tables.

## Why DistilBERT + Colab?

| Piece | Role |
|-------|------|
| **DistilBERT** | Comparative scoring baseline (not Core RExA) |
| **Google Colab GPU** | Free T4 GPU for fine-tuning |
| **Laptop / FastAPI** | Optional demo serving of the checkpoint |

Comparison stack for viva:
1. Keyword / TF-IDF baselines  
2. Core RExA (proposed explainable pipeline)  
3. DistilBERT regression (this experiment) |

## Datasets (same as large corpus)

1. **ASAP 2.0 / AES 2.0** — Hugging Face [`jatinmehra/Automated-Essay-Scoring-2.0`](https://huggingface.co/datasets/jatinmehra/Automated-Essay-Scoring-2.0)  
2. **ASAP-SAS via AERA** — Hugging Face [`jiazhengli/AERA`](https://huggingface.co/datasets/jiazhengli/AERA)  

Human scores are mapped to RExA **stars 1–5**.

## Option A — Google Colab (recommended)

1. Open [Google Colab](https://colab.research.google.com/)  
2. Upload notebook: [`ml/notebooks/04_distilbert_colab.ipynb`](../ml/notebooks/04_distilbert_colab.ipynb)  
   - File → Upload notebook  
3. Runtime → Change runtime type → **GPU (T4)** → Save  
4. Runtime → Run all  
5. When training finishes, download `distilbert_stars.zip`  
6. Extract into your project:

```text
earas/ml/checkpoints/distilbert_stars/
  metrics.json
  model/
    config.json
    model.safetensors
    tokenizer.json
    ...
```

7. Restart the API with trained mode:

```env
# backend/.env
MODEL_MODE=trained
```

The backend will use DistilBERT for **star prediction** when
`ml/checkpoints/distilbert_stars/model` exists (version tag: `trained-distilbert-v1`).

### Smoke test in Colab
In the training cell set:

```python
SMOKE = True
```

This trains on a small subset for ~10 minutes to verify the pipeline.

## Option B — Local script (needs torch)

```powershell
cd ml
pip install torch transformers datasets accelerate scikit-learn scipy
python scripts/train_distilbert_stars.py --source auto --epochs 3
```

- `--source hf` — download ASAP datasets from Hugging Face  
- `--source local` — use `data/processed/large/` if already built  
- `--max-train-samples 512 --epochs 1` — quick smoke test  

Outputs:
- `ml/checkpoints/distilbert_stars/model/`  
- `ml/checkpoints/distilbert_stars/metrics.json`  
- `data/baselines/distilbert_results.json`  

## Metrics to put in the thesis

From DistilBERT `metrics.json` → `test`:

| Metric | Meaning |
|--------|---------|
| MAE | Average star error (lower better) |
| RMSE | Penalizes large misses |
| Spearman ρ | Rank correlation with human scores |
| Within-1-star accuracy | Predictions within ±1 star of truth |

Compare against:
- Keyword baseline (`data/baselines/large_results.json`)  
- Sklearn star model (`ml/checkpoints/large/star_prediction/metrics.json`)  

## What DistilBERT does *not* replace

DistilBERT here predicts the **overall star score**.  
RExA’s explainability still comes from:
- Sentence roles  
- Concept coverage  
- Support / contradiction  
- Reasoning depth  
- Natural-language explanations  

So the product story stays: **strong scorer + explainable RExA dimensions**.

## Files added

| Path | Purpose |
|------|---------|
| `ml/notebooks/04_distilbert_colab.ipynb` | Full Colab workflow |
| `ml/scripts/train_distilbert_stars.py` | CLI trainer |
| `ml/src/models/distilbert_stars.py` | Train + inference helpers |
| `docs/colab_distilbert.md` | This guide |
