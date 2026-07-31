"""Trainable sklearn model wrappers for the five REXA modules.

Each class wraps a small sklearn pipeline (TF-IDF + linguistic features +
a classifier/regressor) behind a simple ``fit`` / ``predict`` / ``save`` /
``load`` interface so it can eventually be dropped into
``backend/app/services/rexa_pipeline.py`` in place of the heuristic stages,
without the rest of the pipeline needing to change (mirrors the Protocol
interfaces already defined there).

All classes are plain Python objects composed of picklable sklearn
components, so ``joblib.dump`` / ``joblib.load`` works directly on instances.

An optional transformer-backed backend can be plugged in later (see
``--backend transformers`` in the training scripts); these sklearn
implementations are the primary, dependency-light path that always works.
"""
from __future__ import annotations

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LogisticRegression
from sklearn.metrics.pairwise import cosine_similarity

from .feature_extractors import (
    LinguisticFeaturizer,
    TfidfFeaturizer,
    hstack_features,
    structural_answer_features,
    token_overlap_ratio,
)

try:
    import joblib
except ImportError:  # pragma: no cover
    joblib = None


def _require_joblib():
    if joblib is None:
        raise ImportError("joblib is required to save/load REXA model checkpoints. `pip install joblib`.")


# ---------------------------------------------------------------------------
# Module 1: Sentence Roles
# ---------------------------------------------------------------------------


class SklearnRoleClassifier:
    """TF-IDF + linguistic-feature classifier for Claim/Evidence/Explanation/
    Conclusion/Other sentence role labeling.
    """

    ROLES = ("Claim", "Evidence", "Explanation", "Conclusion", "Other")

    def __init__(self, max_features: int = 3000, C: float = 2.0):
        self.tfidf = TfidfFeaturizer(max_features=max_features, ngram_range=(1, 2))
        self.linguistic = LinguisticFeaturizer()
        self.classifier = LogisticRegression(
            max_iter=3000, class_weight="balanced", C=C
        )
        self.classes_: list[str] | None = None

    def _features(self, texts, positions, totals, fit: bool):
        ling = self.linguistic.transform_sentences(texts, positions, totals)
        tfidf_matrix = self.tfidf.fit_transform(texts) if fit else self.tfidf.transform(texts)
        return hstack_features(tfidf_matrix, ling)

    def fit(self, texts: list[str], positions: list[float], totals: list[int], labels: list[str]):
        X = self._features(texts, positions, totals, fit=True)
        self.classifier.fit(X, labels)
        self.classes_ = list(self.classifier.classes_)
        return self

    def predict(self, texts: list[str], positions: list[float], totals: list[int]) -> np.ndarray:
        X = self._features(texts, positions, totals, fit=False)
        return self.classifier.predict(X)

    def predict_proba(self, texts: list[str], positions: list[float], totals: list[int]) -> np.ndarray:
        X = self._features(texts, positions, totals, fit=False)
        return self.classifier.predict_proba(X)

    def save(self, path: str) -> None:
        _require_joblib()
        joblib.dump(self, path)

    @classmethod
    def load(cls, path: str) -> "SklearnRoleClassifier":
        _require_joblib()
        return joblib.load(path)


# ---------------------------------------------------------------------------
# Module 2: Concept Coverage
# ---------------------------------------------------------------------------


class ConceptCoverageModel:
    """Binary classifier predicting whether a given concept is covered by a
    student answer. Trained on (concept, answer_text) -> {0, 1} pairs.
    """

    def __init__(self, max_features: int = 2000, C: float = 1.0):
        self.concept_vectorizer = TfidfFeaturizer(max_features=max_features, ngram_range=(1, 2))
        self.answer_vectorizer = TfidfFeaturizer(max_features=max_features, ngram_range=(1, 2))
        self.classifier = LogisticRegression(max_iter=3000, class_weight="balanced", C=C)

    def _numeric_features(self, concepts: list[str], answers: list[str]) -> np.ndarray:
        overlap = [token_overlap_ratio(c, a) for c, a in zip(concepts, answers)]
        concept_len = [len((c or "").split()) for c in concepts]
        answer_len = [len((a or "").split()) for a in answers]
        return np.array(list(zip(overlap, concept_len, answer_len)), dtype=float)

    def _features(self, concepts: list[str], answers: list[str], fit: bool):
        numeric = self._numeric_features(concepts, answers)
        if fit:
            c_vec = self.concept_vectorizer.fit_transform(concepts)
            a_vec = self.answer_vectorizer.fit_transform(answers)
        else:
            c_vec = self.concept_vectorizer.transform(concepts)
            a_vec = self.answer_vectorizer.transform(answers)
        import scipy.sparse as sp

        return sp.hstack([c_vec, a_vec, sp.csr_matrix(numeric)]).tocsr()

    def fit(self, concepts: list[str], answers: list[str], labels: list[int]):
        X = self._features(concepts, answers, fit=True)
        self.classifier.fit(X, labels)
        return self

    def predict(self, concepts: list[str], answers: list[str]) -> np.ndarray:
        X = self._features(concepts, answers, fit=False)
        return self.classifier.predict(X)

    def predict_proba(self, concepts: list[str], answers: list[str]) -> np.ndarray:
        X = self._features(concepts, answers, fit=False)
        return self.classifier.predict_proba(X)

    def save(self, path: str) -> None:
        _require_joblib()
        joblib.dump(self, path)

    @classmethod
    def load(cls, path: str) -> "ConceptCoverageModel":
        _require_joblib()
        return joblib.load(path)


# ---------------------------------------------------------------------------
# Module 3: Support & Contradiction
# ---------------------------------------------------------------------------


class SupportClassifier:
    """3-class classifier (Supports/Contradicts/Neutral) for a pair of
    (source_sentence, target_sentence).
    """

    LABELS = ("Supports", "Contradicts", "Neutral")

    def __init__(self, max_features: int = 2500):
        self.tfidf = TfidfFeaturizer(max_features=max_features, ngram_range=(1, 2))
        self.linguistic = LinguisticFeaturizer()
        self.classifier = GradientBoostingClassifier(random_state=42)
        self.classes_: list[str] | None = None

    @staticmethod
    def _combine(source_texts: list[str], target_texts: list[str]) -> list[str]:
        return [f"{s} [SEP] {t}" for s, t in zip(source_texts, target_texts)]

    def _features(self, source_texts, target_texts, fit: bool):
        combined = self._combine(source_texts, target_texts)
        ling = self.linguistic.transform_pairs(source_texts, target_texts)
        tfidf_matrix = self.tfidf.fit_transform(combined) if fit else self.tfidf.transform(combined)
        return hstack_features(tfidf_matrix, ling)

    def fit(self, source_texts: list[str], target_texts: list[str], labels: list[str]):
        X = self._features(source_texts, target_texts, fit=True)
        self.classifier.fit(X, labels)
        self.classes_ = list(self.classifier.classes_)
        return self

    def predict(self, source_texts: list[str], target_texts: list[str]) -> np.ndarray:
        X = self._features(source_texts, target_texts, fit=False)
        return self.classifier.predict(X)

    def predict_proba(self, source_texts: list[str], target_texts: list[str]) -> np.ndarray:
        X = self._features(source_texts, target_texts, fit=False)
        return self.classifier.predict_proba(X)

    def save(self, path: str) -> None:
        _require_joblib()
        joblib.dump(self, path)

    @classmethod
    def load(cls, path: str) -> "SupportClassifier":
        _require_joblib()
        return joblib.load(path)


# ---------------------------------------------------------------------------
# Module 4: Reasoning Depth
# ---------------------------------------------------------------------------


class DepthRegressor:
    """Regresses a [0, 1] reasoning-depth score from raw answer text using
    TF-IDF + whole-answer structural features (no ground-truth roles
    required at inference time).
    """

    def __init__(self, max_features: int = 3000, n_estimators: int = 200):
        self.tfidf = TfidfFeaturizer(max_features=max_features, ngram_range=(1, 2))
        self.regressor = RandomForestRegressor(
            n_estimators=n_estimators, max_depth=8, random_state=42
        )

    def _features(self, texts: list[str], fit: bool):
        structural = np.array([structural_answer_features(t) for t in texts], dtype=float)
        tfidf_matrix = self.tfidf.fit_transform(texts) if fit else self.tfidf.transform(texts)
        return hstack_features(tfidf_matrix, structural)

    def fit(self, texts: list[str], scores: list[float]):
        X = self._features(texts, fit=True)
        self.regressor.fit(X, scores)
        return self

    def predict(self, texts: list[str]) -> np.ndarray:
        X = self._features(texts, fit=False)
        preds = self.regressor.predict(X)
        return np.clip(preds, 0.0, 1.0)

    def save(self, path: str) -> None:
        _require_joblib()
        joblib.dump(self, path)

    @classmethod
    def load(cls, path: str) -> "DepthRegressor":
        _require_joblib()
        return joblib.load(path)


# ---------------------------------------------------------------------------
# Module 5: Star Prediction
# ---------------------------------------------------------------------------


class StarRegressor:
    """Regresses a 1-5 star rating from (student_answer, reference_answer)
    using TF-IDF similarity to the reference plus structural features.
    """

    def __init__(self, max_features: int = 3000, n_estimators: int = 250):
        self.tfidf = TfidfFeaturizer(max_features=max_features, ngram_range=(1, 2))
        self.regressor = GradientBoostingRegressor(
            n_estimators=n_estimators,
            max_depth=3,
            learning_rate=0.08,
            subsample=0.8,
            max_features="sqrt",
            random_state=42,
        )
        self._corpus_fitted = False

    def _similarity_features(self, students: list[str], references: list[str], fit: bool) -> np.ndarray:
        if fit:
            self.tfidf.fit(students + references)
            self._corpus_fitted = True
        stu_vec = self.tfidf.transform(students)
        ref_vec = self.tfidf.transform(references)
        sims = np.array(
            [cosine_similarity(stu_vec[i], ref_vec[i])[0][0] for i in range(stu_vec.shape[0])]
        ).reshape(-1, 1)
        return sims, stu_vec

    def _features(self, students: list[str], references: list[str], fit: bool):
        sims, stu_vec = self._similarity_features(students, references, fit)
        structural = np.array([structural_answer_features(t) for t in students], dtype=float)
        overlap = np.array(
            [token_overlap_ratio(s, r) for s, r in zip(students, references)]
        ).reshape(-1, 1)
        numeric = np.hstack([sims, overlap, structural])
        return hstack_features(stu_vec, numeric)

    def fit(self, students: list[str], references: list[str], stars: list[float]):
        X = self._features(students, references, fit=True)
        self.regressor.fit(X, stars)
        return self

    def predict(self, students: list[str], references: list[str]) -> np.ndarray:
        X = self._features(students, references, fit=False)
        preds = self.regressor.predict(X)
        return np.clip(preds, 1.0, 5.0)

    def save(self, path: str) -> None:
        _require_joblib()
        joblib.dump(self, path)

    @classmethod
    def load(cls, path: str) -> "StarRegressor":
        _require_joblib()
        return joblib.load(path)
