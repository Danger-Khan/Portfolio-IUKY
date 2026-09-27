/**
 * rules.js
 * ---------------------------------------------------------------------------
 * Browser-loadable mirror of disambiguation-rules.json in this same Grammer
 * Context folder (the JSON is the source of truth; slicer_cli.py reads it
 * directly). Hand-synced here because the Slicer runs from file:// too and
 * a module script cannot reliably fetch() a sibling .json file there.
 */
export const DISAMBIGUATION_RULES = {
  "well": {
    "categories": [
      "adverb",
      "interjection"
    ],
    "preferByPreviousCategory": {
      "pronoun": "adverb",
      "verb": "adverb"
    },
    "default": "interjection"
  },
  "like": {
    "categories": [
      "preposition",
      "verb"
    ],
    "preferByPreviousCategory": {
      "pronoun": "verb"
    },
    "default": "preposition"
  },
  "close": {
    "categories": [
      "adjective",
      "verb"
    ],
    "preferByPreviousCategory": {
      "pronoun": "verb"
    },
    "default": "adjective"
  },
  "present": {
    "categories": [
      "adjective",
      "verb"
    ],
    "preferByPreviousCategory": {
      "pronoun": "verb"
    },
    "default": "adjective"
  }
};
