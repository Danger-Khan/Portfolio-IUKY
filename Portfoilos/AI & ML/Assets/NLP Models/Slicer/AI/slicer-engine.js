/**
 * slicer-engine.js
 * ---------------------------------------------------------------------------
 * The Slicer: splits a sentence into tokens and tags each one with a
 * word class -- Positive, Negative, Punctuation, Abstract Noun, Verb,
 * Adverb, Pronoun, Adjective, Interjection, Preposition, or Unclassified --
 * using the plain-text lexicons in ../Word Library and the small
 * disambiguation table in ../Grammer Context. Lexicon-based, the same
 * honest approach as nlp-engine.js's sentiment analyzer one folder up: no
 * external library, no pretrained model, no network call.
 *
 * A few words appear in two Word Library lists on purpose -- real English
 * ambiguity, e.g. "close" is genuinely both an adjective and a verb. Those
 * are resolved by ../Grammer Context/rules.js using only the category of
 * the token immediately before them. That is a single-word-of-context
 * heuristic, not a real syntactic parser -- it will get some sentences
 * wrong, and it doesn't try to hide that.
 */
import {
  POSITIVE_WORDS,
  NEGATIVE_WORDS,
  PUNCTUATION,
  ABSTRACT_NOUNS,
  VERBS,
  ADVERBS,
  PRONOUNS,
  ADJECTIVES,
  INTERJECTIONS,
  PREPOSITIONS
} from '../Word Library/word-lists.js';
import { DISAMBIGUATION_RULES } from '../Grammer Context/rules.js';
import { TENSE_AUXILIARIES, TENSES, IRREGULAR_VERBS } from '../Grammer Context/tense-rules.js';

export const CATEGORY_LABELS = {
  positive: 'Positive',
  negative: 'Negative',
  punctuation: 'Punctuation',
  abstractNoun: 'Abstract Noun',
  verb: 'Verb',
  adverb: 'Adverb',
  pronoun: 'Pronoun',
  adjective: 'Adjective',
  interjection: 'Interjection',
  preposition: 'Preposition',
  unclassified: 'Unclassified'
};

const CATEGORY_LISTS = [
  { key: 'positive', words: POSITIVE_WORDS },
  { key: 'negative', words: NEGATIVE_WORDS },
  { key: 'abstractNoun', words: ABSTRACT_NOUNS },
  { key: 'verb', words: VERBS },
  { key: 'adverb', words: ADVERBS },
  { key: 'pronoun', words: PRONOUNS },
  { key: 'adjective', words: ADJECTIVES },
  { key: 'interjection', words: INTERJECTIONS },
  { key: 'preposition', words: PREPOSITIONS }
];

const WORD_SETS = CATEGORY_LISTS.map(({ key, words }) => ({
  key,
  set: new Set(words.map((w) => w.toLowerCase()))
}));

const PUNCTUATION_SET = new Set(PUNCTUATION);

const TOKEN_PATTERN = /[A-Za-z']+|[.,;:!?'"()[\]{}\-–—…/\\&*#@%+=<>~`_|]/g;

/** Splits text into word tokens and standalone punctuation tokens, in order. */
export function tokenizeForSlicer(text) {
  return text.match(TOKEN_PATTERN) || [];
}

function classifyToken(token, previousCategory) {
  if (PUNCTUATION_SET.has(token)) return 'punctuation';

  const lower = token.toLowerCase();
  const rule = DISAMBIGUATION_RULES[lower];
  if (rule) {
    const preferred = rule.preferByPreviousCategory && rule.preferByPreviousCategory[previousCategory];
    return preferred || rule.default;
  }

  for (const { key, set } of WORD_SETS) {
    if (set.has(lower)) return key;
  }
  return 'unclassified';
}

/** Tags every token in the text and returns the tagged sequence plus a count
 *  per category. Ambiguous words are resolved using only the category of
 *  the token immediately before them (punctuation is skipped when tracking
 *  "previous category" so it never blocks a real disambiguation rule). */
export function sliceText(text) {
  const tokens = tokenizeForSlicer(text);
  const tagged = [];
  let previousCategory = null;

  for (const token of tokens) {
    const category = classifyToken(token, previousCategory);
    tagged.push({ token, category });
    if (category !== 'punctuation') previousCategory = category;
  }

  const counts = {};
  for (const { category } of tagged) counts[category] = (counts[category] || 0) + 1;

  return { tagged, counts };
}

/* ============================ Tense detection ============================
 * detectTense() looks for ONE auxiliary-verb chain (will/shall, has/have/had,
 * am/is/are/was/were) and matches it against the 12-tense pattern table in
 * ../Grammer Context/tense-rules.js. Same honesty as the rest of this file:
 * a token-pattern match, not a parser -- it finds the first verb group it
 * can and says nothing about additional clauses, passive voice, or negation.
 */
const VERB_SET = new Set(VERBS.map((w) => w.toLowerCase()));

const IRREGULAR_PAST_FORMS = new Set();
const IRREGULAR_PARTICIPLE_FORMS = new Set();
for (const [past, participle] of Object.values(IRREGULAR_VERBS)) {
  for (const form of past.split('/')) IRREGULAR_PAST_FORMS.add(form);
  for (const form of participle.split('/')) IRREGULAR_PARTICIPLE_FORMS.add(form);
}

function isIngForm(word) {
  return !!word && word.length > 4 && word.endsWith('ing');
}

/** If `word` is a regular past-tense form of some verb in VERB_SET, returns
 *  that verb's base form (e.g. "stopped" -> "stop"); otherwise null. */
function regularPastBase(word) {
  if (!word || !word.endsWith('ed')) return null;
  const stem = word.slice(0, -2);
  if (VERB_SET.has(stem)) return stem; // walked -> walk
  if (VERB_SET.has(stem + 'e')) return stem + 'e'; // liked -> like
  if (stem.length >= 2 && stem[stem.length - 1] === stem[stem.length - 2]) {
    const singled = stem.slice(0, -1);
    if (VERB_SET.has(singled)) return singled; // stopped -> stop
  }
  return null;
}

/** If `word` is a present-tense (base or 3rd-person -s/-es) form of some verb
 *  in VERB_SET, returns that verb's base form; otherwise null. */
function presentBase(word) {
  if (!word) return null;
  if (VERB_SET.has(word)) return word; // write
  if (word.endsWith('ies') && VERB_SET.has(word.slice(0, -3) + 'y')) return word.slice(0, -3) + 'y'; // tries -> try
  if (word.endsWith('es') && VERB_SET.has(word.slice(0, -2))) return word.slice(0, -2); // watches -> watch
  if (word.endsWith('s') && VERB_SET.has(word.slice(0, -1))) return word.slice(0, -1); // writes -> write
  return null;
}

function isPastParticiple(word) {
  return !!word && (IRREGULAR_PARTICIPLE_FORMS.has(word) || word.endsWith('ed'));
}

function tenseMatch(key, matchedWords) {
  return { key, matched: matchedWords.filter(Boolean), ...TENSES[key] };
}

/** Scans the already-tokenized text for one auxiliary chain and returns the
 *  matching tense's record from TENSES (plus `key` and the words it matched
 *  on), or null if nothing in the sentence looks like a verb group. */
export function detectTense(tokens) {
  const words = tokens.map((t) => t.toLowerCase()).filter((t) => /^[a-z']+$/.test(t));

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const w1 = words[i + 1];
    const w2 = words[i + 2];
    const w3 = words[i + 3];

    if (TENSE_AUXILIARIES.modalFuture.includes(w)) {
      if (w1 === 'have' && w2 === 'been' && isIngForm(w3)) return tenseMatch('futurePerfectContinuous', [w, w1, w2, w3]);
      if (w1 === 'have' && isPastParticiple(w2)) return tenseMatch('futurePerfect', [w, w1, w2]);
      if (w1 === 'be' && isIngForm(w2)) return tenseMatch('futureContinuous', [w, w1, w2]);
      if (w1 && w1 !== 'have' && w1 !== 'be') return tenseMatch('simpleFuture', [w, w1]);
    }
    if (TENSE_AUXILIARIES.havePast.includes(w)) {
      if (w1 === 'been' && isIngForm(w2)) return tenseMatch('pastPerfectContinuous', [w, w1, w2]);
      if (isPastParticiple(w1)) return tenseMatch('pastPerfect', [w, w1]);
    }
    if (TENSE_AUXILIARIES.havePresent.includes(w)) {
      if (w1 === 'been' && isIngForm(w2)) return tenseMatch('presentPerfectContinuous', [w, w1, w2]);
      if (isPastParticiple(w1)) return tenseMatch('presentPerfect', [w, w1]);
    }
    if (TENSE_AUXILIARIES.bePast.includes(w) && isIngForm(w1)) return tenseMatch('pastContinuous', [w, w1]);
    if (TENSE_AUXILIARIES.bePresent.includes(w) && isIngForm(w1)) return tenseMatch('presentContinuous', [w, w1]);
  }

  // No auxiliary chain found -- fall back to a bare main verb from the lexicon.
  for (const w of words) {
    if (IRREGULAR_PAST_FORMS.has(w)) return tenseMatch('simplePast', [w]);
    const pastBase = regularPastBase(w);
    if (pastBase) return tenseMatch('simplePast', [w]);
  }
  for (const w of words) {
    const base = presentBase(w);
    if (base) return tenseMatch('simplePresent', [w]);
  }
  return null;
}
