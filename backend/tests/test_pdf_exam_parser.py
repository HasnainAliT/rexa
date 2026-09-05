from app.services.pdf_exam_parser import parse_exam_text


def test_question_answer_headings():
    text = """
Question: What is encapsulation?
Answer: The main idea is bundling data with methods. For example, private fields hide state.
Question: What is polymorphism?
Answer: Different classes can share one interface.
"""
    pairs = parse_exam_text(text)
    assert len(pairs) == 2
    assert "encapsulation" in pairs[0].question_text.lower()
    assert "bundling" in pairs[0].student_answer.lower()
    assert "polymorphism" in pairs[1].question_text.lower()


def test_reference_before_answer():
    text = """
Question: What causes seasons?
Reference: Axial tilt relative to orbit.
Concepts: tilt, orbit
Answer: The Earth is tilted, therefore seasons change.
"""
    pairs = parse_exam_text(text)
    assert len(pairs) == 1
    assert "tilted" in pairs[0].student_answer
    assert "Axial tilt" in pairs[0].reference_answer
    assert "tilt" in pairs[0].concepts


def test_numbered_question_mark():
    text = """
1. Explain the concept of encapsulation in object-oriented programming?
The main idea is hiding internal state. For example, private fields.

2. Compare inheritance and polymorphism?
Inheritance reuses a parent class. Polymorphism changes behavior at runtime.
"""
    pairs = parse_exam_text(text)
    assert len(pairs) == 2
    assert pairs[0].question_text.endswith("?")
    assert "hiding" in pairs[0].student_answer


def test_answer_only_heading():
    text = """
Answer:
Encapsulation bundles data and methods together.
"""
    pairs = parse_exam_text(text)
    assert len(pairs) == 1
    assert pairs[0].question_text == ""
    assert "bundles" in pairs[0].student_answer


def test_question_answer_without_reference_block():
    text = """
Question: What is a blockchain?
Concepts: ledger, hash
Answer: A blockchain is a shared ledger of records.
"""
    pairs = parse_exam_text(text)
    assert len(pairs) == 1
    assert "blockchain" in pairs[0].question_text.lower()
    assert pairs[0].reference_answer == ""
    assert "ledger" in pairs[0].concepts
    assert "shared ledger" in pairs[0].student_answer
