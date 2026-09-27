#!/usr/bin/env python3
"""Build the professional portfolio document as a .docx.

    python3 "Assets/PDF Files/build_portfolio_docx.py"

Why it is generated rather than typed:

The content is read out of the site itself — work history, internships,
projects, education and skills from Assets/resume/cv.html, and the
certification list from index.html. The website is the single source of truth,
so re-running this after updating the site produces a current document instead
of one that quietly drifts out of date. That is the same rule the rest of this
repository follows.

Why there is no python-docx:

A .docx is a ZIP of XML parts, and writing those parts directly is a few
hundred lines with no dependency at all. Everything else in this portfolio runs
on the standard library, and the document generator had no good reason to be
the exception.

Formatting decisions follow current ATS (applicant tracking system) guidance,
because this file is meant to survive being uploaded to a job portal:

  * single column, no tables, no text boxes, no sidebars, no images — multi
    column layouts and floating boxes are the most common cause of a document
    parsing into nonsense;
  * contact details in the body, never in a header or footer, which many
    parsers do not read at all;
  * standard section headings ("Professional Summary", "Work Experience",
    "Education", "Technical Skills", "Certifications") that parsers recognise;
  * Calibri 11pt body text;
  * real Word bullet lists, so the bullet glyph lives in the numbering
    definition rather than being a literal character inside the text;
  * full month-and-year dates.

Sources for that guidance are listed in the module docstring of the repository
commit and summarised here: single-column .docx or text PDF, standard fonts at
10.5-12pt, standard headings, plain bullets, no tables/columns/icons/photos.
"""

from __future__ import annotations

import datetime as _dt
import html
import re
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent
CV_PATH = REPO_ROOT / "Assets" / "resume" / "cv.html"
INDEX_PATH = REPO_ROOT / "index.html"
OUTPUT = HERE / "Imaad_Yameen_Professional_Portfolio.docx"

NAME = "Imaad Ullah Khan Yameen"
HEADLINE = "Industrial Engineer | CAD Designer | FDM/FFF | Six Sigma Yellow & White Belt"
EMAIL = "yameenimaad@gmail.com"
GITHUB = "github.com/Danger-Khan"
LOCATION = "Peshawar, Khyber Pakhtunkhwa, Pakistan"

SUMMARY = (
    "Industrial engineering graduate (BSc, UET Peshawar, CGPA 3.75/4.00) working across "
    "mechanical design, manufacturing process improvement and applied software. Experience "
    "spans SolidWorks mold and fixture design, FDM/FFF additive manufacturing, CNC machine "
    "operation and calibration, Lean Six Sigma process work, and GIS/remote sensing analysis. "
    "Designed and built an autonomous UAV inventory system that improved warehouse inspection "
    "efficiency by 25% at a Pepsi Cola franchise bottling plant, and a circular-economy rPET "
    "recycling system with a custom extrusion architecture. Also the sole author of an eight-module "
    "technical portfolio of working software — a Python-to-four-language compiler, an offline STL "
    "viewer with a from-scratch WebGL renderer, NLP and image-processing models, and a browser "
    "game engine — every one implemented without third-party libraries."
)


# --------------------------------------------------------------------------
# Reading the site
# --------------------------------------------------------------------------

def _visible_lines(fragment: str) -> list[str]:
    """Tags to newlines, entities decoded, blanks dropped."""
    text = html.unescape(re.sub(r"<[^>]+>", "\n", fragment))
    return [line.strip() for line in text.split("\n") if line.strip()]


def read_cv_sections() -> dict[str, list[str]]:
    source = CV_PATH.read_text(encoding="utf-8")
    source = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", source, flags=re.S)
    parts = re.split(r"<h3[^>]*>(.*?)</h3>", source, flags=re.S)

    sections: dict[str, list[str]] = {}
    for i in range(1, len(parts), 2):
        title = html.unescape(re.sub(r"<[^>]+>", "", parts[i])).strip()
        body = parts[i + 1] if i + 1 < len(parts) else ""
        sections[title] = _visible_lines(body)
    return sections


_DATE_LINE = re.compile(r"^\d{4}\.\d{2}\s*[-–]\s*(\d{4}\.\d{2}|Current)$")


def parse_roles(lines: list[str]) -> list[dict]:
    """Split a Work/Internship block into roles.

    The CV renders each role as: title, then a date range, then the employer
    line, then bullets, then a trailing "Skills: ..." line. The date line is the
    only unambiguous marker, so a new role is declared wherever the *next* line
    is a date range.
    """
    starts = [i for i in range(len(lines) - 1) if _DATE_LINE.match(lines[i + 1])]
    roles = []
    for n, start in enumerate(starts):
        end = starts[n + 1] if n + 1 < len(starts) else len(lines)
        block = lines[start:end]
        if len(block) < 3:
            continue
        roles.append({
            "title": block[0],
            "dates": format_dates(block[1]),
            "employer": block[2],
            "bullets": [b for b in block[3:] if not b.lower().startswith("skills:")],
            "skills": next((b[len("skills:"):].strip() for b in block[3:]
                            if b.lower().startswith("skills:")), ""),
        })
    return roles


MONTHS = ["", "January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"]


def format_dates(raw: str) -> str:
    """2024.09 - 2025.08  ->  September 2024 - August 2025.

    ATS parsers are markedly better at full month names than at numeric
    shorthand, and this is the only place the conversion is needed.
    """
    def one(token: str) -> str:
        token = token.strip()
        if token.lower() == "current":
            return "Present"
        match = re.match(r"(\d{4})\.(\d{2})", token)
        if not match:
            return token
        year, month = match.group(1), int(match.group(2))
        return f"{MONTHS[month]} {year}" if 1 <= month <= 12 else token

    pieces = re.split(r"\s*[-–]\s*", raw)
    return " - ".join(one(p) for p in pieces)


def parse_projects(lines: list[str]) -> list[dict]:
    """Projects render as: name, a short badge, a description, then hashtags.

    A new project therefore begins on the first non-hashtag line after a run of
    hashtags.
    """
    projects = []
    current: dict | None = None
    for line in lines:
        if line.startswith("#"):
            if current is not None:
                current["tags"].append(line.lstrip("#").replace("_", " "))
            continue
        if current is None or current["tags"]:
            if current is not None:
                projects.append(current)
            current = {"name": line, "badge": "", "description": "", "tags": []}
        elif not current["badge"]:
            current["badge"] = line
        else:
            current["description"] = (current["description"] + " " + line).strip()
    if current is not None:
        projects.append(current)
    return [p for p in projects if p["description"]]


def read_certifications() -> list[dict]:
    """Certification cards from the live index.html."""
    source = INDEX_PATH.read_text(encoding="utf-8", errors="replace")
    opens = [m.end() for m in re.finditer(r'<div class="industrial-card cert-item p-5">', source)]
    name_re = re.compile(r'<h4 class="font-black uppercase text-xs mb-1">(.*?)</h4>', re.S)
    issuer_re = re.compile(r'<p class="text-\[10px\] opacity-60 uppercase">(.*?)</p>', re.S)
    category_re = re.compile(r'<span class="text-\[8px\][^"]*"[^>]*>(.*?)</span>', re.S)

    certs = []
    for i, start in enumerate(opens):
        block = source[start:(opens[i + 1] if i + 1 < len(opens) else start + 1200)]
        name = name_re.search(block)
        if not name:
            continue
        issuer = issuer_re.search(block)
        category = category_re.search(block)
        clean = lambda m: html.unescape(re.sub(r"\s+", " ", m.group(1))).strip()
        certs.append({
            "name": clean(name),
            "issuer": clean(issuer) if issuer else "",
            "category": clean(category) if category else "General",
        })
    return certs


# --------------------------------------------------------------------------
# Minimal OOXML writer
# --------------------------------------------------------------------------

W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'


def run(text: str, *, bold=False, italic=False, size=None, color=None) -> str:
    props = []
    if bold:
        props.append("<w:b/>")
    if italic:
        props.append("<w:i/>")
    if color:
        props.append(f'<w:color w:val="{color}"/>')
    if size:
        half = int(size * 2)
        props.append(f'<w:sz w:val="{half}"/><w:szCs w:val="{half}"/>')
    rpr = f"<w:rPr>{''.join(props)}</w:rPr>" if props else ""
    # xml:space="preserve" keeps meaningful leading/trailing spaces.
    return f'<w:r>{rpr}<w:t xml:space="preserve">{escape(text)}</w:t></w:r>'


def para(runs: str, *, style=None, space_before=0, space_after=80, align=None) -> str:
    props = []
    if style:
        props.append(f'<w:pStyle w:val="{style}"/>')
    if align:
        props.append(f'<w:jc w:val="{align}"/>')
    props.append(f'<w:spacing w:before="{space_before}" w:after="{space_after}"/>')
    return f"<w:p><w:pPr>{''.join(props)}</w:pPr>{runs}</w:p>"


def bullet(text: str) -> str:
    """A real Word list item — the glyph comes from numbering.xml, so the
    document text stays clean for a parser."""
    props = (
        '<w:pStyle w:val="ListParagraph"/>'
        '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'
        '<w:spacing w:before="0" w:after="60"/>'
        '<w:ind w:left="360" w:hanging="360"/>'
    )
    return f"<w:p><w:pPr>{props}</w:pPr>{run(text)}</w:p>"


def heading(text: str) -> str:
    """Section heading. A horizontal rule underneath is drawn as a paragraph
    border, not a table or a drawn shape, so nothing here confuses a parser."""
    props = (
        '<w:pStyle w:val="Heading1"/>'
        '<w:spacing w:before="280" w:after="120"/>'
        '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="999999"/></w:pBdr>'
    )
    return f"<w:p><w:pPr>{props}</w:pPr>{run(text.upper(), bold=True, size=12)}</w:p>"


STYLES_XML = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles {W_NS}>
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
      <w:sz w:val="22"/><w:szCs w:val="22"/>
    </w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/><w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:pPr><w:outlineLvl w:val="0"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:pPr><w:outlineLvl w:val="1"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="23"/><w:szCs w:val="23"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/>
  </w:style>
</w:styles>"""

NUMBERING_XML = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering {W_NS}>
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="&#8226;"/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr>
      <w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>"""

CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>"""

ROOT_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>"""

DOC_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>"""

APP_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
            xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>build_portfolio_docx.py</Application>
</Properties>"""


def core_xml() -> str:
    now = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                   xmlns:dc="http://purl.org/dc/elements/1.1/"
                   xmlns:dcterms="http://purl.org/dc/terms/"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>{escape(NAME)} - Professional Portfolio</dc:title>
  <dc:creator>{escape(NAME)}</dc:creator>
  <cp:lastModifiedBy>{escape(NAME)}</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>
</cp:coreProperties>"""


# --------------------------------------------------------------------------
# Document body
# --------------------------------------------------------------------------

def build_body() -> str:
    sections = read_cv_sections()
    work = parse_roles(sections.get("Work Experience", []))
    interns = parse_roles(sections.get("Internship Experience", []))
    projects = parse_projects(sections.get("Projects", []))
    tech = [s.replace("_", " ") for s in sections.get("Technical Skills", [])]
    soft = [s.replace("_", " ") for s in sections.get("Skill Set", [])]
    education = sections.get("Education", [])
    certs = read_certifications()

    out: list[str] = []

    # --- header: plain body paragraphs, never a real header ---
    out.append(para(run(NAME, bold=True, size=20), space_after=40, align="center"))
    out.append(para(run(HEADLINE, size=11), space_after=40, align="center"))
    out.append(para(
        run(f"{EMAIL}  |  {GITHUB}  |  {LOCATION}", size=10),
        space_after=160, align="center",
    ))

    out.append(heading("Professional Summary"))
    out.append(para(run(SUMMARY)))

    out.append(heading("Technical Skills"))
    out.append(para(run("Engineering & Design Software: ", bold=True) + run(", ".join(
        s for s in tech if s in {
            "SolidWorks", "Fusion360", "AutoCAD", "Ultimaker Cura", "Prusa Slicer",
            "Orca Slicer", "Bambulab Studio", "Arena Sim"}))))
    out.append(para(run("Analysis & Project Management: ", bold=True) + run(", ".join(
        s for s in tech if s in {
            "Minitab SPSS", "Matlab Octave", "MS Project", "Primavera P6", "MS Office"}))))
    out.append(para(run("Software & Programming: ", bold=True) + run(
        "Python, JavaScript, SQL, Perl, VS Code, Git")))
    out.append(para(run("Creative & Media: ", bold=True) + run(", ".join(
        s for s in tech if s in {
            "DaVinci Resolve", "Canva Affinity", "Adobe Illustrator", "Snapseed"}))))
    out.append(para(run("Methodologies: ", bold=True) + run(", ".join(soft))))

    out.append(heading("Work Experience"))
    for role in work:
        out.append(para(run(role["title"], bold=True, size=11.5), space_before=120, space_after=0))
        out.append(para(run(role["employer"], italic=True, size=10.5) + run("   ") +
                        run(role["dates"], size=10.5), space_after=60))
        for line in role["bullets"]:
            out.append(bullet(line))
        if role["skills"]:
            out.append(para(run("Key skills: ", bold=True, size=10) +
                            run(role["skills"], size=10), space_after=100))

    out.append(heading("Internship & Project Leadership Experience"))
    for role in interns:
        out.append(para(run(role["title"], bold=True, size=11.5), space_before=120, space_after=0))
        out.append(para(run(role["employer"], italic=True, size=10.5) + run("   ") +
                        run(role["dates"], size=10.5), space_after=60))
        for line in role["bullets"]:
            out.append(bullet(line))
        if role["skills"]:
            out.append(para(run("Key skills: ", bold=True, size=10) +
                            run(role["skills"], size=10), space_after=100))

    out.append(heading("Engineering Projects"))
    for project in projects:
        label = project["name"]
        if project["badge"]:
            label += f" ({project['badge']})"
        out.append(para(run(label, bold=True, size=11.5), space_before=120, space_after=0))
        out.append(para(run(project["description"]), space_after=40))
        if project["tags"]:
            out.append(para(run("Focus: ", bold=True, size=10) +
                            run(", ".join(project["tags"]), size=10), space_after=100))

    out.append(heading("Technical Portfolio (Software Built From Scratch)"))
    out.append(para(run(
        "An eight-module portfolio of working software, written without third-party "
        "libraries and runnable offline. Source at " + GITHUB + "."
    )))
    for title, detail in [
        ("Py Compiler",
         "A working compiler for a subset of Python: hand-written lexer, recursive-descent "
         "parser, multi-pass type inference, and four independent code generators targeting "
         "JavaScript, C, Java and Go, with Python-correct modulo and floor-division semantics "
         "preserved in every target."),
        ("CAD/CAM/CAE portfolio and STL viewer",
         "SolidWorks design work including a 42-part filament recycler and an injection mold "
         "for PCSIR, published with an in-browser 3D viewer built from scratch — an STL parser, "
         "a WebGL renderer and a software rasteriser fallback, with no 3D library."),
        ("AI & ML models",
         "Regression (least squares, polynomial, multiple) scored on held-out splits, lexicon "
         "sentiment analysis, a word-class slicer, k-means colour extraction, and a coordinate "
         "MLP trained in-browser with hand-written backpropagation."),
        ("Web game engine",
         "A fixed-timestep browser game engine and six games built on it, with procedurally "
         "drawn artwork and synthesised audio rather than asset files."),
    ]:
        out.append(para(run(title, bold=True, size=11), space_before=100, space_after=20))
        out.append(para(run(detail), space_after=80))

    out.append(heading("Education"))
    if education:
        out.append(para(run(education[0], bold=True, size=11.5), space_after=0))
        rest = " | ".join(education[1:]).replace("CGPA: |", "CGPA:").replace("| CGPA:", "| CGPA:")
        out.append(para(run(rest, size=10.5)))

    out.append(heading("Certifications"))
    by_category: dict[str, list[dict]] = {}
    for cert in certs:
        by_category.setdefault(cert["category"], []).append(cert)
    out.append(para(run(
        f"{len(certs)} industry certifications across {len(by_category)} areas. "
        "Full verified list at " + GITHUB + "."
    )))
    for category in sorted(by_category, key=lambda c: (-len(by_category[c]), c)):
        items = by_category[category]
        names = "; ".join(item["name"] for item in items)
        out.append(para(run(f"{category} ({len(items)}): ", bold=True, size=10.5) +
                        run(names, size=10.5), space_after=70))

    # Letter portrait, one-inch margins — the default a parser expects.
    out.append(
        '<w:sectPr>'
        '<w:pgSz w:w="12240" w:h="15840"/>'
        '<w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" '
        'w:header="720" w:footer="720" w:gutter="0"/>'
        '</w:sectPr>'
    )

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<w:document {W_NS}><w:body>{"".join(out)}</w:body></w:document>'
    )


def main() -> int:
    if not CV_PATH.is_file():
        print(f"missing {CV_PATH}")
        return 1

    document = build_body()

    with zipfile.ZipFile(OUTPUT, "w", zipfile.ZIP_DEFLATED) as docx:
        docx.writestr("[Content_Types].xml", CONTENT_TYPES)
        docx.writestr("_rels/.rels", ROOT_RELS)
        docx.writestr("docProps/core.xml", core_xml())
        docx.writestr("docProps/app.xml", APP_XML)
        docx.writestr("word/_rels/document.xml.rels", DOC_RELS)
        docx.writestr("word/document.xml", document)
        docx.writestr("word/styles.xml", STYLES_XML)
        docx.writestr("word/numbering.xml", NUMBERING_XML)

    size_kb = OUTPUT.stat().st_size / 1024
    print(f"wrote {OUTPUT.relative_to(REPO_ROOT)}  ({size_kb:.1f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
