"""Feature extraction utilities shared across the REXA trainable modules.

Two families of features are provided:

1. TF-IDF text features (via ``sklearn.feature_extraction.text.TfidfVectorizer``),
   used as the primary signal for every module.
2. Lightweight linguistic/structural features (sentence length, discourse
   marker counts, position-in-answer, etc.) that mirror the cues the
   heuristic pipeline (``backend/app/services/rexa_pipeline.py``) already
   uses, so a trained model can learn to reproduce - and eventually exceed -
   the heuristic's behavior.

Everything here is plain numpy/scipy/sklearn so model objects that use these
extractors remain pickle-serializable with ``joblib``.
"""
from __future__ import annotations

import re

import numpy as np
import scipy.sparse as sp
from sklearn.feature_extraction.text import TfidfVectorizer

CLAIM_MARKERS = (
    "i believe", "i think", "it is clear", "it is evident", "claim", "argue",
    "propose", "suggests that", "is that", "should", "must", "the main idea",
)
EVIDENCE_MARKERS = (
    "for example", "for instance", "such as", "according to", "study", "data",
    "research", "shows that", "demonstrates", "evidence", "experiment",
    "statistics", "e.g.", "case", "observed",
)
EXPLANATION_MARKERS = (
    "because", "since", "this means", "this is due to", "as a result",
    "which explains", "the reason", "due to the fact", "in other words",
    "this implies", "this happens because", "therefore",
)
CONCLUSION_MARKERS = (
    "in conclusion", "to conclude", "overall", "in summary", "to summarize",
    "thus,", "hence,", "finally,", "in short", "ultimately", "to sum up",
)
SUPPORT_MARKERS = (
    "because", "therefore", "thus", "since", "as a result", "consequently",
    "this shows", "which supports", "hence", "so that", "this confirms",
    "in support of", "further supports",
)
CONTRADICTION_MARKERS = (
    "however", "but", "although", "though", "on the other hand", "whereas",
    "in contrast", "conversely", "despite", "nevertheless", "yet,",
    "contrary to", "not ", "no ", "never", "fails to", "lacks",
)

STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "and", "or", "but", "if", "then", "of", "to", "in", "on", "for", "with",
    "as", "by", "at", "it", "this", "that", "these", "those", "which",
    "its", "their", "his", "her", "they", "them", "he", "she", "we", "you",
    "i", "your", "our", "so", "than", "too", "also", "can", "could", "would",
    "should", "will", "shall", "do", "does", "did", "not", "from", "into",
    "about", "such", "very", "has", "have", "had", "there", "when", "how",
}

SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9])|\n+")


def tokenize(text: str) -> set[str]:
    tokens = re.findall(r"[a-zA-Z]+", (text or "").lower())
    return {t for t in tokens if t not in STOPWORDS and len(t) > 1}


def split_sentences(text: str) -> list[str]:
    text = (text or "").strip()
    if not text:
        return []
    parts = [p.strip() for p in SENTENCE_SPLIT_RE.split(text) if p.strip()]
    return parts


def token_overlap_ratio(a: str, b: str) -> float:
    """Jaccard-ish overlap ratio between the token sets of two strings."""
    tokens_a = tokenize(a)
    tokens_b = tokenize(b)
    if not tokens_a or not tokens_b:
        return 0.0
    return len(tokens_a & tokens_b) / len(tokens_a | tokens_b)


def _count_markers(lowered: str, markers: tuple[str, ...]) -> int:
    return sum(1 for m in markers if m in lowered)


def sentence_linguistic_features(text: str, position_ratio: float, total_sentences: int) -> list[float]:
    """Per-sentence structural features used by the role classifier.

    Returns a fixed-length numeric feature vector:
    [num_words, num_chars, avg_word_len, position_ratio, total_sentences,
     claim_markers, evidence_markers, explanation_markers, conclusion_markers,
     has_comma, ends_with_question, num_commas]
    """
    text = text or ""
    lowered = text.lower()
    words = text.split()
    num_words = len(words)
    num_chars = len(text)
    avg_word_len = (sum(len(w) for w in words) / num_words) if num_words else 0.0

    return [
        float(num_words),
        float(num_chars),
        float(avg_word_len),
        float(position_ratio),
        float(total_sentences),
        float(_count_markers(lowered, CLAIM_MARKERS)),
        float(_count_markers(lowered, EVIDENCE_MARKERS)),
        float(_count_markers(lowered, EXPLANATION_MARKERS)),
        float(_count_markers(lowered, CONCLUSION_MARKERS)),
        float(lowered.count(",")),
        1.0 if lowered.strip().endswith("?") else 0.0,
        float(lowered.count(",")),
    ]


def pair_linguistic_features(source_text: str, target_text: str) -> list[float]:
    """Features describing the relation between two adjacent sentences, used
    by the support/contradiction classifier.
    """
    lowered_target = f" {(target_text or '').lower()} "
    lowered_source = (source_text or "").lower()

    return [
        float(_count_markers(lowered_target, SUPPORT_MARKERS)),
        float(_count_markers(lowered_target, CONTRADICTION_MARKERS)),
        float(len((target_text or "").split())),
        float(len((source_text or "").split())),
        token_overlap_ratio(source_text, target_text),
    ]


def structural_answer_features(text: str) -> list[float]:
    """Whole-answer structural features used by depth/star regressors.

    Does not require ground-truth sentence roles, so it can run purely off
    raw text at inference time.
    """
    sentences = split_sentences(text)
    n = len(sentences)
    lowered_full = (text or "").lower()

    claim_hits = sum(_count_markers(s.lower(), CLAIM_MARKERS) > 0 for s in sentences)
    evidence_hits = sum(_count_markers(s.lower(), EVIDENCE_MARKERS) > 0 for s in sentences)
    explanation_hits = sum(_count_markers(s.lower(), EXPLANATION_MARKERS) > 0 for s in sentences)
    conclusion_hits = sum(_count_markers(s.lower(), CONCLUSION_MARKERS) > 0 for s in sentences)

    support_hits = 0
    contradiction_hits = 0
    for i in range(n - 1):
        lowered_next = f" {sentences[i + 1].lower()} "
        if _count_markers(lowered_next, CONTRADICTION_MARKERS) > 0:
            contradiction_hits += 1
        elif _count_markers(lowered_next, SUPPORT_MARKERS) > 0:
            support_hits += 1

    num_words = len((text or "").split())
    distinct_role_signals = sum(
        1 for h in (claim_hits, evidence_hits, explanation_hits, conclusion_hits) if h > 0
    )

    return [
        float(n),
        float(num_words),
        (num_words / n) if n else 0.0,
        float(claim_hits),
        float(evidence_hits),
        float(explanation_hits),
        float(conclusion_hits),
        float(distinct_role_signals) / 4.0,
        (support_hits / (n - 1)) if n > 1 else 0.0,
        (contradiction_hits / (n - 1)) if n > 1 else 0.0,
        min(n / 5.0, 1.0),
    ]


class TfidfFeaturizer:
    """Thin, picklable wrapper around ``TfidfVectorizer`` with sensible
    defaults for short student-answer text.
    """

    def __init__(self, max_features: int = 4000, ngram_range: tuple[int, int] = (1, 2)):
        self.vectorizer = TfidfVectorizer(
            max_features=max_features,
            ngram_range=ngram_range,
            sublinear_tf=True,
            min_df=1,
            stop_words="english",
        )
        self._fitted = False

    def fit(self, texts: list[str]) -> "TfidfFeaturizer":
        self.vectorizer.fit(texts)
        self._fitted = True
        return self

    def fit_transform(self, texts: list[str]):
        self._fitted = True
        return self.vectorizer.fit_transform(texts)

    def transform(self, texts: list[str]):
        if not self._fitted:
            raise RuntimeError("TfidfFeaturizer must be fit before calling transform().")
        return self.vectorizer.transform(texts)


class LinguisticFeaturizer:
    """Extracts fixed-length numeric linguistic features per sentence."""

    def transform_sentences(self, texts: list[str], positions: list[float], totals: list[int]) -> np.ndarray:
        rows = [
            sentence_linguistic_features(t, p, tot)
            for t, p, tot in zip(texts, positions, totals)
        ]
        return np.array(rows, dtype=float)

    def transform_pairs(self, source_texts: list[str], target_texts: list[str]) -> np.ndarray:
        rows = [pair_linguistic_features(s, t) for s, t in zip(source_texts, target_texts)]
        return np.array(rows, dtype=float)

    def transform_answers(self, texts: list[str]) -> np.ndarray:
        rows = [structural_answer_features(t) for t in texts]
        return np.array(rows, dtype=float)


def hstack_features(tfidf_matrix, numeric_matrix: np.ndarray):
    """Combine a sparse TF-IDF matrix with a dense numeric feature matrix."""
    return sp.hstack([tfidf_matrix, sp.csr_matrix(numeric_matrix)]).tocsr()
