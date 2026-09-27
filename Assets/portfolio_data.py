"""Shared data and tool loading for the Streamlit and Gradio portfolio apps.

Both apps present the same portfolio and drive the same tools, so all of that
lives here rather than being written twice and drifting apart.

Two things are worth knowing about how this works:

1.  The certification list is *parsed out of the real index.html* rather than
    retyped here. The website is the source of truth — if a certificate is
    added to the page, it appears in both apps with no edit to this file. A
    hand-copied list would be wrong within a month.

2.  The tool demos import the actual CLI modules from the portfolio folders and
    call the same functions the command line does. Nothing is reimplemented or
    faked for the demo, which means if a demo works here, the real tool works.
"""

from __future__ import annotations

import html
import importlib.util
import re
import sys
from pathlib import Path

# Assets/ lives directly under the repo root.
REPO_ROOT = Path(__file__).resolve().parent.parent

PROFILE = {
    "name": "Imaad Ullah Khan Yameen",
    "title": "Industrial Engineer · CAD/CAM/CAE · Applied AI",
    "summary": (
        "Industrial engineering graduate working across mechanical design, "
        "manufacturing and software. Six Sigma and ISO 9001 practitioner, "
        "SolidWorks designer, and the author of every tool in this portfolio — "
        "each one built from scratch, offline, and honest about what it does "
        "and does not do."
    ),
    "email": "yameenimaad@gmail.com",
    "github": "github.com/Danger-Khan",
    "site": "index.html",
}

# The eight sub-portfolios, each a real folder in Portfoilos/.
PORTFOLIOS = [
    {
        "name": "CAD / CAM / CAE",
        "folder": "Portfoilos/CADCAMCAE",
        "blurb": (
            "SolidWorks design, mold and mechanism engineering, CAM toolpaths, "
            "and 85 real STL exports — with an offline in-browser 3D viewer "
            "written from scratch."
        ),
        "highlights": [
            "42-part desktop filament recycler",
            "PCSIR injection mold design",
            "Custom STL parser + WebGL renderer, no library",
        ],
    },
    {
        "name": "AI & ML",
        "folder": "Portfoilos/AI & ML",
        "blurb": (
            "Regression, NLP, image processing and a testing harness — all "
            "implemented by hand and scored against known ground truth."
        ),
        "highlights": [
            "Least-squares / polynomial / multiple regression",
            "Lexicon sentiment, keyword extraction, word-class slicer",
            "Coordinate MLP trained in-browser with hand-written backprop",
        ],
    },
    {
        "name": "Programming",
        "folder": "Portfoilos/Programming",
        "blurb": (
            "A working compiler: lexer, recursive-descent parser, type "
            "inference, and four code generators."
        ),
        "highlights": [
            "Python subset → JavaScript, C, Java, Go",
            "Python-correct % and // semantics in every target",
            "SQL-backed cache of common programs",
        ],
    },
    {
        "name": "GIS & Remote Sensing",
        "folder": "Portfoilos/GIS & Remote Sensing",
        "blurb": "Spatial analysis and remote-sensing work.",
        "highlights": [],
    },
    {
        "name": "Embedded Systems & Circuitry",
        "folder": "Portfoilos/Embeded Systems & Circuitry",
        "blurb": "Microcontroller, PLC and circuit work.",
        "highlights": [],
    },
    {
        "name": "3D & Graphics Design",
        "folder": "Portfoilos/3D & Graphics Desginer",
        "blurb": "Visual design, branding and 3D rendering work.",
        "highlights": [],
    },
    {
        "name": "Gamer",
        "folder": "Portfoilos/Gamer",
        "blurb": (
            "The games played — and an arcade of six built from scratch on one "
            "shared engine, with no framework, sprites or audio files."
        ),
        "highlights": [
            "Fixed-timestep engine shared by all six games",
            "Procedural art and synthesised audio only",
        ],
    },
    {
        "name": "Claude Code",
        "folder": "Portfoilos/Claude Code",
        "blurb": "An honest build log of how this site was made.",
        "highlights": [],
    },
]


# --------------------------------------------------------------------------
# Certifications, parsed from the live page
# --------------------------------------------------------------------------

# Each card opens with this exact class list. Rather than trying to match a
# balanced </div> (which regex cannot do, and which an earlier version of this
# got wrong), the page is split on the opener and each card is everything up to
# the next one.
_CERT_OPEN = re.compile(r'<div class="industrial-card cert-item p-5">')
_CATEGORY = re.compile(r'<span class="text-\[8px\][^"]*"[^>]*>(.*?)</span>', re.S)
_NAME = re.compile(r'<h4 class="font-black uppercase text-xs mb-1">(.*?)</h4>', re.S)
_ISSUER = re.compile(r'<p class="text-\[10px\] opacity-60 uppercase">(.*?)</p>', re.S)


def _clean(raw: str) -> str:
    return html.unescape(re.sub(r"\s+", " ", raw)).strip()


def load_certifications(index_path: Path | None = None) -> list[dict]:
    """Pull the certification cards straight out of index.html.

    Returns [] rather than raising if the page moves or its markup changes —
    the apps should still run and show everything else. A silently empty list
    is visible in the UI, so this cannot hide a problem for long.
    """
    path = index_path or (REPO_ROOT / "index.html")
    try:
        source = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return []

    starts = [m.end() for m in _CERT_OPEN.finditer(source)]
    blocks = [
        source[start:(starts[i + 1] if i + 1 < len(starts) else start + 1200)]
        for i, start in enumerate(starts)
    ]

    certs = []
    for block in blocks:
        name = _NAME.search(block)
        if not name:
            continue
        issuer = _ISSUER.search(block)
        category = _CATEGORY.search(block)
        certs.append({
            "name": _clean(name.group(1)),
            "issuer": _clean(issuer.group(1)) if issuer else "—",
            "category": _clean(category.group(1)) if category else "General",
        })

    # The page duplicates nothing, but parsing is cheap insurance against it.
    seen = set()
    unique = []
    for cert in certs:
        key = (cert["name"], cert["issuer"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(cert)
    return unique


# --------------------------------------------------------------------------
# Loading the real tools
# --------------------------------------------------------------------------

TOOL_PATHS = {
    "compiler": "Portfoilos/Programming/Assets/Py Compiler/compiler_cli.py",
    "stl": "Portfoilos/CADCAMCAE/stl_inspect.py",
    "humanizer": "Portfoilos/AI & ML/Assets/NLP Models/Humanizer/backend_pipeline.py",
    "slicer": "Portfoilos/AI & ML/Assets/NLP Models/Slicer/AI/slicer_cli.py",
}

_cache: dict[str, object] = {}


def load_tool(name: str):
    """Import one of the portfolio's CLI modules by file path.

    They live in folders with spaces and ampersands in the name and are not on
    sys.path, so a normal import will not find them — hence importlib by
    location. Modules are cached because several of them build lookup tables on
    first import.
    """
    if name in _cache:
        return _cache[name]

    rel = TOOL_PATHS.get(name)
    if rel is None:
        raise KeyError(f"unknown tool {name!r}; expected one of {sorted(TOOL_PATHS)}")

    path = REPO_ROOT / rel
    if not path.is_file():
        raise FileNotFoundError(f"{rel} is missing — run this from inside the portfolio repo")

    spec = importlib.util.spec_from_file_location(f"portfolio_{name}", path)
    module = importlib.util.module_from_spec(spec)
    # Registered before exec so a module that imports itself by name still works.
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    _cache[name] = module
    return module


def tool_status() -> list[dict]:
    """Which tool demos can actually run right now. Shown in the apps, so a
    missing file is reported rather than blowing up a tab."""
    rows = []
    for name, rel in TOOL_PATHS.items():
        path = REPO_ROOT / rel
        row = {"tool": name, "path": rel, "ok": False, "detail": ""}
        if not path.is_file():
            row["detail"] = "file not found"
        else:
            try:
                load_tool(name)
                row["ok"] = True
                row["detail"] = "ready"
            except Exception as exc:  # a broken tool must not kill the app
                row["detail"] = f"{type(exc).__name__}: {exc}"
        rows.append(row)
    return rows


# --------------------------------------------------------------------------
# Demo wrappers — thin, so the apps stay presentation-only
# --------------------------------------------------------------------------

COMPILER_TARGETS = ["js", "c", "java", "go"]

EXAMPLE_PYTHON = '''def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

i = 0
while i < 8:
    print(fib(i))
    i = i + 1
'''


def run_compiler(source: str, targets: list[str]):
    """Returns (outputs_by_language, served_from_cache, error_message)."""
    compiler = load_tool("compiler")
    chosen = [t for t in targets if t in COMPILER_TARGETS] or ["js"]
    try:
        outputs, cached = compiler.compile_source(source, chosen)
        return outputs, cached, None
    except (compiler.LexError, compiler.ParseError,
            compiler.TypeError_, compiler.CodegenError) as exc:
        # These are the compiler telling us the input is not in its supported
        # subset. That is a result, not a crash — show it as written.
        return {}, False, str(exc)


def run_humanizer(text: str, intensity: str = "full"):
    """Returns (rewritten_text, [(before, after), ...])."""
    humanizer = load_tool("humanizer")
    humanizer.ensure_database()
    rules = humanizer.load_rules()
    return humanizer.humanize_text(text, rules, {"intensity": intensity})


def run_slicer(text: str):
    """Returns (tagged_tokens, category_counts, detected_tense). Each tagged
    token is (word, category, source) -- source is "nltk" for a word the
    hand-built lexicon didn't know and the CLI's optional NLTK fallback
    tagged instead, "lexicon" otherwise. detected_tense is a tense-rules.json
    record (see slicer_cli.detect_tense) or None."""
    slicer = load_tool("slicer")
    tagged, counts = slicer.slice_text(text)
    tense = slicer.detect_tense(slicer.tokenize(text))
    return tagged, counts, tense


def run_stl(path: Path):
    """Geometry report for one STL, matching what stl_inspect.py prints."""
    stl = load_tool("stl")
    mesh = stl.load(Path(path))
    lo, hi = stl.bounds(mesh)
    sealed, open_edges, edge_count = stl.watertight(mesh)
    return {
        "triangles": mesh.triangle_count,
        "format": "ASCII" if mesh.ascii_source else "binary",
        "size": tuple(hi[i] - lo[i] for i in range(3)),
        "area": stl.surface_area(mesh),
        "volume": abs(stl.signed_volume(mesh)),
        "sealed": sealed,
        "open_edges": open_edges,
        "edges": edge_count,
        "mesh": mesh,
    }


def find_stl_samples(limit: int = 40) -> list[Path]:
    """Real STL exports shipped with the CAD portfolio, smallest first so the
    demo opens something responsive rather than a 25 MB gear."""
    folder = REPO_ROOT / "Portfoilos/CADCAMCAE/Assets/CAD"
    if not folder.is_dir():
        return []
    files = [p for p in folder.rglob("*") if p.suffix.lower() == ".stl"]
    files.sort(key=lambda p: p.stat().st_size)
    return files[:limit]


def ppm_to_png_bytes(ppm: bytes) -> bytes:
    """Convert stl_inspect's PPM output to PNG.

    Written out longhand with zlib rather than pulling in Pillow: it is about
    fifteen lines, and it keeps these apps installable with nothing but
    streamlit or gradio.
    """
    import struct
    import zlib

    parts = ppm.split(b"\n", 3)
    width, height = map(int, parts[1].split())
    pixels = parts[3]
    raw = b"".join(
        b"\x00" + pixels[y * width * 3:(y + 1) * width * 3] for y in range(height)
    )

    def chunk(tag: bytes, data: bytes) -> bytes:
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
