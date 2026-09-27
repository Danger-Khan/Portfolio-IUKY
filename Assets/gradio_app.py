"""Gradio front end for the portfolio.

    pip install gradio
    python "Assets/gradio_app.py"

Then open the local URL it prints (http://127.0.0.1:7860 by default).

Same content and the same live tools as streamlit_app.py — both read from
portfolio_data.py, so the two cannot disagree. Gradio is the better fit of the
two for the tool demos (its Blocks layout maps neatly onto input → run →
output), while Streamlit's tabs suit the browsing side; having both is the
point of the exercise.

Nothing here calls out to a network. `demo.launch()` runs a local server only —
there is no `share=True`, because that would tunnel this machine's filesystem
tools to a public URL.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

import gradio as gr

import portfolio_data as data

LANG_LABELS = {"js": "JavaScript", "c": "C", "java": "Java", "go": "Go"}
LABEL_TO_LANG = {v: k for k, v in LANG_LABELS.items()}


# --------------------------------------------------------------------------
# Overview
# --------------------------------------------------------------------------

def overview_markdown() -> str:
    lines = [f"### {len(data.PORTFOLIOS)} sub-portfolios", ""]
    for item in data.PORTFOLIOS:
        exists = (data.REPO_ROOT / item["folder"]).is_dir()
        lines.append(f"**{item['name']}**{'' if exists else '  _(folder not found)_'}")
        lines.append(f"{item['blurb']}")
        for highlight in item["highlights"]:
            lines.append(f"- {highlight}")
        lines.append(f"`{item['folder']}`")
        lines.append("")
    return "\n".join(lines)


def tool_status_rows():
    return [[r["tool"], r["path"], "ready" if r["ok"] else r["detail"]] for r in data.tool_status()]


# --------------------------------------------------------------------------
# Certifications
# --------------------------------------------------------------------------

_CERTS = data.load_certifications()
_CATEGORIES = sorted({c["category"] for c in _CERTS})


def filter_certs(categories, query):
    query = (query or "").lower().strip()
    rows = [
        [c["name"], c["issuer"], c["category"]]
        for c in _CERTS
        if (not categories or c["category"] in categories)
        and (not query or query in f"{c['name']} {c['issuer']}".lower())
    ]
    return rows, f"Showing **{len(rows)}** of {len(_CERTS)} certifications"


# --------------------------------------------------------------------------
# Tools
# --------------------------------------------------------------------------

def compile_python(source, target_labels):
    targets = [LABEL_TO_LANG[label] for label in (target_labels or []) if label in LABEL_TO_LANG]
    outputs, cached, error = data.run_compiler(source, targets or ["js"])

    if error:
        # The compiler rejecting unsupported Python is a result, not a failure —
        # show the message it wrote rather than a generic error.
        return f"### Compile error\n\n```\n{error}\n```\n\nThis compiler refuses to guess: anything outside its supported subset is rejected with a line number instead of being mistranslated."

    parts = []
    if cached:
        parts.append("_Served from the magic_lines cache — exact match, pipeline skipped._\n")
    for lang, code in outputs.items():
        parts.append(f"#### {LANG_LABELS[lang]}\n```{lang}\n{code}\n```")
    return "\n\n".join(parts)


def humanize(text, intensity):
    try:
        rewritten, changes = data.run_humanizer(text, intensity)
    except Exception as exc:
        return f"Humanizer failed — {exc}", []
    return rewritten, [[a, b] for a, b in changes]


def slice_sentence(text):
    try:
        tagged, counts, tense = data.run_slicer(text)
    except Exception as exc:
        return [], f"Slicer failed — {exc}"
    summary = " · ".join(f"**{k}** {v}" for k, v in sorted(counts.items(), key=lambda x: -x[1]))
    summary = f"**Tense:** {tense['label']}\n\n{summary}" if tense else f"**Tense:** not detected\n\n{summary}"
    if counts.get("unclassified"):
        summary += (
            f"\n\n{counts['unclassified']} token(s) unclassified — the word library "
            "is finite and says so rather than guessing."
        )
    return [[t, c, s] for t, c, s in tagged], summary


_SAMPLES = {p.name: p for p in data.find_stl_samples()}


def inspect_stl(uploaded, sample_name):
    path = Path(uploaded) if uploaded else _SAMPLES.get(sample_name)
    if not path:
        return None, "Pick a sample or upload an STL file."

    try:
        info = data.run_stl(path)
    except Exception as exc:
        return None, f"Could not read that file — {exc}"

    sx, sy, sz = info["size"]
    seal = (
        "**Watertight** — every edge is shared by exactly two facets, so this can be sliced."
        if info["sealed"]
        else f"**Not watertight** — {info['open_edges']:,} edge(s) are not shared by two facets. "
             "The volume below is unreliable for an open mesh."
    )

    report = (
        f"### {path.name}\n\n"
        f"| | |\n|---|---|\n"
        f"| Format | {info['format']} STL |\n"
        f"| Triangles | {info['triangles']:,} |\n"
        f"| Unique edges | {info['edges']:,} |\n"
        f"| Bounding box | {sx:.2f} × {sy:.2f} × {sz:.2f} mm |\n"
        f"| Surface area | {info['area'] / 100:,.1f} cm² |\n"
        f"| Volume | {info['volume'] / 1000:,.1f} cm³ |\n\n"
        f"{seal}"
    )

    stl = data.load_tool("stl")
    # System temp, not the repo: a render is scratch output and has no business
    # turning up in git status.
    png_path = Path(tempfile.gettempdir()) / "portfolio_stl_preview.png"
    png_path.write_bytes(data.ppm_to_png_bytes(stl.render_ppm(info["mesh"], 420)))
    return str(png_path), report


# --------------------------------------------------------------------------
# Interface
# --------------------------------------------------------------------------

with gr.Blocks(title=f"{data.PROFILE['name']} — Portfolio") as demo:
    gr.Markdown(f"# {data.PROFILE['name']}\n### {data.PROFILE['title']}\n\n{data.PROFILE['summary']}")

    with gr.Tabs():
        with gr.Tab("Overview"):
            gr.Markdown(overview_markdown())
            gr.Markdown("### Tool availability")
            gr.Dataframe(
                value=tool_status_rows(),
                headers=["Tool", "Path", "Status"],
                interactive=False,
                wrap=True,
            )

        with gr.Tab("Certifications"):
            gr.Markdown(
                f"### {len(_CERTS)} certifications\n"
                "Parsed live out of `index.html`, so this list is whatever the "
                "website currently says — it cannot go stale."
            )
            with gr.Row():
                cert_cats = gr.CheckboxGroup(_CATEGORIES, label="Category")
                cert_query = gr.Textbox(label="Search", placeholder="e.g. six sigma, solidworks")
            cert_count = gr.Markdown(f"Showing **{len(_CERTS)}** of {len(_CERTS)} certifications")
            cert_table = gr.Dataframe(
                value=[[c["name"], c["issuer"], c["category"]] for c in _CERTS],
                headers=["Certification", "Issuer", "Category"],
                interactive=False,
                wrap=True,
            )
            for control in (cert_cats, cert_query):
                control.change(filter_certs, [cert_cats, cert_query], [cert_table, cert_count])

        with gr.Tab("Py Compiler"):
            gr.Markdown(
                "### Python → JavaScript / C / Java / Go\n"
                "The real compiler: hand-written lexer, recursive-descent parser, "
                "multi-pass type inference, four code generators. It supports a "
                "deliberate subset of Python and rejects the rest with a line number."
            )
            with gr.Row():
                with gr.Column():
                    py_source = gr.Code(value=data.EXAMPLE_PYTHON, language="python", label="Python source")
                    py_targets = gr.CheckboxGroup(
                        list(LANG_LABELS.values()),
                        value=["JavaScript", "Go"],
                        label="Targets",
                    )
                    py_button = gr.Button("Compile", variant="primary")
                py_output = gr.Markdown()
            py_button.click(compile_python, [py_source, py_targets], py_output)

        with gr.Tab("STL Inspector"):
            gr.Markdown(
                "### STL geometry inspector\n"
                "The parser behind the CAD portfolio's 3D viewer. The preview is "
                "rendered by `stl_inspect.py` itself — a z-buffered software "
                "rasteriser, no 3D library involved."
            )
            with gr.Row():
                with gr.Column():
                    stl_upload = gr.File(label="Upload an STL", file_types=[".stl"], type="filepath")
                    stl_sample = gr.Dropdown(
                        sorted(_SAMPLES), label="…or pick one from the CAD portfolio",
                        value=next(iter(sorted(_SAMPLES)), None),
                    )
                    stl_button = gr.Button("Inspect", variant="primary")
                with gr.Column():
                    stl_image = gr.Image(label="Render", type="filepath")
                    stl_report = gr.Markdown()
            stl_button.click(inspect_stl, [stl_upload, stl_sample], [stl_image, stl_report])

        with gr.Tab("Text Tools"):
            with gr.Row():
                with gr.Column():
                    gr.Markdown(
                        "### Humanizer\n"
                        "Swaps stock AI-sounding phrasing for plainer wording. Every "
                        "rule is a row in `database.sql`."
                    )
                    hum_input = gr.Textbox(
                        label="Text to rewrite",
                        value="In today's fast-paced world, we utilize seamless solutions "
                              "to leverage synergies across the organization.",
                        lines=5,
                    )
                    hum_intensity = gr.Radio(["light", "medium", "full"], value="full", label="Intensity")
                    hum_button = gr.Button("Rewrite", variant="primary")
                    hum_output = gr.Textbox(label="Rewritten", lines=4)
                    hum_changes = gr.Dataframe(headers=["Before", "After"], interactive=False, wrap=True)

                with gr.Column():
                    gr.Markdown(
                        "### Slicer\n"
                        "Tags every word with its class from a plain-text word library, "
                        "with a disambiguation table for words that can be two things."
                    )
                    slice_input = gr.Textbox(
                        label="Sentence to slice",
                        value="The quick engineer carefully designed a remarkably strong bracket.",
                        lines=5,
                    )
                    slice_button = gr.Button("Slice", variant="primary")
                    slice_summary = gr.Markdown()
                    slice_table = gr.Dataframe(headers=["Token", "Class", "Source"], interactive=False, wrap=True)

            hum_button.click(humanize, [hum_input, hum_intensity], [hum_output, hum_changes])
            slice_button.click(slice_sentence, slice_input, [slice_table, slice_summary])

    gr.Markdown(
        "---\nEvery tool on this page runs locally against the files in this "
        f"repository. Nothing is uploaded and no API is called. · {data.PROFILE['email']}"
    )


if __name__ == "__main__":
    # Local only. No share=True: these tools read the local filesystem, and a
    # public tunnel would expose that.
    # theme belongs on launch() from Gradio 6 onward, not on Blocks().
    demo.launch(theme=gr.themes.Soft())
