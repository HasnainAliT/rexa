"""Generates PDF and Markdown reports from a stored REXA analysis run."""
from __future__ import annotations

import io
from datetime import datetime
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def _fmt_dt(dt: Any) -> str:
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d %H:%M UTC")
    return str(dt)


def generate_markdown_report(
    analysis_id: str,
    question_title: str,
    student_name: str | None,
    result: dict,
    created_at: Any,
) -> str:
    lines: list[str] = []
    lines.append(f"# RExA Analysis Report")
    lines.append("")
    lines.append(f"- **Analysis ID:** `{analysis_id}`")
    lines.append(f"- **Question:** {question_title}")
    lines.append(f"- **Student:** {student_name or 'N/A'}")
    lines.append(f"- **Date:** {_fmt_dt(created_at)}")
    lines.append(f"- **Model version:** {result.get('model_version', 'heuristic-v1')}")
    lines.append(f"- **Overall Rating:** {result.get('stars')} / 5 stars")
    lines.append("")

    lines.append("## Dimension Scores")
    lines.append("")
    lines.append("| Dimension | Score |")
    lines.append("|---|---|")
    for key, value in (result.get("dimension_scores") or {}).items():
        pretty = key.replace("_", " ").title()
        lines.append(f"| {pretty} | {value} |")
    lines.append("")

    coverage = result.get("concept_coverage") or {}
    lines.append("## Concept Coverage")
    lines.append("")
    lines.append(f"Coverage: **{coverage.get('coverage_pct', 0)}%**")
    lines.append("")
    lines.append(f"- Covered: {', '.join(coverage.get('covered') or []) or 'None'}")
    lines.append(f"- Missing: {', '.join(coverage.get('missing') or []) or 'None'}")
    lines.append("")

    lines.append("## Sentence Roles")
    lines.append("")
    for h in result.get("highlights") or []:
        lines.append(f"{h.get('index', 0) + 1}. **[{h.get('role')}]** {h.get('text')}")
    lines.append("")

    lines.append("## Support & Contradiction Analysis")
    lines.append("")
    for p in result.get("support_pairs") or []:
        lines.append(f"- *{p.get('relation')}*: \"{p.get('source_text')}\" -> \"{p.get('target_text')}\"")
    lines.append("")

    lines.append("## Explanations")
    lines.append("")
    for e in result.get("explanations") or []:
        lines.append(f"- **[{e.get('severity', 'info').upper()}]** {e.get('message')}")
    lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("### Reference Answer")
    lines.append("")
    lines.append(result.get("reference_answer", ""))
    lines.append("")
    lines.append("### Student Answer")
    lines.append("")
    lines.append(result.get("student_answer", ""))
    lines.append("")

    return "\n".join(lines)


def generate_pdf_report(
    analysis_id: str,
    question_title: str,
    student_name: str | None,
    result: dict,
    created_at: Any,
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        topMargin=0.6 * inch,
        bottomMargin=0.6 * inch,
        leftMargin=0.7 * inch,
        rightMargin=0.7 * inch,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "TitleCentered", parent=styles["Title"], alignment=TA_CENTER, spaceAfter=6
    )
    heading_style = styles["Heading2"]
    body_style = styles["BodyText"]
    small_style = ParagraphStyle("Small", parent=styles["BodyText"], fontSize=9, textColor=colors.grey)

    story = []
    story.append(Paragraph("RExA Analysis Report", title_style))
    story.append(Paragraph("Explainable Reasoning Analysis of Descriptive Answers", small_style))
    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", color=colors.grey))
    story.append(Spacer(1, 12))

    meta_table_data = [
        ["Analysis ID", analysis_id],
        ["Question", escape(question_title)],
        ["Student", escape(student_name or "N/A")],
        ["Date", _fmt_dt(created_at)],
        ["Model Version", result.get("model_version", "heuristic-v1")],
        ["Overall Rating", f"{result.get('stars')} / 5 stars"],
    ]
    meta_table = Table(meta_table_data, colWidths=[1.6 * inch, 4.5 * inch])
    meta_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ]
        )
    )
    story.append(meta_table)
    story.append(Spacer(1, 16))

    story.append(Paragraph("Dimension Scores", heading_style))
    dim_data = [["Dimension", "Score"]] + [
        [key.replace("_", " ").title(), str(value)]
        for key, value in (result.get("dimension_scores") or {}).items()
    ]
    dim_table = Table(dim_data, colWidths=[3 * inch, 2 * inch])
    dim_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
            ]
        )
    )
    story.append(dim_table)
    story.append(Spacer(1, 16))

    coverage = result.get("concept_coverage") or {}
    story.append(Paragraph("Concept Coverage", heading_style))
    story.append(Paragraph(f"Coverage: {coverage.get('coverage_pct', 0)}%", body_style))
    story.append(Paragraph(f"<b>Covered:</b> {escape(', '.join(coverage.get('covered') or []) or 'None')}", body_style))
    story.append(Paragraph(f"<b>Missing:</b> {escape(', '.join(coverage.get('missing') or []) or 'None')}", body_style))
    story.append(Spacer(1, 16))

    story.append(Paragraph("Sentence Roles", heading_style))
    for h in result.get("highlights") or []:
        story.append(Paragraph(f"<b>[{escape(str(h.get('role')))}]</b> {escape(str(h.get('text')))}", body_style))
    story.append(Spacer(1, 16))

    story.append(Paragraph("Support &amp; Contradiction Analysis", heading_style))
    for p in result.get("support_pairs") or []:
        story.append(
            Paragraph(
                f"<i>{escape(str(p.get('relation')))}</i>: \"{escape(str(p.get('source_text')))}\" "
                f"&#8594; \"{escape(str(p.get('target_text')))}\"",
                body_style,
            )
        )
    story.append(Spacer(1, 16))

    story.append(Paragraph("Explanations", heading_style))
    for e in result.get("explanations") or []:
        story.append(
            Paragraph(
                f"<b>[{escape(str(e.get('severity', 'info')).upper())}]</b> {escape(str(e.get('message')))}",
                body_style,
            )
        )
    story.append(Spacer(1, 16))

    story.append(HRFlowable(width="100%", color=colors.grey))
    story.append(Spacer(1, 10))
    story.append(Paragraph("Reference Answer", heading_style))
    story.append(Paragraph(escape(result.get("reference_answer", "") or "N/A"), body_style))
    story.append(Spacer(1, 10))
    story.append(Paragraph("Student Answer", heading_style))
    story.append(Paragraph(escape(result.get("student_answer", "") or "N/A"), body_style))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
