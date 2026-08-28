"""Generate Acc/P/R/F1 comparison tables + figures for notebook & Evaluation page."""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
COMPARE = ROOT / "data" / "baselines" / "model_comparison.json"
RESULTS = ROOT / "data" / "baselines" / "large_results.json"
FIG_DIR = ROOT / "docs" / "figures"
PUB_DIR = ROOT / "public" / "evaluation" / "figures"
METRICS_JSON = ROOT / "public" / "evaluation" / "metrics.json"
COMPARE_OUT = ROOT / "public" / "evaluation" / "comparison_tables.json"

EXTRA_FIGURES = [
    "09_rexa_module_clf_metrics.png",
    "10_literature_model_comparison.png",
    "11_star_scoring_comparison.png",
]


def _save(fig: plt.Figure, name: str) -> None:
    for folder in (FIG_DIR, PUB_DIR):
        folder.mkdir(parents=True, exist_ok=True)
        fig.savefig(folder / name, dpi=160, bbox_inches="tight")
    print("saved", name)


def main() -> None:
    compare = json.loads(COMPARE.read_text(encoding="utf-8"))

    module_rows = []
    for m in compare["rexa_modules"]:
        module_rows.append(
            {
                "Model": m["model"],
                "Accuracy": round(m["accuracy"] * 100, 2),
                "Precision": round(m["precision"] * 100, 2),
                "Recall": round(m["recall"] * 100, 2),
                "F1-score": round(m["f1"] * 100, 2),
            }
        )

    lit_rows = []
    for item in compare["literature"]:
        lit_rows.append(
            {
                "Model": item["model"],
                "Accuracy %": None
                if item["accuracy"] is None
                else round(item["accuracy"] * 100, 2),
                "Precision %": None
                if item.get("precision") is None
                else round(item["precision"] * 100, 2),
                "Recall %": None
                if item.get("recall") is None
                else round(item["recall"] * 100, 2),
                "F1 %": None if item.get("f1") is None else round(item["f1"] * 100, 2),
                "Focus": item.get("focus", ""),
            }
        )

    score_rows = []
    for s in compare["rexa_scoring"]:
        score_rows.append(
            {
                "Model": s["model"],
                "MAE (↓)": round(s["mae"], 3),
                "Within-1-star % (↑)": round(s["within_one_star"] * 100, 2),
                "Exact Acc %": round(s["exact_accuracy"] * 100, 2),
                "Spearman ρ": round(s["spearman"], 3),
            }
        )

    # Fig 09 — RExA module Acc/P/R/F1
    labels = ["Sentence Roles", "Concept Coverage", "Support/Contr.*"]
    x = np.arange(len(module_rows))
    w = 0.2
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.bar(x - 1.5 * w, [r["Accuracy"] for r in module_rows], w, label="Accuracy", color="#4f46e5")
    ax.bar(x - 0.5 * w, [r["Precision"] for r in module_rows], w, label="Precision", color="#7c3aed")
    ax.bar(x + 0.5 * w, [r["Recall"] for r in module_rows], w, label="Recall", color="#6366f1")
    ax.bar(x + 1.5 * w, [r["F1-score"] for r in module_rows], w, label="F1-score", color="#a78bfa")
    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=15)
    ax.set_ylabel("Score (%)")
    ax.set_ylim(0, 115)
    ax.set_title("RExA Core modules — Accuracy, Precision, Recall, F1")
    ax.legend()
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    _save(fig, "09_rexa_module_clf_metrics.png")
    plt.close(fig)

    # Fig 10 — literature comparison
    plot_items = [x for x in compare["literature"] if x.get("f1") is not None]
    labels = [x["model"].replace(" (ours)", "\n(ours)") for x in plot_items]
    metrics = ["accuracy", "precision", "recall", "f1"]
    metric_names = ["Accuracy", "Precision", "Recall", "F1"]
    colors = ["#4f46e5", "#7c3aed", "#6366f1", "#a78bfa"]
    x = np.arange(len(plot_items))
    w = 0.2
    fig, ax = plt.subplots(figsize=(11, 5.5))
    for i, (key, name, color) in enumerate(zip(metrics, metric_names, colors)):
        vals = [plot_items[j][key] * 100 for j in range(len(plot_items))]
        bars = ax.bar(x + (i - 1.5) * w, vals, w, label=name, color=color)
        for b, v in zip(bars, vals):
            ax.text(b.get_x() + b.get_width() / 2, v + 0.8, f"{v:.1f}", ha="center", fontsize=8)
    ax.set_xticks(x)
    ax.set_xticklabels(labels)
    ax.set_ylabel("Score (%)")
    ax.set_ylim(80, 105)
    ax.set_title(
        "Model comparison — Acc / Precision / Recall / F1\n(DAES & hybrids vs RExA Sentence Roles)"
    )
    ax.legend(ncol=4, loc="upper center", bbox_to_anchor=(0.5, 1.12))
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    _save(fig, "10_literature_model_comparison.png")
    plt.close(fig)

    # Fig 11 — star scoring
    models = [r["Model"] for r in score_rows]
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.5))
    axes[0].bar(models, [r["MAE (↓)"] for r in score_rows], color=["#a78bfa", "#4f46e5", "#7c3aed"])
    axes[0].set_title("Star MAE (lower is better)")
    axes[0].tick_params(axis="x", rotation=20)
    axes[1].bar(
        models,
        [r["Within-1-star % (↑)"] for r in score_rows],
        color=["#a78bfa", "#4f46e5", "#7c3aed"],
    )
    axes[1].set_title("Within-1-star accuracy % (higher is better)")
    axes[1].tick_params(axis="x", rotation=20)
    fig.suptitle(
        "Star scoring: Keyword vs RExA Core vs DistilBERT (comparative)", fontweight="bold"
    )
    fig.tight_layout()
    _save(fig, "11_star_scoring_comparison.png")
    plt.close(fig)

    # Export comparison tables (null -> em dash for UI)
    lit_export = []
    for r in lit_rows:
        lit_export.append({k: ("—" if v is None else v) for k, v in r.items()})

    out = {
        "rexa_clf_table": module_rows,
        "literature_table": lit_export,
        "star_table": score_rows,
        "figures": EXTRA_FIGURES,
    }
    COMPARE_OUT.parent.mkdir(parents=True, exist_ok=True)
    COMPARE_OUT.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print("wrote", COMPARE_OUT)

    if METRICS_JSON.exists():
        payload = json.loads(METRICS_JSON.read_text(encoding="utf-8"))
        figs = list(payload.get("figures", []))
        for name in EXTRA_FIGURES:
            if name not in figs:
                figs.append(name)
        payload["figures"] = figs
        METRICS_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print("updated figures list in", METRICS_JSON)


if __name__ == "__main__":
    main()
