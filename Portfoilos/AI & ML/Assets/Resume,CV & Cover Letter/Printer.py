#!/usr/bin/env python3
"""
Printer.py — command-line companion to Index.html / Builder.js.

Index.html builds a resume/CV/cover letter draft in the browser and can
export it as JSON via the "Export Draft (JSON)" button. This script reads
that exact same JSON shape and formats it as plain text, so the same draft
can be regenerated from a terminal without opening a browser at all.

Usage:
    python Printer.py draft.json                 # print every format
    python Printer.py draft.json --type resume    # just the resume
    python Printer.py draft.json --type cv
    python Printer.py draft.json --type cover
    python Printer.py draft.json --type ats       # ATS-friendly plain resume
    python Printer.py draft.json --type europass   # Europass CV
    python Printer.py draft.json --type japanese   # Japanese rirekisho (履歴書)
    python Printer.py draft.json --type spanish    # Spanish resume
    python Printer.py draft.json --type french     # French resume
    python Printer.py draft.json --type russian    # Russian resume
    python Printer.py draft.json --type german     # German resume
    python Printer.py draft.json --out out_dir    # write .txt files instead of printing
"""

import argparse
import json
import re
import sys
import textwrap
from datetime import date
from pathlib import Path

# Windows consoles default to a legacy codepage that can't render the
# em dash used below; force UTF-8 so the output looks right everywhere.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")

WRAP_WIDTH = 78


def load_dictionary(code):
    """EN-><lang> word glossary shared with the browser build. Reads the same
    translation/<code>-dictionary.json that <code>-dictionary.js mirrors for
    the browser build, so the CLI and the live preview stay in sync."""
    path = Path(__file__).resolve().parent / "translation" / f"{code}-dictionary.json"
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}
    data.pop("_comment", None)
    return data


DICTIONARIES = {code: load_dictionary(code) for code in ("ja", "es", "fr", "ru", "de")}
_DICT_KEYS = {code: sorted(d, key=len, reverse=True) for code, d in DICTIONARIES.items()}


def translate_words(text, code):
    """Annotates recognized whole words with their translated equivalent in
    parentheses -- a plain dictionary lookup, not machine translation, so
    proper nouns (names, companies, schools) are correctly left untouched."""
    dictionary = DICTIONARIES.get(code)
    if not text or not dictionary:
        return text
    result = str(text)
    for word in _DICT_KEYS[code]:
        pattern = re.compile(r"\b(" + re.escape(word) + r")\b", re.IGNORECASE)
        result = pattern.sub(lambda m: m.group(0) + f" ({dictionary[word]})", result)
    return result


def load_draft(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        sys.exit(f"error: no such file: {path}")
    except json.JSONDecodeError as e:
        sys.exit(f"error: {path} is not valid JSON ({e})")


def wrap(text, indent=""):
    if not text:
        return ""
    return "\n".join(
        textwrap.fill(line, width=WRAP_WIDTH, initial_indent=indent, subsequent_indent=indent)
        for line in str(text).splitlines()
    )


def section(title):
    return f"\n{title.upper()}\n{'-' * len(title)}"


def bullets(text, indent="  "):
    lines = [l.strip() for l in str(text or "").splitlines() if l.strip()]
    return "\n".join(f"{indent}- {l}" for l in lines)


def split_date_range(dates_str):
    """('2023 — Present', True) style ranges -> (start, end, ongoing)."""
    s = str(dates_str or "").strip()
    if not s:
        return "", "", False
    parts = [p for p in re.split(r"\s*(?:—|-|to)\s*", s, flags=re.IGNORECASE) if p]
    start = parts[0] if parts else ""
    end = parts[1] if len(parts) > 1 else ""
    ongoing = not end or bool(re.search(r"present|current|now|ongoing", end, re.IGNORECASE))
    return start, ("" if ongoing else end), ongoing


def calc_age(dob_str):
    if not dob_str:
        return None
    try:
        dob = date.fromisoformat(str(dob_str)[:10])
    except ValueError:
        return None
    today = date.today()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    return age


def format_resume_or_cv(data, is_cv):
    out = []
    name = data.get("name") or "Your Name"
    out.append(name)
    out.append("=" * len(name))

    title = data.get("title")
    if title:
        out.append(title)

    contact_bits = [data.get(k) for k in ("email", "phone", "location", "links") if data.get(k)]
    if contact_bits:
        out.append("  |  ".join(contact_bits))

    summary = data.get("summary")
    if summary:
        out.append(section("Summary"))
        out.append(wrap(summary))

    experience = [e for e in data.get("experience", []) if e.get("role") or e.get("company")]
    if experience:
        out.append(section("Experience"))
        for e in experience:
            head = e.get("role") or "Role"
            if e.get("company"):
                head += f" — {e['company']}"
            out.append(head)
            if e.get("dates"):
                out.append(f"  ({e['dates']})")
            b = bullets(e.get("bullets"))
            if b:
                out.append(b)
            out.append("")

    education = [e for e in data.get("education", []) if e.get("degree") or e.get("school")]
    if education:
        out.append(section("Education"))
        for e in education:
            head = e.get("degree") or "Degree"
            if e.get("school"):
                head += f" — {e['school']}"
            out.append(head)
            if e.get("dates"):
                out.append(f"  ({e['dates']})")
        out.append("")

    skills = data.get("skills")
    if skills:
        out.append(section("Skills"))
        out.append(wrap(skills))

    if is_cv and data.get("extra"):
        out.append(section("Certifications, Publications & Projects"))
        out.append(bullets(data.get("extra")))

    return "\n".join(out).strip() + "\n"


def format_cover_letter(data):
    out = []
    name = data.get("name") or "Your Name"
    out.append(name)
    contact_bits = [data.get(k) for k in ("email", "phone", "location") if data.get(k)]
    if contact_bits:
        out.append("  |  ".join(contact_bits))
    out.append("")
    out.append(date.today().strftime("%B %d, %Y"))
    out.append("")

    hiring = data.get("coHiring") or "Hiring Manager"
    company = data.get("coCompany")
    out.append(hiring + (f"\n{company}" if company else ""))
    out.append("")
    out.append(f"Dear {hiring},")
    out.append("")

    opening = data.get("coOpen")
    if not opening and data.get("coRole") and company:
        opening = f"I am writing to apply for the {data['coRole']} position at {company}."
    if opening:
        out.append(wrap(opening))
        out.append("")

    body = data.get("coBody") or data.get("summary")
    if body:
        out.append(wrap(body))
        out.append("")

    closing = data.get("coClose") or (
        "Thank you for your time and consideration. I would welcome the "
        "chance to discuss how I can contribute to the team."
    )
    out.append(wrap(closing))
    out.append("")
    out.append(f"Sincerely,\n{name}")

    return "\n".join(out).strip() + "\n"


def format_ats(data):
    """Single column, plain labels, Summary/Skills/Experience/Education order —
    the layout ATS parsers are most reliably tuned for."""
    out = []
    name = data.get("name") or "Your Name"
    out.append(name)
    out.append("=" * len(name))

    contact_labels = (
        ("email", "Email Address"),
        ("phone", "Phone Number"),
        ("location", "Address"),
        ("links", "LinkedIn / Portfolio / GitHub"),
    )
    for key, label in contact_labels:
        if data.get(key):
            out.append(f"{label}: {data[key]}")

    if data.get("summary"):
        out.append(section("Summary"))
        out.append(wrap(data["summary"]))

    if data.get("skills"):
        out.append(section("Skills"))
        out.append(wrap(data["skills"]))

    experience = [e for e in data.get("experience", []) if e.get("role") or e.get("company")]
    if experience:
        out.append(section("Work Experience"))
        for e in experience:
            head = e.get("role") or "Role"
            if e.get("company"):
                head += f" - {e['company']}"
            out.append(head)
            if e.get("dates"):
                out.append(f"  ({e['dates']})")
            b = bullets(e.get("bullets"))
            if b:
                out.append(b)
            out.append("")

    education = [e for e in data.get("education", []) if e.get("degree") or e.get("school")]
    if education:
        out.append(section("Education"))
        for e in education:
            head = e.get("degree") or "Degree"
            if e.get("school"):
                head += f" - {e['school']}"
            out.append(head)
            if e.get("dates"):
                out.append(f"  ({e['dates']})")
        out.append("")

    if data.get("extra"):
        out.append(section("Certifications"))
        out.append(bullets(data["extra"]))

    return "\n".join(out).strip() + "\n"


def format_europass(data):
    """The standard Europass CV section set."""
    out = ["Curriculum Vitae Europass"]

    out.append(section("Personal Information"))
    out.append(data.get("name") or "Your Name")
    addr_bits = [data.get(k) for k in ("location", "phone", "email") if data.get(k)]
    if addr_bits:
        out.append(" | ".join(addr_bits))
    nat_dob = []
    if data.get("nationality"):
        nat_dob.append(f"Nationality: {data['nationality']}")
    if data.get("dob"):
        nat_dob.append(f"Date of birth: {data['dob']}")
    if nat_dob:
        out.append("  ".join(nat_dob))

    experience = [e for e in data.get("experience", []) if e.get("role") or e.get("company")]
    if experience:
        out.append(section("Work Experience"))
        for e in experience:
            if e.get("dates"):
                out.append(f"({e['dates']})")
            out.append(f"Occupation or position held: {e.get('role') or '—'}")
            b = bullets(e.get("bullets"))
            if b:
                out.append("Main activities and responsibilities:")
                out.append(b)
            if e.get("company"):
                out.append(f"Name and address of employer: {e['company']}")
            out.append("")

    education = [e for e in data.get("education", []) if e.get("degree") or e.get("school")]
    if education:
        out.append(section("Education and Training"))
        for e in education:
            if e.get("dates"):
                out.append(f"({e['dates']})")
            out.append(f"Title of qualification awarded: {e.get('degree') or '—'}")
            if e.get("school"):
                out.append(f"Name and type of organisation: {e['school']}")
            out.append("")

    out.append(section("Personal Skills"))
    if data.get("languages"):
        out.append(f"Mother tongue / other language(s): {data['languages']}")
    if data.get("skills"):
        out.append(f"Job-related skills: {data['skills']}")
    if data.get("drivingLicence"):
        out.append(f"Driving licence: {data['drivingLicence']}")

    if data.get("extra"):
        out.append(section("Additional Information"))
        out.append(bullets(data["extra"]))

    return "\n".join(out).strip() + "\n"


def format_japanese(data):
    """Japanese rirekisho (履歴書) — merged 学歴・職歴 history, each entry
    expanded into its own 入学/卒業 or 入社/退社 line, as the real form does."""
    out = ["履歴書 (Rirekisho)", date.today().strftime("%Y-%m-%d")]

    out.append(section("Personal Information"))
    name_line = data.get("name") or "Your Name"
    if data.get("furigana"):
        name_line += f" ({data['furigana']})"
    out.append(name_line)
    if data.get("dob"):
        age = calc_age(data["dob"])
        out.append(f"Date of birth: {data['dob']}" + (f" (Age {age})" if age is not None else ""))
    contact_bits = [data.get(k) for k in ("location", "phone", "email") if data.get(k)]
    if contact_bits:
        out.append(" | ".join(contact_bits))

    history = []
    for e in data.get("education", []):
        if not (e.get("degree") or e.get("school")):
            continue
        start, end, ongoing = split_date_range(e.get("dates"))
        label = translate_words(e.get("school") or e.get("degree"), "ja")
        if start:
            history.append((start, f"{label} 入学 (Enrolled)"))
        if end:
            history.append((end, f"{label} 卒業 (Graduated)"))
        elif ongoing:
            history.append(("—", f"{label} 在学中 (Currently enrolled)"))
    for e in data.get("experience", []):
        if not (e.get("role") or e.get("company")):
            continue
        start, end, ongoing = split_date_range(e.get("dates"))
        label = translate_words(e.get("company") or e.get("role"), "ja")
        if start:
            history.append((start, f"{label} 入社 (Joined)"))
        if end:
            history.append((end, f"{label} 退社 (Left)"))
        elif ongoing:
            history.append(("—", f"{label} 現在に至る (To present)"))

    if history:
        out.append(section("学歴・職歴 (Education & Work History)"))
        for when, text in history:
            out.append(f"{when}  {text}")

    if data.get("extra"):
        out.append(section("免許・資格 (Licenses & Qualifications)"))
        out.append(bullets(translate_words(data["extra"], "ja")))

    out.append(section("本人希望記入欄 (Personal Requests)"))
    request = data.get("jpRequest") or data.get("summary")
    out.append(translate_words(request, "ja") if request else "None specified.")

    if DICTIONARIES["ja"]:
        out.append("")
        out.append(
            f"(Words in parentheses are from a {len(DICTIONARIES['ja'])}-term EN->JA glossary "
            "in translation/ja-dictionary.json -- a plain word lookup, not machine "
            "translation. Names and other free text are shown exactly as typed.)"
        )

    return "\n".join(out).strip() + "\n"


TRANSLATION_LABELS = {
    "es": {
        "summary": "Resumen",
        "experience": "Experiencia",
        "education": "Educación",
        "skills": "Habilidades",
        "extra": "Certificaciones, Publicaciones y Proyectos",
        "glossary_note": (
            "(Las palabras entre paréntesis provienen de un glosario EN->ES de {n} "
            "términos en translation/es-dictionary.json -- una búsqueda de palabras "
            "simple, no traducción automática.)"
        ),
    },
    "fr": {
        "summary": "Profil",
        "experience": "Expérience professionnelle",
        "education": "Formation",
        "skills": "Compétences",
        "extra": "Certifications, publications et projets",
        "glossary_note": (
            "(Les mots entre parenthèses proviennent d'un glossaire EN->FR de {n} "
            "termes dans translation/fr-dictionary.json -- une simple recherche de "
            "mots, pas une traduction automatique.)"
        ),
    },
    "ru": {
        "summary": "О себе",
        "experience": "Опыт работы",
        "education": "Образование",
        "skills": "Навыки",
        "extra": "Сертификаты, публикации и проекты",
        "glossary_note": (
            "(Слова в скобках взяты из EN->RU словаря ({n} терминов) в "
            "translation/ru-dictionary.json -- это простой поиск по словарю, а не "
            "машинный перевод.)"
        ),
    },
    "de": {
        "summary": "Profil",
        "experience": "Berufserfahrung",
        "education": "Ausbildung",
        "skills": "Fähigkeiten",
        "extra": "Zertifikate, Veröffentlichungen und Projekte",
        "glossary_note": (
            "(Wörter in Klammern stammen aus einem EN->DE-Glossar ({n} Begriffe) in "
            "translation/de-dictionary.json -- eine einfache Wortsuche, keine "
            "maschinelle Übersetzung.)"
        ),
    },
}


def format_translated(data, code):
    """A resume laid out like format_resume_or_cv, but with section headers in
    the target language and recognized vocabulary annotated via the matching
    EN-><lang> glossary -- the same honest "word lookup, not translation"
    approach as the Japanese rirekisho format, applied to a plain resume shape
    instead of that format's own history-table structure."""
    labels = TRANSLATION_LABELS[code]
    out = []
    name = data.get("name") or "Your Name"
    out.append(name)
    out.append("=" * len(name))

    title = data.get("title")
    if title:
        out.append(title)

    contact_bits = [data.get(k) for k in ("email", "phone", "location", "links") if data.get(k)]
    if contact_bits:
        out.append("  |  ".join(contact_bits))

    summary = data.get("summary")
    if summary:
        out.append(section(labels["summary"]))
        out.append(wrap(translate_words(summary, code)))

    experience = [e for e in data.get("experience", []) if e.get("role") or e.get("company")]
    if experience:
        out.append(section(labels["experience"]))
        for e in experience:
            head = translate_words(e.get("role") or "Role", code)
            if e.get("company"):
                head += f" — {translate_words(e['company'], code)}"
            out.append(head)
            if e.get("dates"):
                out.append(f"  ({e['dates']})")
            b = bullets(translate_words(e.get("bullets"), code))
            if b:
                out.append(b)
            out.append("")

    education = [e for e in data.get("education", []) if e.get("degree") or e.get("school")]
    if education:
        out.append(section(labels["education"]))
        for e in education:
            head = translate_words(e.get("degree") or "Degree", code)
            if e.get("school"):
                head += f" — {translate_words(e['school'], code)}"
            out.append(head)
            if e.get("dates"):
                out.append(f"  ({e['dates']})")
        out.append("")

    skills = data.get("skills")
    if skills:
        out.append(section(labels["skills"]))
        out.append(wrap(translate_words(skills, code)))

    if data.get("extra"):
        out.append(section(labels["extra"]))
        out.append(bullets(translate_words(data["extra"], code)))

    dictionary = DICTIONARIES.get(code)
    if dictionary:
        out.append("")
        out.append(labels["glossary_note"].format(n=len(dictionary)))

    return "\n".join(out).strip() + "\n"


FORMATTERS = {
    "resume": lambda d: format_resume_or_cv(d, is_cv=False),
    "cv": lambda d: format_resume_or_cv(d, is_cv=True),
    "cover": format_cover_letter,
    "ats": format_ats,
    "europass": format_europass,
    "japanese": format_japanese,
    "spanish": lambda d: format_translated(d, "es"),
    "french": lambda d: format_translated(d, "fr"),
    "russian": lambda d: format_translated(d, "ru"),
    "german": lambda d: format_translated(d, "de"),
}


def main():
    parser = argparse.ArgumentParser(description="Format a Resume Builder JSON draft as plain text.")
    parser.add_argument("draft", help="Path to a draft exported from Index.html's 'Export Draft (JSON)' button.")
    parser.add_argument("--type", choices=list(FORMATTERS) + ["all"], default="all",
                         help="Which document to produce (default: all).")
    parser.add_argument("--out", metavar="DIR",
                         help="Write .txt file(s) into this directory instead of printing to the terminal.")
    args = parser.parse_args()

    data = load_draft(args.draft)
    doc_types = FORMATTERS.keys() if args.type == "all" else [args.type]

    base_name = (data.get("name") or "draft").replace(" ", "_")
    out_dir = Path(args.out) if args.out else None
    if out_dir:
        out_dir.mkdir(parents=True, exist_ok=True)

    for i, doc_type in enumerate(doc_types):
        text = FORMATTERS[doc_type](data)
        if out_dir:
            file_path = out_dir / f"{base_name}_{doc_type}.txt"
            file_path.write_text(text, encoding="utf-8")
            print(f"wrote {file_path}")
        else:
            if i:
                print("\n" + ("=" * WRAP_WIDTH) + "\n")
            print(text, end="")


if __name__ == "__main__":
    main()
