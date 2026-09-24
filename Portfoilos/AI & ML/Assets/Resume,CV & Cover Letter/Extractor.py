#!/usr/bin/env python3
"""
Extractor.py — turns a filled-out template.txt into draft.json, the exact
JSON shape Index.html's "Export Draft (JSON)" button writes and "Import
Draft" reads, and what Printer.py takes directly. Lets someone fill in a
plain-text form by hand instead of using the browser, and still get the
same output either way.

Usage:
    python Extractor.py template.txt                # writes draft.json
    python Extractor.py template.txt --out mine.json
    python Extractor.py template.txt --print          # also runs Printer.py on it
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")

HERE = Path(__file__).resolve().parent

SIMPLE_FIELDS = {
    "NAME": "name", "TITLE": "title", "EMAIL": "email", "PHONE": "phone",
    "LOCATION": "location", "LINKS": "links", "SUMMARY": "summary",
    "SKILLS": "skills", "EXTRA": "extra",
    "NATIONALITY": "nationality", "DOB": "dob", "FURIGANA": "furigana",
    "LANGUAGES": "languages", "DRIVING_LICENCE": "drivingLicence",
    "JP_REQUEST": "jpRequest",
    "CO_COMPANY": "coCompany", "CO_ROLE": "coRole", "CO_HIRING": "coHiring",
    "CO_OPEN": "coOpen", "CO_BODY": "coBody", "CO_CLOSE": "coClose",
}

PLACEHOLDER_RE = re.compile(r"^\[.*\]$")


def clean(value):
    value = value.strip()
    if not value or PLACEHOLDER_RE.match(value):
        return ""
    return value


def parse_template(text):
    data = {
        "name": "", "title": "", "email": "", "phone": "", "location": "", "links": "",
        "summary": "", "skills": "", "extra": "",
        "experience": [], "education": [],
        "nationality": "", "dob": "", "furigana": "", "languages": "",
        "drivingLicence": "", "jpRequest": "",
        "coCompany": "", "coRole": "", "coHiring": "", "coOpen": "", "coBody": "", "coClose": "",
    }

    lines = [l.rstrip("\n") for l in text.splitlines()]
    i = 0
    current_exp = None
    current_edu = None
    collecting_bullets = False

    while i < len(lines):
        raw = lines[i]
        line = raw.strip()
        i += 1

        if not line or line.startswith("#"):
            collecting_bullets = False
            continue

        if line == "EXPERIENCE:":
            current_exp = {"role": "", "company": "", "dates": "", "bullets": ""}
            collecting_bullets = False
            continue
        if line == "END EXPERIENCE":
            if current_exp is not None:
                data["experience"].append(current_exp)
            current_exp = None
            collecting_bullets = False
            continue
        if line == "EDUCATION:":
            current_edu = {"degree": "", "school": "", "dates": ""}
            collecting_bullets = False
            continue
        if line == "END EDUCATION":
            if current_edu is not None:
                data["education"].append(current_edu)
            current_edu = None
            continue

        if line == "BULLETS:":
            collecting_bullets = True
            continue

        if collecting_bullets:
            if line.startswith("- "):
                bullet = clean(line[2:])
                if bullet and current_exp is not None:
                    existing = current_exp["bullets"]
                    current_exp["bullets"] = (existing + "\n" + bullet) if existing else bullet
                continue
            else:
                collecting_bullets = False
                # fall through — this line is a new KEY: value, handle below

        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        key = key.strip().upper()
        value = clean(value)

        if current_exp is not None and key in ("ROLE", "COMPANY", "DATES"):
            current_exp[key.lower()] = value
        elif current_edu is not None and key in ("DEGREE", "SCHOOL", "DATES"):
            current_edu[key.lower()] = value
        elif key in SIMPLE_FIELDS:
            data[SIMPLE_FIELDS[key]] = value

    if not data["experience"]:
        data["experience"] = [{"role": "", "company": "", "dates": "", "bullets": ""}]
    if not data["education"]:
        data["education"] = [{"degree": "", "school": "", "dates": ""}]

    return data


def main():
    parser = argparse.ArgumentParser(description="Extract a filled-in template.txt into draft.json.")
    parser.add_argument("template", nargs="?", default=str(HERE / "template.txt"),
                         help="Path to the filled-in template file (default: template.txt in this folder).")
    parser.add_argument("--out", default=str(HERE / "draft.json"), help="Where to write the JSON draft.")
    parser.add_argument("--print", dest="run_printer", action="store_true",
                         help="Also run Printer.py on the resulting draft.")
    args = parser.parse_args()

    template_path = Path(args.template)
    if not template_path.exists():
        sys.exit(f"error: no such file: {template_path}")

    text = template_path.read_text(encoding="utf-8")
    data = parse_template(text)

    out_path = Path(args.out)
    out_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"wrote {out_path}")

    filled = sum(1 for v in (data["name"], data["email"], data["summary"]) if v)
    if filled == 0:
        print("warning: name/email/summary all came out empty — did you fill in the template?", file=sys.stderr)

    if args.run_printer:
        subprocess.run([sys.executable, str(HERE / "Printer.py"), str(out_path)], check=False)


if __name__ == "__main__":
    main()
