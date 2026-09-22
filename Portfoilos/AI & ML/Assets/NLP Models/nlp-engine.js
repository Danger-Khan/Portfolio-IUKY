/**
 * nlp-engine.js
 * ---------------------------------------------------------------------------
 * Small, dependency-free NLP tools — lexicon-based sentiment analysis,
 * TF keyword extraction with stopword filtering, and basic text stats.
 * No external library, no pretrained model file, no network call.
 */

const POSITIVE_WORDS = new Set([
  'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'awesome', 'love', 'loved', 'loving',
  'happy', 'joy', 'joyful', 'excited', 'exciting', 'brilliant', 'perfect', 'best', 'beautiful', 'nice',
  'positive', 'superb', 'outstanding', 'delightful', 'pleased', 'glad', 'fabulous', 'impressive', 'favorite',
  'favourite', 'recommend', 'recommended', 'success', 'successful', 'win', 'winning', 'victory', 'grateful',
  'thank', 'thanks', 'appreciate', 'enjoy', 'enjoyed', 'enjoyable', 'satisfying', 'satisfied', 'remarkable',
  'incredible', 'marvelous', 'terrific', 'admire', 'admirable', 'charming', 'cheerful', 'comfortable',
  'confident', 'courageous', 'delight', 'easy', 'efficient', 'elegant', 'encouraging', 'fun', 'generous',
  'genuine', 'gorgeous', 'graceful', 'helpful', 'honest', 'hope', 'hopeful', 'inspiring', 'kind', 'lovely',
  'lucky', 'magnificent', 'motivated', 'optimistic', 'peaceful', 'pleasant', 'proud', 'reliable', 'safe',
  'smart', 'stunning', 'supportive', 'sweet', 'talented', 'thoughtful', 'thrilled', 'trust', 'trustworthy',
  'valuable', 'vibrant', 'warm', 'welcome', 'wise', 'worthy'
]);

const NEGATIVE_WORDS = new Set([
  'bad', 'terrible', 'horrible', 'awful', 'worst', 'hate', 'hated', 'hating', 'sad', 'angry', 'upset',
  'disappointing', 'disappointed', 'disappointment', 'poor', 'fail', 'failure', 'failed', 'broken', 'useless',
  'frustrating', 'frustrated', 'annoying', 'annoyed', 'wrong', 'worse', 'negative', 'ugly', 'painful', 'pain',
  'boring', 'bored', 'confusing', 'confused', 'difficult', 'disgusting', 'dreadful', 'embarrassing',
  'unpleasant', 'unhappy', 'unfortunate', 'unacceptable', 'regret', 'regrettable', 'ridiculous', 'rude',
  'scared', 'scary', 'slow', 'stupid', 'tragic', 'trouble', 'troubling', 'unfair', 'unreliable', 'waste',
  'wasted', 'weak', 'worried', 'worry', 'worrying', 'awkward', 'careless', 'clumsy', 'cruel', 'dangerous',
  'dark', 'dead', 'deceptive', 'defective', 'deny', 'desperate', 'despise', 'devastating', 'dirty',
  'dishonest', 'disorganized', 'doubt', 'doubtful', 'dull', 'error', 'evil', 'fake', 'fear', 'fearful',
  'harsh', 'harmful', 'hostile', 'hopeless', 'hurt', 'ill', 'illegal', 'inferior', 'insult', 'insulting',
  'irritating', 'lazy', 'liar', 'lie', 'loss', 'lost', 'messy', 'mistake', 'misleading', 'nasty'
]);

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'so', 'of', 'to', 'in', 'on', 'for', 'with', 'at', 'by',
  'from', 'up', 'about', 'into', 'over', 'after', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'it',
  'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'they', 'we', 'my', 'your', 'his', 'her',
  'their', 'our', 'me', 'him', 'them', 'us', 'as', 'not', 'no', 'do', 'does', 'did', 'have', 'has', 'had',
  'will', 'would', 'can', 'could', 'should', 'shall', 'may', 'might', 'must', 'than', 'too', 'very', 'just',
  'there', 'here', 'what', 'when', 'where', 'which', 'who', 'whom', 'how', 'all', 'any', 'some', 'such',
  'because', 'while', 'out', 'off', 'again', 'further', 'once', 'also'
]);

export function tokenize(text) {
  return text.match(/[A-Za-z']+/g) || [];
}

/** Lexicon-based sentiment: counts how many words in the text appear in a
 *  curated positive/negative word list, and classifies by which side wins.
 *  Simple, explainable, and honest about being simple — no claim of
 *  state-of-the-art accuracy, just a real, working technique. */
export function analyzeSentiment(text) {
  const words = tokenize(text);
  const positiveHits = [];
  const negativeHits = [];

  for (const w of words) {
    const lower = w.toLowerCase();
    if (POSITIVE_WORDS.has(lower)) positiveHits.push(lower);
    else if (NEGATIVE_WORDS.has(lower)) negativeHits.push(lower);
  }

  let label = 'Neutral';
  if (positiveHits.length > negativeHits.length) label = 'Positive';
  else if (negativeHits.length > positiveHits.length) label = 'Negative';

  const score = words.length ? (positiveHits.length - negativeHits.length) / words.length : 0;

  return {
    label,
    score,
    positiveCount: positiveHits.length,
    negativeCount: negativeHits.length,
    positiveWords: [...new Set(positiveHits)],
    negativeWords: [...new Set(negativeHits)],
    wordCount: words.length
  };
}

/** Term-frequency keyword extraction: lowercases, strips stopwords and very
 *  short words, counts what's left, returns the top N by frequency. */
export function extractKeywords(text, topN = 8) {
  const words = tokenize(text)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  const counts = new Map();
  for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);

  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, topN);
}

export function textStats(text) {
  const words = tokenize(text);
  const sentences = (text.match(/[^.!?]+[.!?]*/g) || []).filter((s) => s.trim().length > 0);
  const avgWordLength = words.length ? words.reduce((s, w) => s + w.length, 0) / words.length : 0;
  const wordsPerMinute = 200;
  const readingTimeSeconds = Math.ceil((words.length / wordsPerMinute) * 60);

  return {
    words: words.length,
    sentences: sentences.length,
    characters: text.length,
    avgWordLength,
    readingTimeSeconds
  };
}
