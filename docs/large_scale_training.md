# Large-scale Evaluation Results (FYP)

**Corpus size:** 25,728 student responses  
**Train / Val / Test:** 18,014 / 3,857 / 3,857  

## Datasets used

| Dataset | Source | Count | Task |
|---------|--------|------:|------|
| ASAP 2.0 (AES 2.0) | Hugging Face `jatinmehra/Automated-Essay-Scoring-2.0` (Learning Agency Lab / Kaggle) | 17,307 | Argumentative essay scoring (human score 1–6 → RExA stars 1–5) |
| ASAP-SAS via AERA | Hugging Face `jiazhengli/AERA` (Hewlett Foundation Short Answer Scoring) | 8,421 | Science/biology short answers (Score1 → stars 1–5) |

These are standard public benchmarks for automated scoring of **descriptive / free-text student answers**, which is exactly RExA’s problem setting.

## Labeling

- **Stars:** gold human scores (mapped to 1–5)
- **Roles / support / concepts / depth:** silver labels from the RExA heuristic pipeline (public AES corpora do not include those structural labels)

## Test-set metrics (large corpus)

| Module | Key metrics |
|--------|-------------|
| Sentence Roles | Accuracy **0.959**, Macro-F1 **0.945** (46k test sentences) |
| Concept Coverage | Accuracy **0.857**, Macro-F1 **0.685** |
| Support & Contradiction | Accuracy **1.00*** (silver labels are highly regular — interpret cautiously) |
| Reasoning Depth | MAE **0.072**, Spearman ρ **0.841** |
| Star Prediction (RExA) | MAE **0.603**, Spearman ρ **0.743**, within-1-star **83.3%** |
| Keyword baseline (stars) | MAE **1.386**, within-1-star **40.4%** |

\*Support accuracy is inflated because silver labels come from a deterministic cue-based teacher; report this limitation in the thesis.

## How to reproduce

```powershell
# Data already under data/raw/large/ (or re-download — see data/raw/large/README.md)
cd ml
python scripts/build_large_corpus.py
python scripts/train_large_corpus.py
# or if only stars need retrain:
python scripts/train_large_stars_only.py
```

Artifacts: `ml/checkpoints/large/*/metrics.json` and `data/baselines/large_results.json`.

## Serving in the API

Set `MODEL_MODE=trained` in `backend/.env`. The API prefers checkpoints under `ml/checkpoints/large/` when present (`trained-large-aes-v1`).
