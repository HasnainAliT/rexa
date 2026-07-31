"""Generates human-readable explanations from REXA pipeline outputs."""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.services.rexa_pipeline import ConceptCoverageResult, Sentence, SupportPair


def generate_explanations(
    coverage: "ConceptCoverageResult",
    sentences: list["Sentence"],
    support_pairs: list["SupportPair"],
    depth_score: float,
    stars: float,
) -> list[dict]:
    explanations: list[dict] = []

    explanations.extend(_concept_explanations(coverage))
    explanations.extend(_structure_explanations(sentences))
    explanations.extend(_support_explanations(support_pairs))
    explanations.extend(_depth_explanations(depth_score))
    explanations.append(_overall_explanation(stars))

    return explanations


def _concept_explanations(coverage: "ConceptCoverageResult") -> list[dict]:
    items: list[dict] = []
    total = len(coverage.covered) + len(coverage.missing)

    if total == 0:
        return items

    if coverage.coverage_pct >= 80:
        items.append(
            {
                "type": "concept_coverage",
                "message": f"Strong concept coverage ({coverage.coverage_pct:.0f}%) - "
                f"the answer addresses {len(coverage.covered)} of {total} key concepts.",
                "severity": "success",
            }
        )
    elif coverage.coverage_pct >= 50:
        items.append(
            {
                "type": "concept_coverage",
                "message": f"Partial concept coverage ({coverage.coverage_pct:.0f}%). "
                f"Missing: {', '.join(coverage.missing) or 'none'}.",
                "severity": "warning",
            }
        )
    else:
        items.append(
            {
                "type": "concept_coverage",
                "message": f"Low concept coverage ({coverage.coverage_pct:.0f}%). "
                f"The answer is missing important concepts: {', '.join(coverage.missing) or 'several key ideas'}.",
                "severity": "warning",
            }
        )

    if coverage.missing:
        items.append(
            {
                "type": "missing_concepts",
                "message": f"Consider addressing: {', '.join(coverage.missing)}.",
                "severity": "info",
            }
        )

    return items


def _structure_explanations(sentences: list["Sentence"]) -> list[dict]:
    items: list[dict] = []
    if not sentences:
        items.append(
            {
                "type": "structure",
                "message": "No answer content was provided to analyze.",
                "severity": "warning",
            }
        )
        return items

    roles = [s.role for s in sentences]
    role_set = set(roles)

    has_claim = "Claim" in role_set
    has_evidence = "Evidence" in role_set
    has_explanation = "Explanation" in role_set
    has_conclusion = "Conclusion" in role_set

    if has_claim and has_evidence and has_explanation:
        items.append(
            {
                "type": "structure",
                "message": "The answer follows a clear Claim -> Evidence -> Explanation reasoning chain.",
                "severity": "success",
            }
        )
    else:
        missing_roles = [
            r for r, present in
            [("a clear claim/thesis", has_claim), ("supporting evidence", has_evidence), ("an explanation of reasoning", has_explanation)]
            if not present
        ]
        items.append(
            {
                "type": "structure",
                "message": f"The reasoning structure could be improved by adding: {', '.join(missing_roles)}.",
                "severity": "warning",
            }
        )

    if not has_conclusion and len(sentences) > 2:
        items.append(
            {
                "type": "structure",
                "message": "Consider adding a concluding sentence to summarize the argument.",
                "severity": "info",
            }
        )

    return items


def _support_explanations(support_pairs: list["SupportPair"]) -> list[dict]:
    items: list[dict] = []
    if not support_pairs:
        return items

    contradictions = [p for p in support_pairs if p.relation == "Contradicts"]
    supports = [p for p in support_pairs if p.relation == "Supports"]

    if contradictions:
        items.append(
            {
                "type": "contradiction",
                "message": f"Detected {len(contradictions)} potentially contradictory or inconsistent statement(s) "
                f"(e.g. near: \"{contradictions[0].target_text[:80]}\").",
                "severity": "warning",
            }
        )

    if supports:
        items.append(
            {
                "type": "support",
                "message": f"Found {len(supports)} sentence(s) that explicitly support preceding claims using "
                f"reasoning connectors (e.g. \"{supports[0].cue}\").",
                "severity": "success",
            }
        )

    return items


def _depth_explanations(depth_score: float) -> list[dict]:
    if depth_score >= 0.75:
        message = "Reasoning depth is high - the answer demonstrates well-connected, multi-step reasoning."
        severity = "success"
    elif depth_score >= 0.4:
        message = "Reasoning depth is moderate - some reasoning is present but could be more thorough."
        severity = "info"
    else:
        message = "Reasoning depth is low - the answer would benefit from deeper justification and elaboration."
        severity = "warning"

    return [{"type": "reasoning_depth", "message": message, "severity": severity}]


def _overall_explanation(stars: float) -> dict:
    if stars >= 4.5:
        message = f"Overall rating: {stars}/5 - excellent, well-reasoned answer."
        severity = "success"
    elif stars >= 3.5:
        message = f"Overall rating: {stars}/5 - good answer with minor gaps."
        severity = "success"
    elif stars >= 2.5:
        message = f"Overall rating: {stars}/5 - adequate answer, notable room for improvement."
        severity = "info"
    else:
        message = f"Overall rating: {stars}/5 - the answer needs significant improvement."
        severity = "warning"

    return {"type": "overall", "message": message, "severity": severity}
