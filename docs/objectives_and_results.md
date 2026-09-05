# RExA FYP — Objectives, Graphs & Results

**Title:** Explainable Reasoning Analysis of Descriptive Answers  
**Research notebook:** [`ml/notebooks/05_rexa_v2_core_pipeline.ipynb`](../ml/notebooks/05_rexa_v2_core_pipeline.ipynb)  
**Integration notes:** [`rexa_v2_notebook_integration.md`](rexa_v2_notebook_integration.md)

> **Proposed system** = Core RExA (roles / coverage / depth / explainable UI).  
> **Comparative experiment** = DistilBERT score regression (do not present as the main contribution).

## Three project objectives

| # | Objective | How RExA covers it | Key evidence |
|---|-----------|--------------------|--------------|
| 1 | To classify sentences in descriptive answers into predefined reasoning roles using Natural Language Processing | Sentence Roles model (Claim / Evidence / Explanation / Conclusion / Other) + color-coded Reasoning Engine | Test accuracy **95.9%**, Macro-F1 **0.945** · Fig `03_obj1_…` |
| 2 | To analyze reasoning depth based on the distribution and progression of reasoning roles within an answer | Reasoning Depth regressor + support/contradiction links between sentences | Depth MAE **0.072**, Spearman **0.84** · Fig `04_obj2_…` |
| 3 | To present explainable visual representations that assist educators in understanding answer quality | Reasoning Engine UI: role colors, concept chips, depth meter, star dimensions, NL explanations | Live UI + Fig `08_obj3_…` — **built and demonstrated; the "assist educators" claim is not yet validated** (see note below) |

> **Objective wording.** The three objectives above are quoted verbatim from the approved
> FYP proposal (§G, Aim & Objectives). Do not paraphrase them in slides or the thesis —
> an earlier version of this table shortened Objective 3 to "show reasoning patterns,"
> which drops the "assist educators in understanding answer quality" claim the proposal
> actually makes.
>
> **Objective 3 status — read before presenting.** The visual representations are built
> and demonstrable, so the "present explainable visual representations" half is met. The
> "assist educators" half has **no supporting evidence**: no educator has used the
> interface under measurement. Note that `docs/annotation_protocol.md` §6 instructs
> annotators to rate answers *without looking at REXA's output*, so the n=60 pilot in
> `docs/evaluation_report.md` cannot be cited as evidence here either — and both of its
> annotators were project authors. Closing this needs a small educator study (4–6 markers,
> with and without the RExA view). Until then, report Objective 3 as implemented and
> demonstrated, not as validated. Star within-1 accuracy is **not** evidence for this
> objective and has been removed from its evidence column.

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
