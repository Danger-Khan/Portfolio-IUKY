#!/usr/bin/env python3
"""
backend_pipeline.py — the Humanizer's actual rewrite logic.

Rule-based, not a trained model: swaps stock AI-sounding phrases, overly
formal words, and expanded verb phrases for plainer, contracted alternatives,
using rules loaded from database.sql. This is the same logic Engine.js runs
client-side in the browser — this module is the Python mirror, used by
backend.py and importable on its own.

Stages: load_rules() -> humanize_text() -> a (result, changes) pair, where
changes lists every (original, replacement) swap actually made.
"""

import re
import sqlite3
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_DB = HERE / "humanizer.db"
SCHEMA_SQL = HERE / "database.sql"


def ensure_database(db_path=DEFAULT_DB, schema_path=SCHEMA_SQL):
    conn = sqlite3.connect(db_path)
    with open(schema_path, encoding="utf-8") as f:
        conn.executescript(f.read())
    conn.commit()
    return conn


def load_rules(db_path=DEFAULT_DB):
    conn = ensure_database(db_path)
    phrases = conn.execute("SELECT phrase, replacement FROM ai_phrases").fetchall()
    words = conn.execute("SELECT formal_word, casual_word FROM word_substitutions").fetchall()
    contractions = conn.execute("SELECT expanded, contracted FROM contractions").fetchall()
    conn.close()
    return {"phrases": phrases, "words": words, "contractions": contractions}


def _match_case(original, replacement):
    """Keeps the replacement's capitalization roughly matching the text it replaces."""
    if original[:1].isupper():
        return replacement[:1].upper() + replacement[1:]
    return replacement


def _apply_rules(text, pairs, changes, whole_word):
    """pairs: list of (find, replace); longest find-strings applied first so
    e.g. 'in order to' is matched before a shorter overlapping rule could."""
    result = text
    for find, replace in sorted(pairs, key=lambda p: -len(p[0])):
        boundary = r"\b" if whole_word else ""
        pattern = re.compile(boundary + re.escape(find) + boundary, re.IGNORECASE)

        def repl(m, replace=replace):
            changes.append((m.group(0), _match_case(m.group(0), replace)))
            return _match_case(m.group(0), replace)

        result = pattern.sub(repl, result)
    return result


def humanize_text(text, rules):
    """Returns (humanized_text, changes) where changes is a list of
    (original_snippet, replacement_snippet) tuples, in the order applied."""
    changes = []
    result = text
    result = _apply_rules(result, rules["phrases"], changes, whole_word=False)
    result = _apply_rules(result, rules["words"], changes, whole_word=True)
    result = _apply_rules(result, rules["contractions"], changes, whole_word=True)
    return result, changes


def analyze(text):
    words = text.split()
    sentences = [s for s in re.split(r"[.!?]+\s*", text) if s.strip()]
    return {"word_count": len(words), "sentence_count": len(sentences)}
