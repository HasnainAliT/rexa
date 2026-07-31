# EARAS/REXA Sample Data

This folder contains sample datasets used to train and evaluate the REXA ML
modules (see `../ml/README.md`). The data is **synthetic but realistic**:
hand-authored CS/Software Engineering exam-style questions and answers at
five quality tiers (excellent/good/average/weak/poor), fully annotated with
the labels each REXA module needs. It is meant to make the training
pipeline runnable end-to-end out of the box; swap in real, human-annotated
data before training a production model.

## Layout

```
data/
  raw/
    sample_questions.json   # 10 CS/SE questions with reference answers & concepts
    sample_answers.json     # 50 fully-annotated student answers (5 per question)
  processed/
    train.json               # ~70% split, stratified by question
    val.json                 # ~15% split
    test.json                 # ~15% split
  annotations/
    annotation_guidelines.md # How to label sentence roles, coverage, support, depth, stars
    schema.json               # JSON schema for annotated answer records
  baselines/
    results.json              # Output of ml/scripts/run_baselines.py + evaluate_all.py
```

## Questions

10 questions spanning Object-Oriented Programming, Databases, Networking,
Software Engineering (SDLC), Algorithms, and Data Structures. Each question
has: `id`, `title`, `prompt`, `reference_answer`, `concepts[]`, `course`.

## Answers

50 answers (5 per question), each with:

- `id`, `question_id`, `student_answer`, `reference_answer`, `concepts[]`
- `sentence_roles[]` — `{text, role}` with `role` in
  `Claim/Evidence/Explanation/Conclusion/Other`
- `concepts_present[]` — subset of `concepts` covered by the answer
- `support_pairs[]` — `{i, j, label}` with `label` in
  `Supports/Contradicts/Neutral`, indices into `sentence_roles`
- `depth_score` — reasoning depth in `[0, 1]`
- `stars` — holistic 1-5 rating (`stars_continuous` also provided)
- `quality_tier` — authoring tier (excellent/good/average/weak/poor); kept
  for transparency only, **not** used as a model feature

See `annotations/schema.json` for the full JSON schema and
`annotations/annotation_guidelines.md` for the rubric used to produce these
labels (and to label new real-world data consistently).

## Regenerating processed splits

```bash
cd ml
python scripts/prepare_data.py
```

This reads `data/raw/sample_questions.json` + `data/raw/sample_answers.json`
and writes stratified (by `question_id`) train/val/test splits to
`data/processed/`.

## Baselines

`data/baselines/results.json` is written by `ml/scripts/run_baselines.py`
and `ml/scripts/evaluate_all.py`. It compares trained REXA modules against
simple keyword-overlap and TF-IDF cosine-similarity baselines on the star
prediction task.
