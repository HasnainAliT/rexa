"""RExA public Gradio demo for Hugging Face Spaces (free, no Docker)."""
from __future__ import annotations

import json
from pathlib import Path

import gradio as gr

from rexa_pipeline import RexaPipeline

PIPE = RexaPipeline()
SAMPLES_PATH = Path(__file__).with_name("sample_questions.json")
SAMPLES = json.loads(SAMPLES_PATH.read_text(encoding="utf-8")) if SAMPLES_PATH.exists() else []
SAMPLE_TITLES = [f"{s['id']}: {s['title']}" for s in SAMPLES]


def _load_sample(title: str):
    if not title:
        return "", "", "", ""
    sid = title.split(":", 1)[0].strip()
    for s in SAMPLES:
        if s["id"] == sid:
            concepts = ", ".join(s.get("concepts") or [])
            return s["prompt"], s["reference_answer"], concepts, DEMO_ANSWER
    return "", "", "", DEMO_ANSWER


def analyze(question: str, reference: str, student: str, concepts_csv: str):
    question = (question or "").strip()
    reference = (reference or "").strip()
    student = (student or "").strip()
    if len(student) < 20:
        raise gr.Error("Please enter a student answer (at least ~20 characters).")

    concepts = [c.strip() for c in (concepts_csv or "").split(",") if c.strip()]
    result = PIPE.run(question, reference, student, concepts)

    stars = result.get("stars", 0)
    depth = result.get("reasoning_depth", 0)
    cov = result.get("concept_coverage") or {}
    covered = ", ".join(cov.get("covered") or []) or "(none)"
    missing = ", ".join(cov.get("missing") or []) or "(none)"
    dims = result.get("dimension_scores") or {}
    dim_lines = "\n".join(f"- {k}: {v}" for k, v in dims.items()) or "(n/a)"

    role_lines = []
    for h in result.get("highlights") or []:
        role_lines.append(f"**[{h.get('role')}]** {h.get('text')}")
    roles_md = "\n\n".join(role_lines) if role_lines else "_No sentences detected._"

    support_lines = []
    for p in result.get("support_pairs") or []:
        support_lines.append(
            f"- {p.get('relation')}: “{p.get('source_text', '')[:80]}…” → "
            f"“{p.get('target_text', '')[:80]}…”"
        )
    support_md = "\n".join(support_lines) if support_lines else "_No support links._"

    explanations = result.get("explanations") or []
    expl_md = "\n".join(f"- {e}" for e in explanations) if explanations else "_No explanations._"

    summary = f"""## RExA analysis

**Stars:** {stars} / 5  
**Reasoning depth:** {depth}  
**Concept coverage:** {cov.get('coverage_pct', 0)}%

**Covered:** {covered}  
**Missing:** {missing}

### Dimension scores
{dim_lines}
"""
    return summary, roles_md, support_md, expl_md


DEMO_ANSWER = (
    "Encapsulation hides internal data using private fields. "
    "For example, getters and setters validate input before updating state. "
    "Therefore classes are safer and easier to maintain. "
    "In conclusion, access modifiers enforce data hiding."
)

with gr.Blocks(title="RExA — Explainable Reasoning Analysis") as demo:
    gr.Markdown(
        """
# RExA
### Explainable Reasoning Analysis of Descriptive Answers

Public FYP demo. Paste a question and student answer to see sentence roles,
concept coverage, support links, depth, and an explainable star score.

**Demo login is not required here** — this Space runs the Core RExA analyzer directly.
"""
    )

    with gr.Row():
        sample = gr.Dropdown(choices=SAMPLE_TITLES, label="Load sample question (optional)")
        load_btn = gr.Button("Load sample", variant="secondary")

    question = gr.Textbox(label="Question", lines=3)
    reference = gr.Textbox(label="Reference answer", lines=4)
    concepts = gr.Textbox(
        label="Key concepts (comma-separated)",
        placeholder="encapsulation, access modifiers, data hiding",
    )
    student = gr.Textbox(label="Student answer", lines=8, value=DEMO_ANSWER)
    run_btn = gr.Button("Analyze with RExA", variant="primary")

    summary = gr.Markdown(label="Summary")
    with gr.Tab("Sentence roles"):
        roles = gr.Markdown()
    with gr.Tab("Support links"):
        support = gr.Markdown()
    with gr.Tab("Explanations"):
        expl = gr.Markdown()

    load_btn.click(fn=_load_sample, inputs=[sample], outputs=[question, reference, concepts, student])
    sample.change(fn=_load_sample, inputs=[sample], outputs=[question, reference, concepts, student])
    run_btn.click(
        fn=analyze,
        inputs=[question, reference, student, concepts],
        outputs=[summary, roles, support, expl],
    )

    gr.Markdown(
        "Source code: [github.com/HasnainAliT/rexa](https://github.com/HasnainAliT/rexa) · "
        "Core RExA heuristic pipeline (proposed explainable analysis)."
    )

if __name__ == "__main__":
    demo.queue().launch()
