"""Optional trained-model REXA pipeline loaded from ml/checkpoints.

Uses the sklearn wrappers in ml/src/models/classifiers.py when artifacts
exist; otherwise callers should fall back to the heuristic pipeline.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from app.services.rexa_pipeline import (
    ROLE_CLAIM,
    ROLE_CONCLUSION,
    ROLE_EVIDENCE,
    ROLE_EXPLANATION,
    ROLE_OTHER,
    CueBasedSupportAnalyzer,
    KeywordRoleClassifier,
    RegexSentenceSplitter,
    SBERTConceptMatcher,
    SpacySentenceSplitter,
    TokenOverlapConceptMatcher,
    WeightedStarPredictor,
    ChainReasoningDepthScorer,
    ConceptCoverageResult,
    Sentence,
    SupportPair,
    attach_sentence_reasons,
    sentence_highlight,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
ML_ROOT = REPO_ROOT / "ml"
CHECKPOINTS = ML_ROOT / "checkpoints"
CHECKPOINTS_LARGE = CHECKPOINTS / "large"
ML_SRC = ML_ROOT / "src"


def _resolve_checkpoint(module: str) -> Path:
    """Prefer large-corpus checkpoints when available."""
    large = CHECKPOINTS_LARGE / module / "model.joblib"
    if large.exists():
        return large
    return CHECKPOINTS / module / "model.joblib"

for path in (str(ML_ROOT), str(ML_SRC)):
    if path not in sys.path:
        sys.path.insert(0, path)

ROLE_NORMALIZE = {
    "claim": ROLE_CLAIM,
    "evidence": ROLE_EVIDENCE,
    "explanation": ROLE_EXPLANATION,
    "conclusion": ROLE_CONCLUSION,
    "other": ROLE_OTHER,
}


def _load_joblib(path: Path) -> Any | None:
    if not path.exists():
        return None
    try:
        import joblib

        return joblib.load(path)
    except Exception:
        return None


def checkpoints_available() -> bool:
    required = [
        _resolve_checkpoint("sentence_roles"),
        _resolve_checkpoint("concept_coverage"),
        _resolve_checkpoint("support_contradiction"),
        _resolve_checkpoint("reasoning_depth"),
        _resolve_checkpoint("star_prediction"),
    ]
    return all(path.exists() for path in required)


def load_metrics_summary() -> dict:
    summary: dict[str, Any] = {}
    for name in (
        "sentence_roles",
        "concept_coverage",
        "support_contradiction",
        "reasoning_depth",
        "star_prediction",
    ):
        for base in (CHECKPOINTS_LARGE, CHECKPOINTS):
            metrics_path = base / name / "metrics.json"
            if metrics_path.exists():
                try:
                    summary[name] = json.loads(metrics_path.read_text(encoding="utf-8"))
                except Exception:
                    summary[name] = {}
                break
    return summary


DISTILBERT_DIR = CHECKPOINTS / "distilbert_stars" / "model"


def _load_distilbert_stars():
    """Load DistilBERT star regressor if the Colab/local checkpoint exists."""
    if not DISTILBERT_DIR.exists():
        return None
    try:
        # Import from ml package path already on sys.path
        from src.models.distilbert_stars import DistilBertStarPredictor

        return DistilBertStarPredictor(DISTILBERT_DIR)
    except Exception as exc:  # noqa: BLE001
        print(f"[rexa] DistilBERT load skipped: {exc}")
        return None


class TrainedRexaPipeline:
    """Core RExA pipeline backed by trained sklearn (+ optional DistilBERT comparative stars)."""

    MODEL_VERSION = "trained-large-aes-v1"

    def __init__(self) -> None:
        from app.config import settings

        # Real spaCy sentence splitting — opt-in via USE_SPACY_SPLITTER=true
        self.splitter = (
            SpacySentenceSplitter() if settings.USE_SPACY_SPLITTER else RegexSentenceSplitter()
        )
        # Real SBERT semantic concept matching — opt-in via USE_SBERT_CONCEPTS=true
        self.use_sbert_concepts = bool(settings.USE_SBERT_CONCEPTS)
        self.role_model = _load_joblib(_resolve_checkpoint("sentence_roles"))
        self.concept_model = _load_joblib(_resolve_checkpoint("concept_coverage"))
        self.support_model = _load_joblib(_resolve_checkpoint("support_contradiction"))
        self.depth_model = _load_joblib(_resolve_checkpoint("reasoning_depth"))
        self.star_model = _load_joblib(_resolve_checkpoint("star_prediction"))
        # Comparative experiment only — enabled via USE_DISTILBERT_STARS=true
        self.use_distilbert = bool(settings.USE_DISTILBERT_STARS)
        self.distilbert_stars = _load_distilbert_stars() if self.use_distilbert else None
        if self.use_distilbert and self.distilbert_stars is not None:
            self.MODEL_VERSION = "trained-distilbert-v1"
        else:
            self.MODEL_VERSION = "trained-large-aes-v1"

    def _classify_roles(self, sentences: list[Sentence]) -> None:
        if not sentences:
            return
        used_trained = False
        if self.role_model is not None:
            try:
                texts = [s.text for s in sentences]
                n = len(texts)
                positions = [i / max(n - 1, 1) for i in range(n)]
                totals = [n] * n
                preds = self.role_model.predict(texts, positions, totals)
                for sentence, pred in zip(sentences, preds):
                    sentence.role = ROLE_NORMALIZE.get(str(pred).lower(), ROLE_OTHER)
                used_trained = True
            except Exception:
                used_trained = False

        # Fall back when the trained model collapses to "Other" on OOD text
        if (not used_trained) or all(s.role == ROLE_OTHER for s in sentences):
            KeywordRoleClassifier().classify(sentences)

    def _match_concepts(
        self,
        student_answer: str,
        sentences: list[Sentence],
        concepts: list[str],
    ) -> ConceptCoverageResult:
        if not concepts:
            return ConceptCoverageResult()

        best = TokenOverlapConceptMatcher().match(student_answer, sentences, concepts)

        # Optional semantic candidate — enabled via USE_SBERT_CONCEPTS=true
        if self.use_sbert_concepts:
            try:
                sbert = SBERTConceptMatcher().match(student_answer, sentences, concepts)
                if sbert.coverage_pct >= best.coverage_pct:
                    best = sbert
            except Exception:
                pass

        if self.concept_model is None:
            return best

        try:
            answers = [student_answer] * len(concepts)
            preds = self.concept_model.predict(concepts, answers)
            covered: list[str] = []
            missing: list[str] = []
            matches: dict[str, list[str]] = {}
            for concept, pred in zip(concepts, preds):
                if int(pred) == 1:
                    covered.append(concept)
                    matches[concept] = [concept]
                else:
                    missing.append(concept)
            pct = round(100.0 * len(covered) / max(len(concepts), 1), 2)
            trained = ConceptCoverageResult(
                covered=covered,
                missing=missing,
                coverage_pct=pct,
                matches=matches,
            )
            # Prefer richer coverage when the trained model under-detects
            if trained.coverage_pct >= best.coverage_pct:
                return trained
            return best
        except Exception:
            return best

    def _analyze_support(self, sentences: list[Sentence]) -> list[SupportPair]:
        if len(sentences) < 2:
            return []
        heuristic = CueBasedSupportAnalyzer().analyze(sentences)
        if self.support_model is None:
            return heuristic
        try:
            sources = [sentences[i].text for i in range(len(sentences) - 1)]
            targets = [sentences[i + 1].text for i in range(len(sentences) - 1)]
            preds = self.support_model.predict(sources, targets)
            pairs: list[SupportPair] = []
            for i, pred in enumerate(preds):
                relation = str(pred)
                if relation not in ("Supports", "Contradicts", "Neutral"):
                    lower = relation.lower()
                    if "support" in lower:
                        relation = "Supports"
                    elif "contradict" in lower:
                        relation = "Contradicts"
                    else:
                        relation = "Neutral"
                pairs.append(
                    SupportPair(
                        source_index=sentences[i].index,
                        target_index=sentences[i + 1].index,
                        source_text=sentences[i].text,
                        target_text=sentences[i + 1].text,
                        relation=relation,
                        cue="trained-model",
                    )
                )
            return pairs
        except Exception:
            return heuristic

    def _score_depth(self, student_answer: str, sentences: list[Sentence], support_pairs: list[SupportPair]) -> float:
        heuristic = ChainReasoningDepthScorer().score(sentences, support_pairs)
        if self.depth_model is None:
            return heuristic
        try:
            return float(self.depth_model.predict([student_answer])[0])
        except Exception:
            return heuristic

    def _predict_stars(
        self,
        student_answer: str,
        reference_answer: str,
        coverage_pct: float,
        depth_score: float,
        sentences: list[Sentence],
        support_pairs: list[SupportPair],
    ) -> tuple[float, dict[str, float]]:
        heuristic_stars, dimension_scores = WeightedStarPredictor().predict(
            coverage_pct, depth_score, sentences, support_pairs
        )

        # Optional comparative DistilBERT head (USE_DISTILBERT_STARS=true)
        if self.distilbert_stars is not None:
            try:
                stars = float(self.distilbert_stars.predict([student_answer])[0])
                stars = min(max(round(stars, 2), 1.0), 5.0)
                if abs(stars - heuristic_stars) > 1.75:
                    stars = round((stars + heuristic_stars) / 2, 2)
                return stars, dimension_scores
            except Exception:
                pass

        if self.star_model is None:
            return heuristic_stars, dimension_scores
        try:
            stars = float(self.star_model.predict([student_answer], [reference_answer])[0])
            stars = min(max(round(stars, 2), 1.0), 5.0)
            # Blend toward heuristic if trained score is extreme vs dimensions
            if abs(stars - heuristic_stars) > 1.5:
                stars = round((stars + heuristic_stars) / 2, 2)
            return stars, dimension_scores
        except Exception:
            return heuristic_stars, dimension_scores

    def run(
        self,
        question_text: str,
        reference_answer: str,
        student_answer: str,
        concepts: list[str] | None = None,
    ) -> dict:
        concepts = concepts or []
        sentences = self.splitter.split(student_answer)
        self._classify_roles(sentences)
        attach_sentence_reasons(sentences)
        coverage = self._match_concepts(student_answer, sentences, concepts)
        support_pairs = self._analyze_support(sentences)
        depth_score = self._score_depth(student_answer, sentences, support_pairs)
        stars, dimension_scores = self._predict_stars(
            student_answer,
            reference_answer,
            coverage.coverage_pct,
            depth_score,
            sentences,
            support_pairs,
        )

        from app.services.explainability import generate_explanations

        explanations = generate_explanations(
            coverage=coverage,
            sentences=sentences,
            support_pairs=support_pairs,
            depth_score=depth_score,
            stars=stars,
        )

        return {
            "stars": stars,
            "dimension_scores": dimension_scores,
            "concept_coverage": {
                "covered": coverage.covered,
                "missing": coverage.missing,
                "coverage_pct": coverage.coverage_pct,
                "matches": coverage.matches,
            },
            "highlights": [sentence_highlight(s) for s in sentences],
            "support_pairs": [
                {
                    "source_index": p.source_index,
                    "target_index": p.target_index,
                    "source_text": p.source_text,
                    "target_text": p.target_text,
                    "relation": p.relation,
                    "cue": p.cue,
                }
                for p in support_pairs
            ],
            "reasoning_depth": depth_score,
            "explanations": explanations,
            "model_version": self.MODEL_VERSION,
            "question_text": question_text,
            "reference_answer": reference_answer,
            "student_answer": student_answer,
        }


def build_trained_pipeline() -> TrainedRexaPipeline:
    return TrainedRexaPipeline()
