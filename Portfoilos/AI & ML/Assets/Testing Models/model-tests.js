/**
 * model-tests.js
 * ---------------------------------------------------------------------------
 * A real accuracy/correctness test harness for the other three model
 * folders — not a demo, an actual evaluation against known ground truth:
 *   - Regression models: fit on a train split of synthetic data with a
 *     KNOWN true relationship, scored against a held-out test split.
 *   - Sentiment analysis: run against a small hand-labeled test set,
 *     reporting raw accuracy.
 *   - Color extraction: k-means run on pixels with exactly 3 known colors,
 *     checking whether it actually recovers them.
 */

import {
  linearRegression,
  weightedLinearRegression,
  polynomialRegression,
  neuralNetworkRegression,
  computeMetrics
} from '../Forecast Models/regression-engine.js';
import { kMeansColors } from '../Image Models/image-engine.js';
import { analyzeSentiment } from '../NLP Models/nlp-engine.js';

/** Tiny seeded PRNG (mulberry32) so the synthetic regression test data is
 *  identical on every run — a test whose inputs change each run isn't
 *  really testing anything reproducibly. */
function mulberry32(seed) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generates synthetic data from a KNOWN linear relationship (y = 3 + 2x)
 *  plus noise, splits it 80/20 into train/test, fits every regression
 *  model on train, and scores each against the held-out test points —
 *  a genuine train/test evaluation, not a fit-quality check against the
 *  same data the model was trained on. */
export function testRegressionModels() {
  const rng = mulberry32(42);
  const trueSlope = 2;
  const trueIntercept = 3;

  const allPoints = [];
  for (let x = 1; x <= 30; x += 1) {
    const noise = (rng() - 0.5) * 4;
    allPoints.push({ x, y: trueIntercept + trueSlope * x + noise, w: 1 });
  }

  const testPoints = allPoints.filter((_, i) => i % 5 === 4);
  const trainPoints = allPoints.filter((_, i) => i % 5 !== 4);

  const models = {
    'Linear (OLS)': () => linearRegression(trainPoints),
    'Weighted Linear (WLS)': () => weightedLinearRegression(trainPoints),
    'Polynomial (degree 2)': () => polynomialRegression(trainPoints, 2),
    'Polynomial (degree 3)': () => polynomialRegression(trainPoints, 3),
    'Neural Network (MLP)': () => neuralNetworkRegression(trainPoints, { hiddenSize: 8, epochs: 400, learningRate: 0.15 })
  };

  const results = Object.entries(models).map(([name, fit]) => {
    try {
      const model = fit();
      const trainMetrics = computeMetrics(trainPoints, model.predict);
      const testMetrics = computeMetrics(testPoints, model.predict);
      return {
        name,
        trained: true,
        trainR2: trainMetrics.r2,
        testR2: testMetrics.r2,
        testRmse: testMetrics.rmse,
        testMae: testMetrics.mae
      };
    } catch (err) {
      return { name, trained: false, error: err.message || 'Failed to fit.' };
    }
  });

  return {
    trueRelationship: `y = ${trueIntercept} + ${trueSlope}x + noise`,
    trainSize: trainPoints.length,
    testSize: testPoints.length,
    results
  };
}

const SENTIMENT_TEST_SET = [
  { text: "I absolutely love this, it's amazing and wonderful!", expected: 'Positive' },
  { text: 'This is terrible, I hate it so much.', expected: 'Negative' },
  { text: 'The weather today is cloudy.', expected: 'Neutral' },
  { text: 'What a fantastic and brilliant idea, great job!', expected: 'Positive' },
  { text: 'This is the worst experience ever, awful and disappointing.', expected: 'Negative' },
  { text: 'The meeting is scheduled for 3pm tomorrow.', expected: 'Neutral' },
  { text: "I'm so happy and excited about this wonderful news!", expected: 'Positive' },
  { text: 'This product is broken and useless, very frustrating.', expected: 'Negative' },
  { text: 'She walked to the store to buy some bread.', expected: 'Neutral' },
  { text: "Best purchase I've ever made, absolutely perfect!", expected: 'Positive' }
];

/** Runs the lexicon-based sentiment analyzer against a small hand-labeled
 *  test set and reports raw accuracy. */
export function testSentimentAnalysis() {
  const details = SENTIMENT_TEST_SET.map(({ text, expected }) => {
    const result = analyzeSentiment(text);
    return { text, expected, predicted: result.label, correct: result.label === expected };
  });

  const correct = details.filter((d) => d.correct).length;

  return {
    total: details.length,
    correct,
    accuracy: correct / details.length,
    details
  };
}

/** Builds a synthetic pixel set with exactly 3 known, distinct colors and
 *  checks whether k-means (k=3) recovers them within a small tolerance —
 *  a correctness check against a known ground truth, not just "did it
 *  run without throwing." */
export function testColorExtraction() {
  const trueColors = [
    [230, 40, 40],
    [40, 200, 90],
    [50, 90, 230]
  ];

  const pixels = [];
  for (const color of trueColors) {
    for (let i = 0; i < 300; i += 1) pixels.push(color);
  }

  const clusters = kMeansColors(pixels, 3);

  const matched = trueColors.map((trueColor) => {
    let best = null;
    let bestDist = Infinity;
    for (const cluster of clusters) {
      const d = Math.hypot(
        cluster.color[0] - trueColor[0],
        cluster.color[1] - trueColor[1],
        cluster.color[2] - trueColor[2]
      );
      if (d < bestDist) {
        bestDist = d;
        best = cluster;
      }
    }
    return { trueColor, recovered: best ? best.color : null, error: bestDist };
  });

  const maxError = Math.max(...matched.map((m) => m.error));

  return {
    passed: maxError < 5,
    clusterCount: clusters.length,
    matched,
    maxError
  };
}

export function runAllTests() {
  return {
    regression: testRegressionModels(),
    sentiment: testSentimentAnalysis(),
    colorExtraction: testColorExtraction()
  };
}
