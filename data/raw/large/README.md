# Large-scale RExA Training Corpus

This folder holds the **public AES/SAS corpora** used for FYP-scale training
(≈20k–30k student responses).

## Sources

| Source | Origin | Samples | Gold label |
|--------|--------|---------|------------|
| **ASAP 2.0** | Hugging Face `jatinmehra/Automated-Essay-Scoring-2.0` (Learning Agency Lab / Kaggle AES 2.0) | ~17,307 | Human essay score 1–6 |
| **AERA / ASAP-SAS** | Hugging Face `jiazhengli/AERA` (Hewlett Foundation Short Answer Scoring) | ~8,722 | Human short-answer Score1 (typically 0–3) |
| **Combined** | Merged + cleaned | **≈26,000** | Mapped to RExA stars 1–5 |

### Why these datasets?
They are the standard public benchmarks for **automated essay / short-answer scoring**,
directly related to RExA’s problem (evaluate descriptive student answers with a score).
ASAP / AES 2.0 are widely cited in AES research and are large enough for a Final Year Project.

## Labeling strategy

| Signal | Type | Notes |
|--------|------|-------|
| Stars (1–5) | **Gold** | Linear map from human ASAP/AES scores |
| Sentence roles, support, concepts, depth | **Silver** | Produced by RExA heuristic pipeline (semi-supervised) |

Public AES datasets do **not** ship Claim/Evidence/Contradiction labels. Using silver
labels for structural modules + gold scores for star prediction is the honest FYP approach.

## Files

- `asap2_train.csv` — AES 2.0 essays
- `aera_{train,val,test}.json` — ASAP-SAS via AERA
- `corpus_manifest.json` — counts + citations (written by build script)

Processed splits live in `../../processed/large/`.

## Rebuild / train

```powershell
cd ml
python scripts/build_large_corpus.py
python scripts/train_large_corpus.py
```

Metrics are written to `../../baselines/large_results.json` and
`../../ml/checkpoints/large/*/metrics.json`.
