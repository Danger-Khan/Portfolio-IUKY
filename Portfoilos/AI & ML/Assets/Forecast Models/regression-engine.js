/**
 * regression-engine.js
 * ---------------------------------------------------------------------------
 * A small, dependency-free forecasting engine. Everything here runs entirely
 * in the browser — no network calls, no external libraries, no server.
 *
 * Models implemented:
 *   - Ordinary Least Squares linear regression      -> linearRegression()
 *   - Weighted Least Squares linear regression       -> weightedLinearRegression()
 *   - Polynomial regression (degree 2 or 3)          -> polynomialRegression()
 *   - A real feedforward neural network, trained by  -> neuralNetworkRegression()
 *     full-batch gradient descent with hand-written
 *     backpropagation (1 input -> H tanh hidden neurons -> 1 linear output).
 *
 * All models return a shared shape:
 *   { type, coefficients, equation, predict(x), lossHistory? }
 */

function solveLinearSystem(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col += 1) {
    let pivotRow = col;
    let maxAbs = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(M[r][col]) > maxAbs) {
        maxAbs = Math.abs(M[r][col]);
        pivotRow = r;
      }
    }
    if (maxAbs < 1e-12) {
      throw new Error('This dataset is singular for the chosen model (try fewer points, a lower degree, or more varied x values).');
    }
    if (pivotRow !== col) {
      const tmp = M[col];
      M[col] = M[pivotRow];
      M[pivotRow] = tmp;
    }

    for (let r = col + 1; r < n; r += 1) {
      const factor = M[r][col] / M[col][col];
      for (let c = col; c <= n; c += 1) {
        M[r][c] -= factor * M[col][c];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r -= 1) {
    let sum = M[r][n];
    for (let c = r + 1; c < n; c += 1) {
      sum -= M[r][c] * x[c];
    }
    x[r] = sum / M[r][r];
  }
  return x;
}

function equationFromCoefficients(coefficients) {
  let equation = 'y =';
  coefficients.forEach((c, power) => {
    const xPart = power === 0 ? '' : (power === 1 ? 'x' : `x^${power}`);
    const magnitude = Math.abs(c).toFixed(4);
    if (power === 0) {
      equation += `${c < 0 ? ' -' : ''} ${magnitude}`;
    } else {
      equation += ` ${c < 0 ? '-' : '+'} ${magnitude}${xPart}`;
    }
  });
  return equation;
}

export function linearRegression(points) {
  const n = points.length;
  if (n < 2) throw new Error('Linear regression needs at least 2 points.');

  const xBar = points.reduce((s, p) => s + p.x, 0) / n;
  const yBar = points.reduce((s, p) => s + p.y, 0) / n;

  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - xBar) * (p.y - yBar);
    den += (p.x - xBar) ** 2;
  }
  if (Math.abs(den) < 1e-12) {
    throw new Error('All x values are identical — linear regression needs variation in x.');
  }

  const slope = num / den;
  const intercept = yBar - slope * xBar;
  const coefficients = [intercept, slope];

  return {
    type: 'Linear Regression (OLS)',
    coefficients,
    equation: equationFromCoefficients(coefficients),
    predict: (x) => intercept + slope * x
  };
}

export function weightedLinearRegression(points) {
  const n = points.length;
  if (n < 2) throw new Error('Weighted regression needs at least 2 points.');

  let W = 0;
  let Sx = 0;
  let Sy = 0;
  let Sxx = 0;
  let Sxy = 0;

  for (const p of points) {
    const w = p.w != null && p.w > 0 ? p.w : 1;
    W += w;
    Sx += w * p.x;
    Sy += w * p.y;
    Sxx += w * p.x * p.x;
    Sxy += w * p.x * p.y;
  }

  const denominator = W * Sxx - Sx * Sx;
  if (Math.abs(denominator) < 1e-12) {
    throw new Error('Weighted regression is singular for this data — try more varied x values or weights.');
  }

  const slope = (W * Sxy - Sx * Sy) / denominator;
  const intercept = (Sy - slope * Sx) / W;
  const coefficients = [intercept, slope];

  return {
    type: 'Weighted Linear Regression (WLS)',
    coefficients,
    equation: equationFromCoefficients(coefficients),
    predict: (x) => intercept + slope * x
  };
}

export function polynomialRegression(points, degree) {
  const n = points.length;
  if (n < degree + 1) {
    throw new Error(`A degree-${degree} polynomial needs at least ${degree + 1} points.`);
  }

  const size = degree + 1;
  const XtX = Array.from({ length: size }, () => new Array(size).fill(0));
  const Xty = new Array(size).fill(0);

  for (const p of points) {
    const powers = new Array(size);
    powers[0] = 1;
    for (let k = 1; k < size; k += 1) powers[k] = powers[k - 1] * p.x;

    for (let i = 0; i < size; i += 1) {
      Xty[i] += powers[i] * p.y;
      for (let j = 0; j < size; j += 1) {
        XtX[i][j] += powers[i] * powers[j];
      }
    }
  }

  const coefficients = solveLinearSystem(XtX, Xty);

  return {
    type: `Polynomial Regression (degree ${degree})`,
    coefficients,
    equation: equationFromCoefficients(coefficients),
    predict: (x) => coefficients.reduce((sum, c, power) => sum + c * x ** power, 0)
  };
}

export function neuralNetworkRegression(points, options = {}) {
  const hiddenSize = Math.max(1, Math.min(32, options.hiddenSize || 8));
  const epochs = Math.max(1, Math.min(5000, options.epochs || 400));
  const learningRate = options.learningRate || 0.15;
  const n = points.length;

  if (n < 3) throw new Error('The neural network needs at least 3 points to train on.');

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  const normX = (x) => (2 * (x - xMin)) / xRange - 1;
  const normY = (y) => (2 * (y - yMin)) / yRange - 1;
  const denormY = (yn) => ((yn + 1) / 2) * yRange + yMin;

  const randInit = () => (Math.random() * 2 - 1) * Math.sqrt(1 / hiddenSize) * 2;
  const W1 = Array.from({ length: hiddenSize }, randInit);
  const b1 = new Array(hiddenSize).fill(0);
  const W2 = Array.from({ length: hiddenSize }, randInit);
  let b2 = 0;

  const nx = xs.map(normX);
  const ny = ys.map(normY);
  const lossHistory = [];
  const sampleEvery = Math.max(1, Math.floor(epochs / 60));

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gW1 = new Array(hiddenSize).fill(0);
    const gb1 = new Array(hiddenSize).fill(0);
    const gW2 = new Array(hiddenSize).fill(0);
    let gb2 = 0;
    let epochLoss = 0;

    for (let i = 0; i < n; i += 1) {
      const x = nx[i];
      const yTrue = ny[i];

      const a1 = new Array(hiddenSize);
      for (let j = 0; j < hiddenSize; j += 1) {
        a1[j] = Math.tanh(W1[j] * x + b1[j]);
      }
      let output = b2;
      for (let j = 0; j < hiddenSize; j += 1) output += W2[j] * a1[j];

      const error = output - yTrue;
      epochLoss += error * error;

      const dOutput = (2 * error) / n;
      for (let j = 0; j < hiddenSize; j += 1) {
        gW2[j] += dOutput * a1[j];
        const dA1 = dOutput * W2[j];
        const dZ1 = dA1 * (1 - a1[j] * a1[j]);
        gW1[j] += dZ1 * x;
        gb1[j] += dZ1;
      }
      gb2 += dOutput;
    }

    for (let j = 0; j < hiddenSize; j += 1) {
      W1[j] -= learningRate * gW1[j];
      b1[j] -= learningRate * gb1[j];
      W2[j] -= learningRate * gW2[j];
    }
    b2 -= learningRate * gb2;

    if (epoch % sampleEvery === 0 || epoch === epochs - 1) {
      lossHistory.push(epochLoss / n);
    }
  }

  function predict(xRaw) {
    const x = normX(xRaw);
    let output = b2;
    for (let j = 0; j < hiddenSize; j += 1) {
      output += W2[j] * Math.tanh(W1[j] * x + b1[j]);
    }
    return denormY(output);
  }

  return {
    type: `Neural Network (1-${hiddenSize}-1 MLP)`,
    coefficients: [],
    equation: `1 -> ${hiddenSize} (tanh) -> 1 (linear), ${epochs} epochs @ lr=${learningRate}`,
    predict,
    lossHistory
  };
}

export function computeMetrics(points, predict) {
  const n = points.length;
  const yBar = points.reduce((s, p) => s + p.y, 0) / n;

  let ssRes = 0;
  let ssTot = 0;
  let absSum = 0;

  for (const p of points) {
    const yHat = predict(p.x);
    const residual = p.y - yHat;
    ssRes += residual * residual;
    ssTot += (p.y - yBar) ** 2;
    absSum += Math.abs(residual);
  }

  const r2 = ssTot < 1e-12 ? 1 : 1 - ssRes / ssTot;
  const rmse = Math.sqrt(ssRes / n);
  const mae = absSum / n;

  return { r2, rmse, mae };
}

export function forecast(model, points, horizon) {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  let step = 1;
  if (sorted.length >= 2) {
    let totalGap = 0;
    for (let i = 1; i < sorted.length; i += 1) totalGap += sorted[i].x - sorted[i - 1].x;
    step = totalGap / (sorted.length - 1) || 1;
  }

  const lastX = sorted[sorted.length - 1].x;
  const results = [];
  for (let i = 1; i <= horizon; i += 1) {
    const x = lastX + step * i;
    results.push({ x, y: model.predict(x) });
  }
  return results;
}
