"""RExA: Explainable Reasoning Analysis of Descriptive Answers pipeline.

A dependency-light, rule/heuristic based implementation that mirrors the
architecture a trained REXA model would eventually have. Each stage is a
small single-responsibility class implementing a narrow interface, wired
together by `RexaPipeline`. This makes it trivial to later swap any stage
(e.g. `RoleClassifier`) for a trained model without touching the rest of
the system (Open/Closed + Dependency Inversion).

No heavy ML dependencies (torch/transformers) are required at runtime -
this is the "heuristic" MODEL_MODE. If MODEL_MODE=="trained" is ever wired
up, `get_pipeline()` is the single place that would swap in trained-model
backed stages.
"""
from __future__ import annotations

import difflib
import logging
import re
from dataclasses import dataclass, field
from typing import Protocol

logger = logging.getLogger("rexa.pipeline")

# ---------------------------------------------------------------------------
# Constants / keyword banks
# ---------------------------------------------------------------------------

ROLE_CLAIM = "Claim"
ROLE_EVIDENCE = "Evidence"
ROLE_EXPLANATION = "Explanation"
ROLE_CONCLUSION = "Conclusion"
ROLE_OTHER = "Other"

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

SUPPORT_CUES = (
    "because", "therefore", "thus", "since", "as a result", "consequently",
    "this shows", "which supports", "hence", "so that", "this confirms",
    "in support of", "further supports",
)
CONTRADICTION_CUES = (
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


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class Sentence:
    index: int
    text: str
    start: int
    end: int
    role: str = ROLE_OTHER
    reason: str = ""
    confidence: float = 0.0


@dataclass
class SupportPair:
    source_index: int
    target_index: int
    source_text: str
    target_text: str
    relation: str
    cue: str | None = None


@dataclass
class ConceptCoverageResult:
    covered: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    coverage_pct: float = 0.0
    matches: dict[str, list[str]] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Stage interfaces (Protocols) - allows swapping heuristic <-> trained models
# ---------------------------------------------------------------------------


class SentenceSplitterProtocol(Protocol):
    def split(self, text: str) -> list[Sentence]: ...


class RoleClassifierProtocol(Protocol):
    def classify(self, sentences: list[Sentence]) -> None: ...


class ConceptMatcherProtocol(Protocol):
    def match(self, student_answer: str, sentences: list[Sentence], concepts: list[str]) -> ConceptCoverageResult: ...


class SupportAnalyzerProtocol(Protocol):
    def analyze(self, sentences: list[Sentence]) -> list[SupportPair]: ...


# ---------------------------------------------------------------------------
# Stage 1: Sentence splitting
# ---------------------------------------------------------------------------


class RegexSentenceSplitter:
    """Lightweight sentence splitter that does not require nltk downloads."""

    def split(self, text: str) -> list[Sentence]:
        text = (text or "").strip()
        if not text:
            return []

        sentences: list[Sentence] = []
        cursor = 0
        raw_parts = SENTENCE_SPLIT_RE.split(text)
        for idx, part in enumerate(raw_parts):
            part = part.strip()
            if not part:
                continue
            start = text.find(part, cursor)
            if start == -1:
                start = cursor
            end = start + len(part)
            cursor = end
            sentences.append(Sentence(index=len(sentences), text=part, start=start, end=end))
        return sentences


# ---------------------------------------------------------------------------
# Stage 2: Sentence role classification
# ---------------------------------------------------------------------------


class KeywordRoleClassifier:
    """Classifies each sentence into Claim/Evidence/Explanation/Conclusion/Other
    using keyword and positional heuristics.
    """

    _MARKERS = {
        ROLE_EXPLANATION: EXPLANATION_MARKERS,
        ROLE_EVIDENCE: EVIDENCE_MARKERS,
        ROLE_CONCLUSION: CONCLUSION_MARKERS,
        ROLE_CLAIM: CLAIM_MARKERS,
    }

    def classify(self, sentences: list[Sentence]) -> None:
        total = len(sentences)
        for sentence in sentences:
            role, reason, confidence = self.explain(
                sentence.text, sentence.index, total
            )
            sentence.role = role
            sentence.reason = reason
            sentence.confidence = confidence

    def explain(
        self, text: str, index: int, total: int, assigned_role: str | None = None
    ) -> tuple[str, str, float]:
        lowered = text.lower()
        hits = {
            role: [marker for marker in markers if marker in lowered]
            for role, markers in self._MARKERS.items()
        }
        scores = {role: float(len(found)) for role, found in hits.items()}
        opening = index == 0
        closing = total > 1 and index == total - 1
        if closing:
            scores[ROLE_CONCLUSION] += 0.5
        if opening:
            scores[ROLE_CLAIM] += 0.5

        best_role = max(scores, key=lambda role: scores[role])
        if scores[best_role] <= 0:
            best_role = ROLE_OTHER

        role = assigned_role or best_role
        reason, confidence = self._reason_for(
            role, hits.get(role, []), opening, closing, index, total
        )
        return role, reason, confidence

    @staticmethod
    def _reason_for(
        role: str,
        matched: list[str],
        opening: bool,
        closing: bool,
        index: int,
        total: int,
    ) -> tuple[str, float]:
        quoted = ", ".join(f'"{cue}"' for cue in matched[:3])
        position = f"sentence {index + 1} of {total}"
        if role == ROLE_OTHER:
            return (
                f"Labeled Irrelevant because no claim, evidence, reasoning, or "
                f"conclusion cues were found ({position}).",
                0.45,
            )
        parts: list[str] = []
        if quoted:
            parts.append(f"it contains {quoted}")
        if role == ROLE_CLAIM and opening:
            parts.append("it is the opening sentence (typical claim position)")
        if role == ROLE_CONCLUSION and closing:
            parts.append("it is the closing sentence (typical conclusion position)")
        if not parts:
            parts.append(
                f"the classifier assigned this role from surrounding structure ({position})"
            )
        return f"Labeled {role} because " + " and ".join(parts) + ".", min(
            0.95, 0.55 + 0.12 * len(matched) + (0.08 if opening or closing else 0)
        )

    @staticmethod
    def _count_markers(lowered: str, markers: tuple[str, ...]) -> float:
        return float(sum(1 for marker in markers if marker in lowered))


def attach_sentence_reasons(sentences: list[Sentence]) -> None:
    """Fill per-sentence why-text after any classifier (heuristic or trained)."""
    total = len(sentences)
    helper = KeywordRoleClassifier()
    for sentence in sentences:
        if sentence.reason:
            continue
        _role, reason, confidence = helper.explain(
            sentence.text, sentence.index, total, assigned_role=sentence.role
        )
        sentence.reason = reason
        if not sentence.confidence:
            sentence.confidence = confidence


def sentence_highlight(sentence: Sentence) -> dict:
    return {
        "index": sentence.index,
        "text": sentence.text,
        "role": sentence.role,
        "start": sentence.start,
        "end": sentence.end,
        "reason": sentence.reason,
        "confidence": round(sentence.confidence or 0.8, 3),
    }


# ---------------------------------------------------------------------------
# Stage 3: Concept coverage
# ---------------------------------------------------------------------------


def _tokenize(text: str) -> set[str]:
    tokens = re.findall(r"[a-zA-Z]+", text.lower())
    return {t for t in tokens if t not in STOPWORDS and len(t) > 1}


class TokenOverlapConceptMatcher:
    """Matches concepts against the student's answer using lowercase token
    overlap plus difflib-based fuzzy matching (handles typos/inflections).
    """

    FUZZY_THRESHOLD = 0.82

    def match(
        self, student_answer: str, sentences: list[Sentence], concepts: list[str]
    ) -> ConceptCoverageResult:
        if not concepts:
            return ConceptCoverageResult(covered=[], missing=[], coverage_pct=100.0, matches={})

        student_tokens = _tokenize(student_answer)
        result = ConceptCoverageResult()

        for concept in concepts:
            concept_tokens = _tokenize(concept)
            if not concept_tokens:
                continue

            matched_sentences: list[str] = []
            direct_hits = concept_tokens & student_tokens
            is_covered = len(direct_hits) >= max(1, len(concept_tokens) // 2)

            if not is_covered:
                # fuzzy fallback: compare each concept token against student tokens
                fuzzy_hits = 0
                for c_tok in concept_tokens:
                    close = difflib.get_close_matches(c_tok, student_tokens, n=1, cutoff=self.FUZZY_THRESHOLD)
                    if close:
                        fuzzy_hits += 1
                if fuzzy_hits >= max(1, len(concept_tokens) // 2):
                    is_covered = True

            if is_covered:
                for sentence in sentences:
                    sent_tokens = _tokenize(sentence.text)
                    if concept_tokens & sent_tokens:
                        matched_sentences.append(sentence.text)
                result.covered.append(concept)
                if matched_sentences:
                    result.matches[concept] = matched_sentences
            else:
                result.missing.append(concept)

        result.coverage_pct = round(100.0 * len(result.covered) / len(concepts), 2) if concepts else 100.0
        return result


# ---------------------------------------------------------------------------
# Stage 4: Support & contradiction analysis
# ---------------------------------------------------------------------------


class CueBasedSupportAnalyzer:
    """Pairs consecutive sentences (and claim->evidence pairs) and labels
    their relation using support/contradiction cue words.
    """

    def analyze(self, sentences: list[Sentence]) -> list[SupportPair]:
        pairs: list[SupportPair] = []
        for i in range(len(sentences) - 1):
            source = sentences[i]
            target = sentences[i + 1]
            relation, cue = self._classify_pair(target.text)
            pairs.append(
                SupportPair(
                    source_index=source.index,
                    target_index=target.index,
                    source_text=source.text,
                    target_text=target.text,
                    relation=relation,
                    cue=cue,
                )
            )
        return pairs

    @staticmethod
    def _classify_pair(target_text: str) -> tuple[str, str | None]:
        lowered = f" {target_text.lower()} "
        for cue in CONTRADICTION_CUES:
            if cue in lowered:
                return "Contradicts", cue.strip()
        for cue in SUPPORT_CUES:
            if cue in lowered:
                return "Supports", cue.strip()
        return "Neutral", None


# ---------------------------------------------------------------------------
# Stage 5: Reasoning depth
# ---------------------------------------------------------------------------


class ChainReasoningDepthScorer:
    """Scores 0-1 based on presence of Claim -> Evidence -> Explanation chains
    and the diversity/length of the reasoning present in the answer.
    """

    def score(self, sentences: list[Sentence], support_pairs: list[SupportPair]) -> float:
        if not sentences:
            return 0.0

        roles_present = {s.role for s in sentences}
        chain_roles = {ROLE_CLAIM, ROLE_EVIDENCE, ROLE_EXPLANATION}
        chain_score = len(roles_present & chain_roles) / len(chain_roles)

        has_conclusion = ROLE_CONCLUSION in roles_present
        conclusion_bonus = 0.15 if has_conclusion else 0.0

        support_count = sum(1 for p in support_pairs if p.relation == "Supports")
        support_ratio = support_count / len(support_pairs) if support_pairs else 0.0

        length_factor = min(len(sentences) / 5.0, 1.0)

        score = (
            0.5 * chain_score
            + 0.2 * support_ratio
            + 0.15 * length_factor
            + conclusion_bonus
        )
        return round(min(max(score, 0.0), 1.0), 4)


# ---------------------------------------------------------------------------
# Stage 6: Star prediction
# ---------------------------------------------------------------------------


class WeightedStarPredictor:
    """Aggregates dimension scores into a 1-5 star rating."""

    WEIGHTS = {
        "coverage": 0.40,
        "depth": 0.25,
        "role_diversity": 0.15,
        "support_ratio": 0.15,
        "contradiction_penalty": 0.05,
    }

    def predict(
        self,
        coverage_pct: float,
        depth_score: float,
        sentences: list[Sentence],
        support_pairs: list[SupportPair],
    ) -> tuple[float, dict[str, float]]:
        coverage_norm = coverage_pct / 100.0

        distinct_roles = {s.role for s in sentences if s.role != ROLE_OTHER}
        role_diversity = len(distinct_roles) / 4.0  # 4 meaningful roles

        support_total = len(support_pairs)
        supports = sum(1 for p in support_pairs if p.relation == "Supports")
        contradicts = sum(1 for p in support_pairs if p.relation == "Contradicts")
        support_ratio = supports / support_total if support_total else 0.0
        contradiction_ratio = contradicts / support_total if support_total else 0.0

        weighted = (
            self.WEIGHTS["coverage"] * coverage_norm
            + self.WEIGHTS["depth"] * depth_score
            + self.WEIGHTS["role_diversity"] * role_diversity
            + self.WEIGHTS["support_ratio"] * support_ratio
            - self.WEIGHTS["contradiction_penalty"] * contradiction_ratio
        )
        weighted = min(max(weighted, 0.0), 1.0)

        stars = round(1 + weighted * 4, 2)  # map [0,1] -> [1,5]
        stars = min(max(stars, 1.0), 5.0)

        dimension_scores = {
            "concept_coverage": round(coverage_norm, 4),
            "reasoning_depth": round(depth_score, 4),
            "support_quality": round(support_ratio - contradiction_ratio, 4),
            "role_structure": round(role_diversity, 4),
        }
        return stars, dimension_scores


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


class RexaPipeline:
    """Composes all stages into the full REXA analysis pipeline."""

    MODEL_VERSION = "heuristic-v1"

    def __init__(
        self,
        splitter: SentenceSplitterProtocol | None = None,
        role_classifier: RoleClassifierProtocol | None = None,
        concept_matcher: ConceptMatcherProtocol | None = None,
        support_analyzer: SupportAnalyzerProtocol | None = None,
        depth_scorer: ChainReasoningDepthScorer | None = None,
        star_predictor: WeightedStarPredictor | None = None,
    ) -> None:
        self.splitter = splitter or RegexSentenceSplitter()
        self.role_classifier = role_classifier or KeywordRoleClassifier()
        self.concept_matcher = concept_matcher or TokenOverlapConceptMatcher()
        self.support_analyzer = support_analyzer or CueBasedSupportAnalyzer()
        self.depth_scorer = depth_scorer or ChainReasoningDepthScorer()
        self.star_predictor = star_predictor or WeightedStarPredictor()

    def run(
        self,
        question_text: str,
        reference_answer: str,
        student_answer: str,
        concepts: list[str] | None = None,
    ) -> dict:
        concepts = concepts or []

        sentences = self.splitter.split(student_answer)
        self.role_classifier.classify(sentences)
        attach_sentence_reasons(sentences)

        coverage = self.concept_matcher.match(student_answer, sentences, concepts)
        support_pairs = self.support_analyzer.analyze(sentences)
        depth_score = self.depth_scorer.score(sentences, support_pairs)
        stars, dimension_scores = self.star_predictor.predict(
            coverage.coverage_pct, depth_score, sentences, support_pairs
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


_pipeline_instance = None


def get_pipeline():
    """Returns the singleton pipeline for the configured MODEL_MODE.

    `trained` loads sklearn checkpoints from `ml/checkpoints` (the proposed
    Core RExA system). `heuristic` uses rule-based stages. If trained is
    requested but checkpoints are missing, falls back to heuristic.
    """
    global _pipeline_instance
    if _pipeline_instance is None:
        from app.config import settings

        if settings.MODEL_MODE.lower() == "trained":
            try:
                from app.services.trained_models import (
                    build_trained_pipeline,
                    checkpoints_available,
                )

                if checkpoints_available():
                    _pipeline_instance = build_trained_pipeline()
                    logger.info(
                        "Serving Core RExA %s",
                        getattr(_pipeline_instance, "MODEL_VERSION", "trained"),
                    )
                else:
                    logger.warning(
                        "MODEL_MODE=trained but checkpoints are missing; "
                        "falling back to heuristic-v1"
                    )
                    _pipeline_instance = RexaPipeline()
            except Exception:
                logger.exception(
                    "Failed to load trained Core RExA; falling back to heuristic-v1"
                )
                _pipeline_instance = RexaPipeline()
        else:
            _pipeline_instance = RexaPipeline()
            logger.info("Serving heuristic-v1 (MODEL_MODE=%s)", settings.MODEL_MODE)
    return _pipeline_instance


def describe_pipeline() -> dict:
    """Runtime status for health checks and startup logs."""
    from app.config import settings

    pipe = get_pipeline()
    version = getattr(pipe, "MODEL_VERSION", "unknown")
    checkpoints = False
    try:
        from app.services.trained_models import checkpoints_available

        checkpoints = checkpoints_available()
    except Exception:
        checkpoints = False
    serving_trained = str(version).startswith("trained")
    configured = settings.MODEL_MODE
    return {
        "configured_mode": configured,
        "pipeline_version": version,
        "checkpoints_available": checkpoints,
        "serving": "trained" if serving_trained else "heuristic",
        "fallback_to_heuristic": configured.lower() == "trained" and not serving_trained,
    }


def reset_pipeline() -> None:
    """Clear cached pipeline (e.g. after activating a different model mode)."""
    global _pipeline_instance
    _pipeline_instance = None


def run_rexa_pipeline(
    question_text: str,
    reference_answer: str,
    student_answer: str,
    concepts: list[str] | None = None,
) -> dict:
    return get_pipeline().run(question_text, reference_answer, student_answer, concepts)
