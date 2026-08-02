# RExA v2 Core Notebook — Integration Guide

**Canonical research notebook:** [`ml/notebooks/05_rexa_v2_core_pipeline.ipynb`](../ml/notebooks/05_rexa_v2_core_pipeline.ipynb)  
(Source: teammate Colab notebook `REXA_v2_repaired_fixed.ipynb`)

**Project title:** Explainable Reasoning Analysis of Descriptive Answers (**RExA**)

## How the pieces fit together

| Layer | What it is | Role in FYP |
|-------|------------|-------------|
| **Core RExA** (notebook §§11–17, 22–24) | Sentence roles, SBERT coverage, depth→stars, reasoning feedback/graphs | **Proposed system** |
| **Web app** (React + FastAPI) | Live demo of explainable analysis | Product / viva demo |
| **Sklearn modules** (`ml/checkpoints/large/`) | Fast local role/depth/star models for the API | Serving Core RExA signals without Colab |
| **DistilBERT** (notebook Experiment 1 + `04_distilbert_colab.ipynb`) | Supervised score regression on ASAG/AES data | **Comparative experiment only** — not the proposed system |
| **DeBERTa NLI / BART zero-shot** (notebook Experiments 2–3) | Alternative semantic approaches | Comparative experiments |

## Do not remove

- Keep DistilBERT checkpoint and Colab helper notebook for viva comparison tables.
- Keep sklearn large-corpus checkpoints for the running API.
- Keep Evaluation page graphs (before/after + module metrics).

## Running the v2 notebook

1. Open Google Colab → Upload `ml/notebooks/05_rexa_v2_core_pipeline.ipynb`
2. Mount Drive and ensure curated `0star.csv`…`5star.csv` paths match Section 2
3. Runtime → GPU recommended for DistilBERT / DeBERTa cells
4. Run top-to-bottom; Core RExA sections are labelled **Proposed System**

## App alignment

- UI / docs brand: **RExA — Explainable Reasoning Analysis of Descriptive Answers**
- Models page: DistilBERT described as comparative baseline; Core RExA / large ensemble as proposed explainable pipeline
- DistilBERT may still be loaded for scoring demos, but viva narrative treats Core RExA structure analysis as the contribution
