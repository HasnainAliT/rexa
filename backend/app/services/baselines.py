"""Baseline scoring methods used to benchmark the REXA pipeline against
simpler classical approaches (keyword overlap, TF-IDF cosine similarity,
and an optional embedding-based method that is skipped gracefully when no
embedding model is available).
"""
from __future__ import annotations

import re

STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "and", "or", "but", "if", "then", "of", "to", "in", "on", "for", "with",
    "as", "by", "at", "it", "this", "that", "these", "those", "which",
}


def _tokenize(text: str) -> list[str]:
    tokens = re.findall(r"[a-zA-Z]+", (text or "").lower())
    return [t for t in tokens if t not in STOPWORDS and len(t) > 1]


def _score_to_stars(score: float) -> float:
    """Maps a 0-1 similarity score to a 1-5 star scale."""
    stars = 1 + score * 4
    return round(min(max(stars, 1.0), 5.0), 2)


def keyword_overlap_baseline(reference_answer: str, student_answer: str) -> dict:
    """Simple Jaccard-style overlap between reference and student tokens."""
    ref_tokens = set(_tokenize(reference_answer))
    stu_tokens = set(_tokenize(student_answer))

    if not ref_tokens:
        overlap_score = 0.0
    else:
        intersection = ref_tokens & stu_tokens
        overlap_score = len(intersection) / len(ref_tokens)

    return {
        "name": "Keyword Overlap",
        "score": round(overlap_score, 4),
        "predicted_stars": _score_to_stars(overlap_score),
        "details": {
            "reference_token_count": len(ref_tokens),
            "student_token_count": len(stu_tokens),
            "overlap_count": len(ref_tokens & stu_tokens),
        },
    }


def tfidf_cosine_baseline(reference_answer: str, student_answer: str) -> dict:
    """TF-IDF vectorized cosine similarity between reference and student answers."""
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
    except ImportError:
        return {
            "name": "TF-IDF Cosine Similarity",
            "score": 0.0,
            "predicted_stars": 1.0,
            "details": {"error": "scikit-learn is not installed"},
        }

    documents = [reference_answer or "", student_answer or ""]
    if not any(doc.strip() for doc in documents):
        return {
            "name": "TF-IDF Cosine Similarity",
            "score": 0.0,
            "predicted_stars": 1.0,
            "details": {"error": "empty documents"},
        }

    try:
        vectorizer = TfidfVectorizer(stop_words="english")
        matrix = vectorizer.fit_transform(documents)
        similarity = float(cosine_similarity(matrix[0:1], matrix[1:2])[0][0])
    except ValueError:
        similarity = 0.0

    return {
        "name": "TF-IDF Cosine Similarity",
        "score": round(similarity, 4),
        "predicted_stars": _score_to_stars(similarity),
        "details": {"vectorizer": "TfidfVectorizer(stop_words='english')"},
    }


def embedding_similarity_baseline(reference_answer: str, student_answer: str) -> dict | None:
    """Optional embedding-based similarity. Skipped gracefully (returns None)
    if no embedding model/library (e.g. sentence-transformers) is available,
    since this project intentionally avoids heavy ML dependencies by default.
    """
    try:
        import sentence_transformers  # type: ignore # noqa: F401
    except ImportError:
        return None

    try:
        from sentence_transformers import SentenceTransformer, util  # type: ignore

        model = SentenceTransformer("all-MiniLM-L6-v2")
        embeddings = model.encode([reference_answer or "", student_answer or ""])
        similarity = float(util.cos_sim(embeddings[0], embeddings[1])[0][0])
    except Exception as exc:  # pragma: no cover - optional path
        return {
            "name": "Embedding Similarity",
            "score": 0.0,
            "predicted_stars": 1.0,
            "details": {"error": str(exc)},
        }

    return {
        "name": "Embedding Similarity",
        "score": round(similarity, 4),
        "predicted_stars": _score_to_stars(similarity),
        "details": {"model": "all-MiniLM-L6-v2"},
    }


def run_all_baselines(reference_answer: str, student_answer: str) -> list[dict]:
    baselines = [
        keyword_overlap_baseline(reference_answer, student_answer),
        tfidf_cosine_baseline(reference_answer, student_answer),
    ]
    embedding_result = embedding_similarity_baseline(reference_answer, student_answer)
    if embedding_result is not None:
        baselines.append(embedding_result)
    return baselines
