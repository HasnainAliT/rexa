# RExA FYP — Objectives, Graphs & Results

## Three project objectives

| # | Objective | How RExA covers it | Key evidence |
|---|-----------|--------------------|--------------|
| 1 | Classify sentences of descriptive answers into different reasoning levels | Sentence Roles model (Claim / Evidence / Explanation / Conclusion / Other) + color-coded Reasoning Engine | Test accuracy **95.9%**, Macro-F1 **0.945** · Fig `03_obj1_…` |
| 2 | Analyze how an answer progresses from basic explanation to deeper reasoning | Reasoning Depth regressor + support/contradiction links between sentences | Depth MAE **0.072**, Spearman **0.84** · Fig `04_obj2_…` |
| 3 | Present explainable visual output to show reasoning patterns | Reasoning Engine UI: role colors, concept chips, depth meter, star dimensions, NL explanations | Live UI + Fig `08_obj3_…`; star within-1 **83%** |

## Graphs generated

Run:

```powershell
.\backend\.venv\Scripts\python.exe ml\scripts\generate_fyp_figures.py
```

Outputs:

- `docs/figures/` — for thesis / slides
- `public/evaluation/figures/` + `public/evaluation/metrics.json` — for the in-app **Evaluation** page (`/app/evaluation`)

| File | Content |
|------|---------|
| `01_dataset_preprocessing.png` | ASAP 2.0 + ASAP-SAS sizes; train/val/test pie |
| `02_preprocessing_pipeline.png` | Clean → stars → silver labels → split → train |
| `03_obj1_sentence_roles_metrics.png` | Precision / Recall / F1 per role |
| `04_obj2_reasoning_depth.png` | Depth bands + depth model metrics |
| `05_before_after_star_results.png` | Keyword baseline vs trained RExA |
| `06_module_metrics_overview.png` | All modules at a glance |
| `07_training_curves_mae.png` | MAE vs training-set size |
| `08_obj3_explainable_visuals.png` | Explainable UI schematic |

## Before vs after (star scoring, test set)

| Metric | Before (keyword) | After (RExA) |
|--------|------------------|--------------|
| MAE | 1.39 | **0.60** |
| RMSE | 1.71 | **0.77** |
| Within-1-star | 40% | **83%** |
| Spearman ρ | −0.24 | **0.74** |

## Viva caveats

1. **Support/contradiction 100%** is against silver labels from the heuristic teacher, not independent human labels.
2. **Exact star accuracy ~0** is expected for continuous regression-style scoring; prefer MAE / within-1 / Spearman.
3. **Training-curve figure** is a learning-curve style plot vs data size (consistent with final MAE ≈ 0.60). DistilBERT epoch logs live in Colab until the checkpoint zip is installed.
