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


def generate_improvement_brief(
    coverage: "ConceptCoverageResult",
    sentences: list["Sentence"],
    support_pairs: list["SupportPair"],
    depth_score: float,
    stars: float,
) -> dict:
    """Actionable rewrite brief for the student."""
    roles = {s.role for s in sentences}
    missing_concepts = list(coverage.missing or [])
    covered_concepts = list(coverage.covered or [])
    irrelevant = [s for s in sentences if s.role in {"Other", "Irrelevant"}]
    contradictions = [p for p in support_pairs if p.relation == "Contradicts"]
    supports = [p for p in support_pairs if p.relation == "Supports"]

    strengths: list[str] = []
    if covered_concepts:
        shown = ", ".join(covered_concepts[:5])
        extra = ", and more" if len(covered_concepts) > 5 else ""
        strengths.append(f"You already covered: {shown}{extra}.")
    if {"Claim", "Evidence", "Explanation"} <= roles:
        strengths.append("The answer already has a claim, evidence, and reasoning. Keep that chain.")
    if supports:
        n = len(supports)
        strengths.append(f"{n} sentence{'s' if n != 1 else ''} support the main point.")

    steps: list[dict] = []
    if missing_concepts:
        listed = ", ".join(f'"{c}"' for c in missing_concepts[:6])
        more = ", and the other missing ideas" if len(missing_concepts) > 6 else ""
        steps.append(
            {
                "priority": "high",
                "title": "Write the missing concepts into the answer",
                "detail": (
                    f"Add at least one sentence that explains {listed}{more}. "
                    "Naming a term is not enough — say what it means for this question."
                ),
            }
        )
    if "Claim" not in roles:
        steps.append(
            {
                "priority": "high",
                "title": "Start with a clear claim",
                "detail": 'Open with one sentence that directly answers the question, for example: “X is … because …”.',
            }
        )
    if "Evidence" not in roles:
        steps.append(
            {
                "priority": "high",
                "title": "Support the claim with evidence",
                "detail": 'After the claim, add a concrete example, fact, or case. Phrases such as “for example” or “according to” help.',
            }
        )
    if "Explanation" not in roles:
        steps.append(
            {
                "priority": "high",
                "title": "Explain why the evidence matters",
                "detail": 'Add a “because / therefore / this means” sentence that links the evidence back to your claim.',
            }
        )
    if "Conclusion" not in roles and len(sentences) > 2:
        steps.append(
            {
                "priority": "medium",
                "title": "Close with a conclusion",
                "detail": "End with one sentence that restates the main answer so the argument feels finished.",
            }
        )
    if len(irrelevant) >= 2:
        steps.append(
            {
                "priority": "medium",
                "title": "Cut or rewrite off-topic sentences",
                "detail": (
                    f"{len(irrelevant)} sentences were marked as not helping this question. "
                    "Remove them, or rewrite them so they support the claim."
                ),
            }
        )
    if contradictions:
        snippet = (contradictions[0].source_text or contradictions[0].target_text or "")[:140]
        steps.append(
            {
                "priority": "high",
                "title": "Fix conflicting statements",
                "detail": f"This part may clash with the expected answer: “{snippet}”. Rewrite it so it agrees with your claim.",
            }
        )
    if depth_score < 0.4:
        steps.append(
            {
                "priority": "medium",
                "title": "Go one step deeper",
                "detail": "Do not stop at a definition. Add a second “because”, a consequence, or how the idea would be used.",
            }
        )
    if not steps:
        steps.append(
            {
                "priority": "low",
                "title": "Polish a strong answer",
                "detail": "Coverage and structure look solid. Add a second example or a short counterargument if you want to push it further.",
            }
        )

    if stars >= 4.5:
        summary = f"This is a strong answer ({stars:.1f} / 5). The notes below are polish, not repairs."
    elif stars >= 3.5:
        summary = f"This is a good answer ({stars:.1f} / 5) with a few gaps. Follow the steps to raise it."
    elif stars >= 2.5:
        summary = f"This answer is partly there ({stars:.1f} / 5). The steps below are what would make it complete."
    else:
        summary = f"This answer needs a rebuild ({stars:.1f} / 5). Start with step 1 and work down the list."

    return {"summary": summary, "strengths": strengths, "steps": steps}


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
