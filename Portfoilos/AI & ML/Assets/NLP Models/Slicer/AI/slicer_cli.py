#!/usr/bin/env python3
"""
slicer_cli.py
-----------------------------------------------------------------------------
Command-line mirror of slicer-engine.js. Reads the exact same Word Library
.txt files and the Grammer Context disambiguation-rules.json straight off
disk -- no word list is copy-pasted into this file -- and tags each token
of the given text with a word class, using the same lexicon-based approach
as the browser Slicer.

The hand-built lexicon is still the source of truth: it is the only thing
that knows "great" is Positive rather than just an Adjective, so any word
it recognises is classified exactly as slicer-engine.js would classify it.
For a token the lexicon has never seen, this CLI (browser Slicer has no
such fallback) asks NLTK's averaged-perceptron POS tagger what part of
speech it thinks the word is *in this sentence* and maps that onto our
category set -- turning "unclassified" into a real guess for ordinary
nouns and other words no one has hand-curated a list for yet. NLTK is
optional: if it or its model data isn't available (e.g. no network for the
one-time download), this CLI degrades back to lexicon-only tagging.

It also reports which of the 12 English tenses (past/present/future x
simple/continuous/perfect/perfect continuous, see Grammer Context/tense-
rules.json) the sentence's verb group appears to be in, by matching its
auxiliary-verb chain against that table.

Usage:
    pip install nltk   # optional -- only needed for the fallback described above
    python3 slicer_cli.py "The engineer will present the results well."
    echo "some text" | python3 slicer_cli.py
    python3 slicer_cli.py --no-nltk "..."   # lexicon-only, mirrors the browser exactly
"""
import argparse
import json
import re
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
WORD_LIBRARY_DIR = BASE_DIR / "Word Library"
GRAMMAR_CONTEXT_DIR = BASE_DIR / "Grammer Context"

CATEGORY_FILES = [
    ("positive", "positive.txt"),
    ("negative", "negative.txt"),
    ("abstractNoun", "abstract.txt"),
    ("verb", "verbs.txt"),
    ("adverb", "adverbs.txt"),
    ("pronoun", "pronouns.txt"),
    ("adjective", "adjectives.txt"),
    ("interjection", "interjections.txt"),
    ("preposition", "prepositions.txt"),
]

CATEGORY_LABELS = {
    "positive": "Positive",
    "negative": "Negative",
    "punctuation": "Punctuation",
    "abstractNoun": "Abstract Noun",
    "noun": "Noun",
    "verb": "Verb",
    "adverb": "Adverb",
    "pronoun": "Pronoun",
    "adjective": "Adjective",
    "interjection": "Interjection",
    "preposition": "Preposition",
    "unclassified": "Unclassified",
}

# Penn Treebank POS tag prefix -> our category set. Only tags with a clean
# match are mapped; determiners, conjunctions, numerals etc. are left
# unclassified rather than forced into a category that doesn't fit.
NLTK_TAG_MAP = {
    "NN": "noun", "NNS": "noun", "NNP": "noun", "NNPS": "noun",
    "VB": "verb", "VBD": "verb", "VBG": "verb", "VBN": "verb", "VBP": "verb", "VBZ": "verb",
    "JJ": "adjective", "JJR": "adjective", "JJS": "adjective",
    "RB": "adverb", "RBR": "adverb", "RBS": "adverb", "WRB": "adverb",
    "PRP": "pronoun", "PRP$": "pronoun", "WP": "pronoun", "WP$": "pronoun",
    "IN": "preposition",
    "UH": "interjection",
}


def _load_nltk_tagger():
    """Best-effort import + lazy model download. Returns a pos_tag callable,
    or None if NLTK or its model data isn't available (no import error is
    ever raised to the caller -- this CLI must keep working without it)."""
    try:
        import nltk
    except ImportError:
        return None

    for resource in ("tokenizers/punkt_tab", "taggers/averaged_perceptron_tagger_eng"):
        try:
            nltk.data.find(resource)
        except LookupError:
            try:
                nltk.download(resource.split("/")[-1], quiet=True)
            except Exception:
                print(
                    "note: NLTK is installed but its model data isn't downloaded "
                    "and couldn't be fetched (no network?) -- falling back to "
                    "lexicon-only tagging for unclassified words.",
                    file=sys.stderr,
                )
                return None
    return nltk.pos_tag

TOKEN_PATTERN = re.compile(r"""[A-Za-z']+|[.,;:!?'"()\[\]{}\-–—…/\\&*#@%+=<>~`_|]""")


def load_word_set(filename):
    path = WORD_LIBRARY_DIR / filename
    with open(path, encoding="utf-8") as f:
        return {line.strip().lower() for line in f if line.strip()}


def load_punctuation_set():
    path = WORD_LIBRARY_DIR / "punctuation.txt"
    with open(path, encoding="utf-8") as f:
        return {line.rstrip("\n") for line in f if line.strip("\n") != ""}


def load_rules():
    path = GRAMMAR_CONTEXT_DIR / "disambiguation-rules.json"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    data.pop("_comment", None)
    return data


def load_tense_rules():
    path = GRAMMAR_CONTEXT_DIR / "tense-rules.json"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    data.pop("_comment", None)
    return data


WORD_SETS = [(key, load_word_set(filename)) for key, filename in CATEGORY_FILES]
PUNCTUATION_SET = load_punctuation_set()
DISAMBIGUATION_RULES = load_rules()

TENSE_RULES = load_tense_rules()
TENSE_AUXILIARIES = TENSE_RULES["auxiliaries"]
TENSES = TENSE_RULES["tenses"]
VERB_SET = dict(WORD_SETS)["verb"]

IRREGULAR_PAST_FORMS = set()
IRREGULAR_PARTICIPLE_FORMS = set()
for past, participle in TENSE_RULES["irregularVerbs"].values():
    IRREGULAR_PAST_FORMS.update(past.split("/"))
    IRREGULAR_PARTICIPLE_FORMS.update(participle.split("/"))


def tokenize(text):
    return TOKEN_PATTERN.findall(text)


def classify_token(token, previous_category):
    if token in PUNCTUATION_SET:
        return "punctuation"

    lower = token.lower()
    rule = DISAMBIGUATION_RULES.get(lower)
    if rule:
        prefer = rule.get("preferByPreviousCategory", {})
        return prefer.get(previous_category) or rule["default"]

    for key, words in WORD_SETS:
        if lower in words:
            return key
    return "unclassified"


def slice_text(text, use_nltk=True):
    """Mirrors slicer-engine.js's sliceText(): tags every token, tracking the
    previous non-punctuation category for the disambiguation rules. Tokens
    the lexicon leaves "unclassified" are then, optionally, handed to NLTK's
    POS tagger (run once over the whole sentence, so it has real context)
    and remapped if its tag lands cleanly in our category set."""
    tokens = tokenize(text)
    categories = []
    previous_category = None
    for token in tokens:
        category = classify_token(token, previous_category)
        categories.append(category)
        if category != "punctuation":
            previous_category = category

    sources = ["lexicon"] * len(tokens)

    if use_nltk and "unclassified" in categories:
        pos_tag = _load_nltk_tagger()
        if pos_tag is not None:
            pos_tags = pos_tag(tokens)
            for i, (category, (_, tag)) in enumerate(zip(categories, pos_tags)):
                if category == "unclassified" and tag in NLTK_TAG_MAP:
                    categories[i] = NLTK_TAG_MAP[tag]
                    sources[i] = "nltk"

    tagged = list(zip(tokens, categories, sources))

    counts = {}
    for category in categories:
        counts[category] = counts.get(category, 0) + 1

    return tagged, counts


WORD_ONLY = re.compile(r"^[a-z']+$")


def _is_ing_form(word):
    return bool(word) and len(word) > 4 and word.endswith("ing")


def _regular_past_base(word):
    """If `word` is a regular past-tense form of some verb in VERB_SET,
    returns that verb's base form (e.g. "stopped" -> "stop"); else None."""
    if not word or not word.endswith("ed"):
        return None
    stem = word[:-2]
    if stem in VERB_SET:
        return stem  # walked -> walk
    if (stem + "e") in VERB_SET:
        return stem + "e"  # liked -> like
    if len(stem) >= 2 and stem[-1] == stem[-2]:
        singled = stem[:-1]
        if singled in VERB_SET:
            return singled  # stopped -> stop
    return None


def _present_base(word):
    """If `word` is a present-tense (base or 3rd-person -s/-es) form of some
    verb in VERB_SET, returns that verb's base form; else None."""
    if not word:
        return None
    if word in VERB_SET:
        return word  # write
    if word.endswith("ies") and (word[:-3] + "y") in VERB_SET:
        return word[:-3] + "y"  # tries -> try
    if word.endswith("es") and word[:-2] in VERB_SET:
        return word[:-2]  # watches -> watch
    if word.endswith("s") and word[:-1] in VERB_SET:
        return word[:-1]  # writes -> write
    return None


def _is_past_participle(word):
    return bool(word) and (word in IRREGULAR_PARTICIPLE_FORMS or word.endswith("ed"))


def _tense_match(key, matched_words):
    result = {"key": key, "matched": [w for w in matched_words if w]}
    result.update(TENSES[key])
    return result


def detect_tense(tokens):
    """Mirrors slicer-engine.js's detectTense(): scans for one auxiliary
    chain (will/shall, has/have/had, am/is/are/was/were) and matches it
    against the 12-tense pattern table in tense-rules.json. A token-pattern
    match, not a parser -- finds the first verb group it can and says
    nothing about additional clauses, passive voice, or negation."""
    words = [t.lower() for t in tokens if WORD_ONLY.match(t.lower())]

    def at(i):
        return words[i] if 0 <= i < len(words) else None

    for i, w in enumerate(words):
        w1, w2, w3 = at(i + 1), at(i + 2), at(i + 3)

        if w in TENSE_AUXILIARIES["modalFuture"]:
            if w1 == "have" and w2 == "been" and _is_ing_form(w3):
                return _tense_match("futurePerfectContinuous", [w, w1, w2, w3])
            if w1 == "have" and _is_past_participle(w2):
                return _tense_match("futurePerfect", [w, w1, w2])
            if w1 == "be" and _is_ing_form(w2):
                return _tense_match("futureContinuous", [w, w1, w2])
            if w1 and w1 not in ("have", "be"):
                return _tense_match("simpleFuture", [w, w1])
        if w in TENSE_AUXILIARIES["havePast"]:
            if w1 == "been" and _is_ing_form(w2):
                return _tense_match("pastPerfectContinuous", [w, w1, w2])
            if _is_past_participle(w1):
                return _tense_match("pastPerfect", [w, w1])
        if w in TENSE_AUXILIARIES["havePresent"]:
            if w1 == "been" and _is_ing_form(w2):
                return _tense_match("presentPerfectContinuous", [w, w1, w2])
            if _is_past_participle(w1):
                return _tense_match("presentPerfect", [w, w1])
        if w in TENSE_AUXILIARIES["bePast"] and _is_ing_form(w1):
            return _tense_match("pastContinuous", [w, w1])
        if w in TENSE_AUXILIARIES["bePresent"] and _is_ing_form(w1):
            return _tense_match("presentContinuous", [w, w1])

    # No auxiliary chain found -- fall back to a bare main verb from the lexicon.
    for w in words:
        if w in IRREGULAR_PAST_FORMS or _regular_past_base(w):
            return _tense_match("simplePast", [w])
    for w in words:
        if _present_base(w):
            return _tense_match("simplePresent", [w])
    return None


def main():
    parser = argparse.ArgumentParser(
        description="Tag each token of a sentence with a Word Library word class."
    )
    parser.add_argument("text", nargs="?", help="Text to slice. Reads stdin if omitted.")
    parser.add_argument(
        "--no-nltk", action="store_true",
        help="Lexicon-only tagging, no NLTK fallback -- mirrors the browser Slicer exactly.",
    )
    args = parser.parse_args()

    text = args.text if args.text is not None else sys.stdin.read()
    text = text.strip()
    if not text:
        print("No text given.")
        return

    tagged, counts = slice_text(text, use_nltk=not args.no_nltk)

    print("Token breakdown:")
    for token, category, source in tagged:
        label = CATEGORY_LABELS[category]
        suffix = " (nltk)" if source == "nltk" else ""
        print(f"  {token!r:<20} {label}{suffix}")

    print("\nCounts by category:")
    for category, count in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])):
        print(f"  {CATEGORY_LABELS[category]}: {count}")

    tense = detect_tense(tokenize(text))
    print("\nDetected tense:")
    if tense:
        print(f"  {tense['label']} -- {tense['structure']} (matched {' '.join(tense['matched'])!r})")
    else:
        print("  No verb group recognized.")


if __name__ == "__main__":
    main()
