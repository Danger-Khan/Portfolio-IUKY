#!/usr/bin/env python3
"""
backend.py — CLI entry point for the Humanizer.

Reads text, runs it through backend_pipeline.humanize_text(), and prints the
rewritten text plus a report of every swap made. Same rule-based logic as
Engine.js (the in-browser version on Index.html) — this is the offline,
scriptable companion, useful for batch-processing files.

Usage:
    python backend.py notes.txt
    echo "We need to utilize this in order to demonstrate the results." | python backend.py
    python backend.py notes.txt --out humanized.txt --quiet
"""

import argparse
import sys

import backend_pipeline

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Rewrite AI-sounding text to read more naturally.")
    parser.add_argument("input", nargs="?", help="Path to a text file. Omit to read from stdin.")
    parser.add_argument("--db", default=str(backend_pipeline.DEFAULT_DB), help="Path to the rules SQLite database.")
    parser.add_argument("--out", metavar="FILE", help="Write the humanized text to a file instead of stdout.")
    parser.add_argument("--quiet", action="store_true", help="Skip the change report — just output the text.")
    args = parser.parse_args()

    text = open(args.input, encoding="utf-8").read() if args.input else sys.stdin.read()
    if not text.strip():
        sys.exit("error: no input text (pass a file path or pipe text in via stdin)")

    rules = backend_pipeline.load_rules(args.db)
    result, changes = backend_pipeline.humanize_text(text, rules)

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(result)
        print(f"wrote {args.out}")
    else:
        print(result)

    if not args.quiet:
        if changes:
            print(f"\n{len(changes)} change(s) made:", file=sys.stderr)
            for original, replacement in changes:
                print(f"  \"{original}\" -> \"{replacement}\"", file=sys.stderr)
        else:
            print("\nNo AI-sounding patterns found — text left unchanged.", file=sys.stderr)


if __name__ == "__main__":
    main()
