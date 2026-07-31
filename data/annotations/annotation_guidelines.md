# Annotation Guidelines — Quick Reference

> This is a condensed cheat-sheet for annotators actively labeling submissions in the
> **Annotation Lab**. For the full rationale, examples, agreement methodology, and export
> instructions, see [`docs/annotation_protocol.md`](../../docs/annotation_protocol.md).

## Sentence Roles (pick exactly one per sentence)

| Role | One-line test |
|------|----------------|
| Claim | Is this the main point being argued, stated but not yet justified? |
| Evidence | Is this a fact/example/data point offered in support? |
| Reasoning | Does this explain *why*/*how* the evidence supports the claim (e.g. "because", "since")? |
| Elaboration | Extra detail/definition that doesn't directly argue for the claim? |
| Counterargument | Does this raise an opposing point or limitation (e.g. "however", "but")? |
| Conclusion | Does this summarize/restate the overall point at the end? |
| Irrelevant | Off-topic or just restates the question with no content? |

## Concept Coverage

- Mark **present** only if the *meaning* is conveyed (paraphrase/typo OK).
- Mark **absent** if the keyword appears out of context or is misused.
- When unsure → mark **absent**.

## Support / Contradiction Pairs

- **Supports** — cues: "therefore", "because", "this shows", "as a result".
- **Contradicts** — cues: "however", "but", "although", "in contrast".
- **Neutral** — related but neither supports nor contradicts.
- Skip pairs with no clear relationship rather than forcing a label.

## Reasoning Depth (0.0–1.0, use 0.1 increments)

| Score | Chain present |
|-------|-----------------|
| 0.0–0.2 | None |
| 0.2–0.4 | Claim only, weak/no evidence |
| 0.4–0.6 | Claim + evidence, implicit link |
| 0.6–0.8 | Claim → Evidence → Reasoning |
| 0.8–1.0 | Claim → Evidence → Reasoning → Conclusion |

## Star Rating (1–5, holistic, independent of REXA's own score)

| Stars | Rubric |
|-------|--------|
| 1 | Incorrect / off-topic / near-zero concept coverage |
| 2 | Attempts the question, few concepts, minimal reasoning |
| 3 | ~Half the concepts, some reasoning, has gaps |
| 4 | Most concepts, mostly complete reasoning chain |
| 5 | Full coverage, complete and well-explained reasoning chain |

## Reminders

- Read the whole answer + question + reference answer + concept list before labeling.
- Do **not** look at REXA's automatic result before annotating (avoid anchoring bias).
- Use the **Notes** field for anything ambiguous — this feeds the qualitative error
  analysis in `docs/evaluation_report.md`.
- Export batches of completed annotations into this folder
  (`data/annotations/export_YYYY-MM-DD.json`) via `GET /api/annotations`.
