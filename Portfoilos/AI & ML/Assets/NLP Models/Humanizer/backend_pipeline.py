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
    fillers = [(term, "") for (term,) in conn.execute("SELECT term FROM filler_terms").fetchall()]
    connectors = [c for (c,) in conn.execute("SELECT connector FROM transition_connectors ORDER BY id").fetchall()]
    us_uk = conn.execute("SELECT us_spelling, uk_spelling FROM us_uk_spelling").fetchall()
    jargon = conn.execute("SELECT jargon, plain FROM jargon_terms").fetchall()
    conn.close()
    return {
        "phrases": phrases, "words": words, "contractions": contractions,
        "fillers": fillers, "connectors": connectors, "us_uk": us_uk, "jargon": jargon
    }


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


def _collapse_whitespace(text):
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\s+([,.!?;:])", r"\1", text)
    return text.strip()


def _fluency_cleanup(text):
    """Whitespace/punctuation hygiene + capitalize sentence starts. A
    formatting pass, not a rewrite — safe to run regardless of what else ran."""
    if not text:
        return text
    result = _collapse_whitespace(text)
    result = re.sub(
        r"(^\s*|[.!?]\s+)([a-z])",
        lambda m: m.group(1) + m.group(2).upper(),
        result,
    )
    return result


def _extend_text(text, connectors):
    """Splits on sentence-ending punctuation and prepends a connector to
    every other sentence — real English transition words, not invented content."""
    if not text.strip() or not connectors:
        return text
    sentences = [s for s in re.split(r"(?<=[.!?])\s+", text) if s]
    idx = 0
    for i in range(1, len(sentences), 2):
        connector = connectors[idx % len(connectors)]
        idx += 1
        s = sentences[i]
        first_word_match = re.match(r"[A-Za-z]+", s)
        first_word = first_word_match.group(0) if first_word_match else ""
        if first_word and first_word != "I" and s[:1].isupper():
            s = s[:1].lower() + s[1:]
        sentences[i] = connector + s
    return " ".join(sentences)


def humanize_text(text, rules, options=None):
    """Returns (humanized_text, changes) where changes is a list of
    (original_snippet, replacement_snippet) tuples, in the order applied.

    options: {intensity: 'light'|'medium'|'full', length: 'shorten'|'normal'|'extend',
              dialect: 'us'|'uk'|'aus', remove_jargon: bool, fluency: bool}
    """
    options = options or {}
    intensity = options.get("intensity", "full")
    length = options.get("length", "normal")
    dialect = options.get("dialect", "us")
    remove_jargon = bool(options.get("remove_jargon", False))
    fluency = options.get("fluency", True)

    changes = []
    result = text

    if intensity == "full":
        result = _apply_rules(result, rules["phrases"], changes, whole_word=False)
    if intensity in ("medium", "full"):
        result = _apply_rules(result, rules["words"], changes, whole_word=True)
    if length != "extend":
        result = _apply_rules(result, rules["contractions"], changes, whole_word=True)
    if remove_jargon:
        result = _apply_rules(result, rules["jargon"], changes, whole_word=True)
    if dialect in ("uk", "aus"):
        result = _apply_rules(result, rules["us_uk"], changes, whole_word=True)
    if length == "shorten":
        result = _apply_rules(result, rules["fillers"], changes, whole_word=True)
        result = _collapse_whitespace(result)
    elif length == "extend":
        result = _extend_text(result, rules["connectors"])

    if fluency:
        result = _fluency_cleanup(result)

    return result, changes


def analyze(text):
    words = text.split()
    sentences = [s for s in re.split(r"[.!?]+\s*", text) if s.strip()]
    return {"word_count": len(words), "sentence_count": len(sentences)}
