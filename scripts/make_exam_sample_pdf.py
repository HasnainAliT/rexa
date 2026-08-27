"""Write public/samples/rexa-exam-sample.pdf for the Analysis → Exam PDF demo."""
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "samples" / "rexa-exam-sample.pdf"

BODY = [
    ("Question:", "Explain the concept of encapsulation in object-oriented programming and describe how access modifiers support it."),
    (
        "Answer:",
        (
            "The main idea is that encapsulation bundles an object's data and behavior together "
            "while restricting direct access to its internal state. For example, access modifiers "
            "like private, protected, and public control which fields and methods can be seen from "
            "outside the class. This is because hiding the internal fields prevents other parts of "
            "the program from making the object enter an invalid state. For instance, a class can "
            "expose getter and setter methods instead of allowing direct access to a private field. "
            "This matters because the setter can validate incoming values before the internal state "
            "is ever changed. In conclusion, encapsulation and access modifiers work together to "
            "achieve data hiding and reduce coupling between classes."
        ),
    ),
    ("Question:", "Compare inheritance and polymorphism in object-oriented programming, with examples."),
    (
        "Answer:",
        (
            "The main idea is that inheritance is like sharing a family pizza recipe so a child class "
            "reuses the parent class. For example, a Dog class can inherit from Animal. Polymorphism "
            "is when different classes respond to the same method in their own way, therefore speak() "
            "can bark or meow. In conclusion, inheritance reuses code and polymorphism lets one "
            "interface have many behaviors."
        ),
    ),
]


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    styles = getSampleStyleSheet()
    heading = ParagraphStyle(
        "HeadingLabel",
        parent=styles["Heading3"],
        fontName="Times-Bold",
        spaceBefore=10,
        spaceAfter=4,
    )
    body = ParagraphStyle(
        "ExamBody",
        parent=styles["BodyText"],
        fontName="Times-Roman",
        fontSize=11,
        leading=15,
        spaceAfter=8,
    )
    title = ParagraphStyle(
        "ExamTitle",
        parent=styles["Title"],
        fontName="Times-Bold",
        fontSize=16,
        spaceAfter=12,
    )

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title="RExA sample exam",
    )
    story = [
        Paragraph("Object-Oriented Programming - Midterm (sample)", title),
        Paragraph(
            "Typed exam script for RExA. Each question is followed by the student answer.",
            body,
        ),
        Spacer(1, 6),
    ]
    for label, text in BODY:
        story.append(Paragraph(label, heading))
        story.append(Paragraph(text, body))
    doc.build(story)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
