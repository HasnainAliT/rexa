# EARAS/REXA — ML Training Pipeline

Trainable counterparts to the five REXA modules that currently run as a
heuristic pipeline in `backend/app/services/rexa_pipeline.py`:

1. **Sentence Roles** — Claim / Evidence / Explanation / Conclusion / Other
2. **Concept Coverage** — is a required concept present in the answer?
3. **Support & Contradiction** — relation between adjacent sentences
4. **Reasoning Depth** — continuous `[0, 1]` reasoning-chain completeness score
5. **Star Prediction** — holistic 1-5 star rating

Every module trains a **scikit-learn model as the primary path** (TF-IDF +
linguistic features + LogisticRegression / GradientBoosting / RandomForest),
so the full pipeline runs on any machine with no GPU and no `torch`
dependency. Each `train_*.py` script also accepts `--backend transformers`
as a documented extension point once `torch`/`transformers` and enough
labeled data are available (see [Optional transformer backend](#optional-transformer-backend)).

## Directory layout

```
ml/
  README.md
  requirements.txt
  configs/                      # One YAML per module (hyperparams, paths, labels)
  scripts/
    prepare_data.py             # Rebuild data/processed/{train,val,test}.json
    train_sentence_roles.py
    train_concept_coverage.py
    train_support_contradiction.py
    train_reasoning_depth.py
    train_star_prediction.py
    evaluate_all.py             # Evaluate all 5 checkpoints on the test split
    export_model_card.py        # Regenerate model_cards/*.md from metrics.json
    run_baselines.py            # Keyword-overlap / TF-IDF baselines vs. star labels
  notebooks/
    01_eda.ipynb                # Dataset exploration
    02_sentence_roles.ipynb     # Interactive training walkthrough
    03_evaluation.ipynb         # Trained model vs. baseline comparison
  src/
    data_utils.py                # Path resolution + per-module dataset builders
    metrics.py                    # classification / regression / ordinal metrics
    models/
      classifiers.py              # SklearnRoleClassifier, ConceptCoverageModel,
                                   # SupportClassifier, DepthRegressor, StarRegressor
      feature_extractors.py       # TF-IDF + linguistic feature helpers
  checkpoints/                  # Trained model artifacts + metrics.json (gitignored contents)
  model_cards/                  # One markdown card per module + the heuristic baseline
```

Sample pilot data lives in `../data/` (see `../data/README.md`).

## Large-scale FYP corpus (~25.7k)

Public AES/SAS datasets (recommended for the Final Year Project):

| Source | Hugging Face ID | Rows |
|--------|-----------------|----:|
| ASAP 2.0 / AES 2.0 | `jatinmehra/Automated-Essay-Scoring-2.0` | 17,307 |
| ASAP-SAS via AERA | `jiazhengli/AERA` | 8,421 |
| **Combined** | built by `scripts/build_large_corpus.py` | **25,728** |

```powershell
# Assumes CSVs/JSON already in data/raw/large/ (see that folder's README)
python scripts/build_large_corpus.py
python scripts/train_large_corpus.py
```

Results: `../data/baselines/large_results.json` and `docs/large_scale_training.md`.

## DistilBERT (Google Colab)

Modern transformer star scorer on the same ASAP corpora:

- Notebook: [`notebooks/04_distilbert_colab.ipynb`](notebooks/04_distilbert_colab.ipynb)
- Script: `python scripts/train_distilbert_stars.py --source hf`
- Guide: [`../docs/colab_distilbert.md`](../docs/colab_distilbert.md)

After Colab training, unzip into `checkpoints/distilbert_stars/` and set
`MODEL_MODE=trained` in the API.

## Quickstart

```bash
cd ml
pip install -r requirements.txt   # or reuse backend/.venv, see below

python scripts/prepare_data.py
python scripts/train_sentence_roles.py
python scripts/train_concept_coverage.py
python scripts/train_support_contradiction.py
python scripts/train_reasoning_depth.py
python scripts/train_star_prediction.py
python scripts/evaluate_all.py
python scripts/run_baselines.py
python scripts/export_model_card.py --module all
```

Each `train_*.py` script:

1. Loads `../data/processed/{train,val,test}.json`
2. Trains a model (sklearn pipeline described in `src/models/classifiers.py`)
3. Prints a classification report / MAE / Spearman correlation as appropriate
4. Saves the model to `ml/checkpoints/{module_name}/model.joblib`
5. Writes `ml/checkpoints/{module_name}/metrics.json`

### Reusing the backend virtualenv

The FastAPI backend already ships `scikit-learn`/`numpy` in
`backend/.venv`. To avoid a second environment, install the remaining
lightweight deps into it and point Python there:

```powershell
& backend\.venv\Scripts\python.exe -m pip install pandas pyyaml joblib matplotlib seaborn
& backend\.venv\Scripts\python.exe ml\scripts\prepare_data.py
```

(All commands below assume you've `cd ml`'d first and are invoking whichever
Python has the requirements installed.)

## Module details

| Module | Script | Model | Target |
|---|---|---|---|
| Sentence Roles | `train_sentence_roles.py` | TF-IDF + linguistic feats → `LogisticRegression` | 5-class label |
| Concept Coverage | `train_concept_coverage.py` | TF-IDF(concept) + TF-IDF(answer) + overlap feat → `LogisticRegression` | binary label |
| Support & Contradiction | `train_support_contradiction.py` | TF-IDF(pair) + linguistic feats → `GradientBoostingClassifier` | 3-class label |
| Reasoning Depth | `train_reasoning_depth.py` | TF-IDF + structural feats → `RandomForestRegressor` | float in `[0, 1]` |
| Star Prediction | `train_star_prediction.py` | TF-IDF + reference-similarity + structural feats → `GradientBoostingRegressor` | float in `[1, 5]` |

All feature extraction lives in `src/models/feature_extractors.py` and all
model classes in `src/models/classifiers.py`; both are plain
sklearn-composition classes, so instances are directly `joblib`-serializable.

## Evaluation & baselines

- `scripts/run_baselines.py` computes **Keyword Overlap** and **TF-IDF
  Cosine Similarity** baselines (mirroring
  `backend/app/services/baselines.py`) against the star labels over the
  *full* sample dataset, and appends the results to
  `../data/baselines/results.json` under `baselines_comparison`.
- `scripts/evaluate_all.py` loads every trained checkpoint, evaluates it on
  the held-out test split, and additionally compares the star-prediction
  model directly against both baselines on the same test examples
  (`star_prediction_vs_baselines` key). This is the most apples-to-apples
  comparison of "trained model vs. simple baseline vs. heuristic pipeline".

On the bundled sample dataset, the trained `StarRegressor` outperforms both
classical baselines by a wide margin (test MAE ≈ 0.38 stars vs. ≈ 0.65-1.1
stars for the baselines) — see `../data/baselines/results.json` after
running the scripts above for exact numbers.

## Model cards

See `model_cards/`:
- `heuristic-v1.md` — the current production rule-based pipeline
- `sentence-roles-v1.md`, `concept-coverage-v1.md`,
  `support-contradiction-v1.md`, `reasoning-depth-v1.md`,
  `star-prediction-v1.md` — auto-generated from each module's
  `metrics.json` via `scripts/export_model_card.py`

## Optional transformer backend

Every `train_*.py` script accepts `--backend transformers`. If
`torch`/`transformers` are not installed, or the fine-tuning loop hasn't
been implemented yet for that module, the script prints a message and
falls back to the sklearn backend automatically — nothing crashes. To
enable it for real: install the optional dependencies

```bash
pip install torch transformers datasets
```

and implement a `Trainer`-based fine-tuning loop where the script currently
prints the fallback message (search for `try_transformers_backend` /
`transformers backend requested but not yet implemented`).

## Integrating back into the backend

`backend/app/services/rexa_pipeline.py` already defines Protocol interfaces
(`RoleClassifierProtocol`, `ConceptMatcherProtocol`,
`SupportAnalyzerProtocol`) specifically so a trained-model-backed stage can
be swapped in for a heuristic one without touching `RexaPipeline` itself.
Once a checkpoint's metrics justify promotion:

1. Load the `.joblib` checkpoint in a new stage class implementing the
   matching protocol.
2. Wire it into `get_pipeline()` when `settings.MODEL_MODE == "trained"`.
3. Keep the heuristic pipeline as the default/fallback until confidence is
   established on real (not synthetic) data.
