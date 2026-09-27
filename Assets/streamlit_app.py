"""Streamlit front end for the portfolio.

Run it from the repository root (or anywhere — paths are resolved relative to
this file):

    pip install streamlit
    streamlit run "Assets/streamlit_app.py"

It is not a brochure. The tool tabs import the portfolio's actual CLI modules
and call the same functions the command line calls, so what you get here is the
real compiler, the real STL parser, the real rewriter — not a canned demo. If
something is broken in the tool, it is broken here too, which is the point.

The Gradio version in gradio_app.py shows the same things through a different
framework; both read from portfolio_data.py so neither can drift.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

import streamlit as st

import portfolio_data as data

st.set_page_config(
    page_title=f"{data.PROFILE['name']} — Portfolio",
    page_icon="⚙️",
    layout="wide",
)


# --------------------------------------------------------------------------
# Cached loaders — parsing the page and importing tools should happen once
# --------------------------------------------------------------------------

@st.cache_data(show_spinner=False)
def certifications():
    return data.load_certifications()


@st.cache_data(show_spinner=False)
def stl_samples():
    return [str(p) for p in data.find_stl_samples()]


# --------------------------------------------------------------------------
# Sidebar
# --------------------------------------------------------------------------

with st.sidebar:
    st.title(data.PROFILE["name"])
    st.caption(data.PROFILE["title"])
    st.write(data.PROFILE["summary"])
    st.divider()
    st.markdown(f"**Email** · {data.PROFILE['email']}")
    st.markdown(f"**GitHub** · {data.PROFILE['github']}")
    st.divider()
    st.caption("Tool availability")
    for row in data.tool_status():
        st.write(("✅ " if row["ok"] else "⚠️ ") + f"`{row['tool']}` — {row['detail']}")


tabs = st.tabs([
    "Overview",
    "Certifications",
    "Py Compiler",
    "STL Inspector",
    "Text Tools",
])


# --------------------------------------------------------------------------
# Overview
# --------------------------------------------------------------------------

with tabs[0]:
    st.header("Eight sub-portfolios")
    st.write(
        "Each one is a real folder in this repository with working code in it, "
        "not a case-study write-up."
    )

    columns = st.columns(2)
    for i, item in enumerate(data.PORTFOLIOS):
        with columns[i % 2]:
            with st.container(border=True):
                st.subheader(item["name"])
                st.write(item["blurb"])
                for highlight in item["highlights"]:
                    st.markdown(f"- {highlight}")
                exists = (data.REPO_ROOT / item["folder"]).is_dir()
                st.caption(f"`{item['folder']}`" + ("" if exists else "  — folder not found"))


# --------------------------------------------------------------------------
# Certifications
# --------------------------------------------------------------------------

with tabs[1]:
    certs = certifications()
    st.header(f"{len(certs)} certifications")

    if not certs:
        st.warning(
            "No certifications parsed from index.html. The page markup may have "
            "changed — see load_certifications() in portfolio_data.py."
        )
    else:
        st.caption(
            "Parsed live from index.html, so this list is whatever the website "
            "currently says — it cannot go stale."
        )

        categories = sorted({c["category"] for c in certs})
        col_a, col_b = st.columns([2, 3])
        with col_a:
            chosen = st.multiselect("Category", categories, default=[])
        with col_b:
            query = st.text_input("Search", placeholder="e.g. six sigma, solidworks")

        shown = [
            c for c in certs
            if (not chosen or c["category"] in chosen)
            and (not query or query.lower() in f"{c['name']} {c['issuer']}".lower())
        ]

        st.write(f"Showing **{len(shown)}** of {len(certs)}")
        st.dataframe(
            [{"Certification": c["name"], "Issuer": c["issuer"], "Category": c["category"]}
             for c in shown],
            width='stretch',
            hide_index=True,
        )

        st.subheader("By category")
        counts: dict[str, int] = {}
        for c in certs:
            counts[c["category"]] = counts.get(c["category"], 0) + 1
        st.bar_chart(counts)


# --------------------------------------------------------------------------
# Py Compiler
# --------------------------------------------------------------------------

with tabs[2]:
    st.header("Python → JavaScript / C / Java / Go")
    st.write(
        "The real compiler from `Portfoilos/Programming/Assets/Py Compiler`: a "
        "hand-written lexer, a recursive-descent parser, multi-pass type "
        "inference, and four code generators. It supports a deliberate subset "
        "of Python — anything outside it is a clear compile error rather than a "
        "quietly wrong translation."
    )

    source = st.text_area("Python source", value=data.EXAMPLE_PYTHON, height=240)
    targets = st.multiselect(
        "Targets", data.COMPILER_TARGETS, default=["js", "go"],
        format_func=lambda t: {"js": "JavaScript", "c": "C", "java": "Java", "go": "Go"}[t],
    )

    if st.button("Compile", type="primary"):
        outputs, cached, error = data.run_compiler(source, targets)
        if error:
            st.error(f"Compile error — {error}")
            st.caption(
                "This is the compiler refusing to guess. Every construct it "
                "cannot translate faithfully is rejected with the line number."
            )
        else:
            if cached:
                st.info("Served from the magic_lines cache — an exact match, so the pipeline was skipped.")
            for lang, code in outputs.items():
                label = {"js": "JavaScript", "c": "C", "java": "Java", "go": "Go"}[lang]
                st.subheader(label)
                st.code(code, language={"js": "javascript", "c": "c", "java": "java", "go": "go"}[lang])


# --------------------------------------------------------------------------
# STL inspector
# --------------------------------------------------------------------------

with tabs[3]:
    st.header("STL geometry inspector")
    st.write(
        "The parser behind the CAD portfolio's 3D viewer, reporting real "
        "geometry: triangle count, bounding box, surface area, volume by the "
        "tetrahedron sum, and whether the mesh is watertight — which is what "
        "decides if a part is actually printable."
    )

    samples = stl_samples()
    uploaded = st.file_uploader("Upload an STL", type=["stl"])
    chosen_path = None

    if samples:
        pick = st.selectbox(
            "…or pick one from the CAD portfolio",
            samples,
            format_func=lambda p: Path(p).name,
        )
        chosen_path = pick
    else:
        st.warning("No STL files found under Portfoilos/CADCAMCAE/Assets/CAD.")

    target_path = None
    if uploaded is not None:
        # System temp, not the repo: an uploaded file is scratch data and has no
        # business turning up in git status.
        tmp = Path(tempfile.gettempdir()) / "portfolio_uploaded.stl"
        tmp.write_bytes(uploaded.getbuffer())
        target_path = tmp
    elif chosen_path:
        target_path = Path(chosen_path)

    if target_path and st.button("Inspect", type="primary"):
        try:
            info = data.run_stl(target_path)
        except Exception as exc:
            st.error(f"Could not read that file — {exc}")
        else:
            cols = st.columns(4)
            cols[0].metric("Triangles", f"{info['triangles']:,}")
            cols[1].metric("Format", info["format"])
            cols[2].metric("Surface", f"{info['area'] / 100:,.1f} cm²")
            cols[3].metric("Volume", f"{info['volume'] / 1000:,.1f} cm³")

            sx, sy, sz = info["size"]
            st.write(f"**Bounding box** {sx:.2f} × {sy:.2f} × {sz:.2f} mm")

            if info["sealed"]:
                st.success("Watertight — every edge is shared by exactly two facets, so this can be sliced.")
            else:
                st.warning(
                    f"Not watertight — {info['open_edges']:,} edge(s) are not shared by two "
                    "facets. The volume above is unreliable for an open mesh."
                )

            with st.spinner("Rendering…"):
                stl = data.load_tool("stl")
                png = data.ppm_to_png_bytes(stl.render_ppm(info["mesh"], 420))
            st.image(png, caption=f"{target_path.name} — rendered by stl_inspect.py, no 3D library")


# --------------------------------------------------------------------------
# Text tools
# --------------------------------------------------------------------------

with tabs[4]:
    st.header("Text tools")

    left, right = st.columns(2)

    with left:
        st.subheader("Humanizer")
        st.caption(
            "Swaps stock AI-sounding phrasing for plainer wording. Every rule is "
            "a row in database.sql, so the changes are reviewable data."
        )
        humanizer_input = st.text_area(
            "Text to rewrite",
            value="In today's fast-paced world, we utilize seamless solutions to "
                  "leverage synergies across the organization.",
            height=150,
            key="hum_in",
        )
        intensity = st.select_slider("Intensity", ["light", "medium", "full"], value="full")

        if st.button("Rewrite"):
            try:
                rewritten, changes = data.run_humanizer(humanizer_input, intensity)
            except Exception as exc:
                st.error(f"Humanizer failed — {exc}")
            else:
                st.success(rewritten)
                if changes:
                    st.caption(f"{len(changes)} substitution(s)")
                    st.dataframe(
                        [{"Before": a, "After": b} for a, b in changes],
                        width='stretch', hide_index=True,
                    )
                else:
                    st.caption("No rule matched — the text was left exactly as written.")

    with right:
        st.subheader("Slicer")
        st.caption(
            "Tags every word with its class from a plain-text word library, with "
            "a small disambiguation table for words that can be two things."
        )
        slicer_input = st.text_area(
            "Sentence to slice",
            value="The quick engineer carefully designed a remarkably strong bracket.",
            height=150,
            key="slice_in",
        )

        if st.button("Slice"):
            try:
                tagged, counts, tense = data.run_slicer(slicer_input)
            except Exception as exc:
                st.error(f"Slicer failed — {exc}")
            else:
                st.caption(f"Detected tense: **{tense['label']}** — {tense['structure']}" if tense else "Detected tense: not detected")
                st.dataframe(
                    [{"Token": t, "Class": c, "Source": s} for t, c, s in tagged],
                    width='stretch', hide_index=True, height=260,
                )
                st.bar_chart(counts)
                if counts.get("unclassified"):
                    st.caption(
                        f"{counts['unclassified']} token(s) unclassified — the word "
                        "library is finite and says so rather than guessing."
                    )

st.divider()
st.caption(
    "Every tool on this page runs locally against the files in this repository. "
    "Nothing is uploaded and no API is called."
)
