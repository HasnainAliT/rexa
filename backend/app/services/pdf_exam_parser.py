"""Split exam-style PDFs into question/answer pairs and match the question bank."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.services.rexa_pipeline import _tokenize

HEADING = re.compile(
    r"(?im)^[ \t]*(?P<label>"
    r"question\s*\d*|q(?:uestion)?\s*\d*|"
    r"answer\s*\d*|a(?:nswer)?\s*\d*|"
    r"student\s*answer|response|"
    r"reference(?:\s*answer)?|model\s*answer|"
    r"key\s*concepts?|concepts?"
    r")[ \t]*[:.\-)]+[ \t]*"
)

NUMBERED = re.compile(r"(?m)^\s*\d{1,2}[.)]\s+")


@dataclass
class ExamPair:
    question_text: str
    student_answer: str
    reference_answer: str = ""
    concepts: list[str] = field(default_factory=list)


def _squash_ws(text: str) -> str:
    return re.sub(r"[ \t]*\n+[ \t]*", " ", text).strip()


def _kind_from_label(label: str) -> str:
    label = re.sub(r"\s+", " ", label.lower())
    if label.startswith("q") or label.startswith("question"):
        return "question"
    if "reference" in label or "model" in label:
        return "reference"
    if "concept" in label:
        return "concepts"
    if label.startswith("a") or "answer" in label or "response" in label:
        return "answer"
    return "other"


def _pairs_from_headings(raw: str) -> list[ExamPair]:
    matches = list(HEADING.finditer(raw))
    if not matches:
        return []

    sections: list[tuple[str, str]] = []
    for i, match in enumerate(matches):
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(raw)
        body = raw[start:end].strip()
        if not body:
            continue
        sections.append((_kind_from_label(match.group("label")), _squash_ws(body)))

    pairs: list[ExamPair] = []
    current = ExamPair(question_text="", student_answer="")
    for kind, body in sections:
        if kind == "question":
            if current.student_answer.strip():
                pairs.append(current)
            current = ExamPair(question_text=body, student_answer="")
        elif kind == "answer":
            if current.student_answer:
                current.student_answer = f"{current.student_answer}\n\n{body}"
            else:
                current.student_answer = body
        elif kind == "reference":
            current.reference_answer = body
        elif kind == "concepts":
            current.concepts = [c.strip() for c in re.split(r"[,;\n]+", body) if c.strip()]

    if current.student_answer.strip():
        pairs.append(current)

    return [p for p in pairs if p.student_answer.strip()]


def _pairs_from_numbered(raw: str) -> list[ExamPair]:
    matches = list(NUMBERED.finditer(raw))
    if not matches:
        return []

    pairs: list[ExamPair] = []
    for i, match in enumerate(matches):
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(raw)
        body = raw[start:end].strip()
        if not body:
            continue

        question = ""
        answer = ""
        q_mark = body.find("?")
        if 8 <= q_mark <= 400:
            question = body[: q_mark + 1].strip()
            answer = body[q_mark + 1 :].strip()
        else:
            parts = re.split(r"\n\s*\n", body, maxsplit=1)
            if len(parts) == 2 and parts[0].strip() and parts[1].strip():
                question, answer = parts[0].strip(), parts[1].strip()

        if question and answer:
            pairs.append(
                ExamPair(
                    question_text=_squash_ws(question),
                    student_answer=_squash_ws(answer),
                )
            )

    return pairs


def parse_exam_text(text: str) -> list[ExamPair]:
    """Pull question/answer blocks out of extracted PDF text."""
    raw = (text or "").strip()
    if not raw:
        return []

    headed = _pairs_from_headings(raw)
    if headed:
        return headed
    return _pairs_from_numbered(raw)


def match_bank_question(
    question_text: str, bank: list[tuple[str, str, str, list[str]]]
) -> tuple[str, str, str, list[str]] | None:
    """Return (id, prompt, reference, concepts) for the closest bank question."""
    q_tokens = _tokenize(question_text)
    if not q_tokens or not bank:
        return None

    best: tuple[float, tuple[str, str, str, list[str]]] | None = None
    for item in bank:
        prompt_tokens = _tokenize(item[1])
        if not prompt_tokens:
            continue
        score = len(q_tokens & prompt_tokens) / len(q_tokens | prompt_tokens)
        if best is None or score > best[0]:
            best = (score, item)

    if best is None or best[0] < 0.18:
        return None
    return best[1]


def fallback_single_answer(text: str) -> ExamPair:
    """Treat the whole PDF as one student answer when no headings are found."""
    return ExamPair(question_text="", student_answer=text.strip())
