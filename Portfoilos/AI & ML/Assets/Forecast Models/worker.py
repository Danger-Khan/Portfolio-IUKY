#!/usr/bin/env python3
"""
worker.py — second stage of the Forecast Models pipeline.

Fits a regression model to a dataset pulled by extractor.py, the same math
as Assets/Forecast Models/regression-engine.js (the browser lab's engine):
ordinary least squares, weighted least squares, and polynomial regression.
Stores the fit, its forecast, and its metrics back into the database for
printer.py to report on.

Usage:
    python worker.py --dataset 1 --model weighted --horizon 5
    python worker.py --dataset 1 --model polynomial --degree 2 --horizon 5
"""

import argparse
import sqlite3
import sys

import extractor

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")


def linear_regression(points):
    """points: list of (x, y, weight) — weight is ignored (ordinary least squares)."""
    n = len(points)
    if n < 2:
        raise ValueError("Linear regression needs at least 2 points.")
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    x_bar = sum(xs) / n
    y_bar = sum(ys) / n
    num = sum((x - x_bar) * (y - y_bar) for x, y in zip(xs, ys))
    den = sum((x - x_bar) ** 2 for x in xs)
    if abs(den) < 1e-12:
        raise ValueError("All x values are identical — linear regression needs variation in x.")
    slope = num / den
    intercept = y_bar - slope * x_bar
    return _linear_model("Linear Regression (OLS)", intercept, slope)


def weighted_linear_regression(points):
    n = len(points)
    if n < 2:
        raise ValueError("Weighted regression needs at least 2 points.")
    W = Sx = Sy = Sxx = Sxy = 0.0
    for x, y, w in points:
        w = w if w and w > 0 else 1
        W += w
        Sx += w * x
        Sy += w * y
        Sxx += w * x * x
        Sxy += w * x * y
    denominator = W * Sxx - Sx * Sx
    if abs(denominator) < 1e-12:
        raise ValueError("Weighted regression is singular for this data.")
    slope = (W * Sxy - Sx * Sy) / denominator
    intercept = (Sy - slope * Sx) / W
    return _linear_model("Weighted Linear Regression (WLS)", intercept, slope)


def _linear_model(name, intercept, slope):
    return {
        "type": name,
        "coefficients": [intercept, slope],
        "equation": _equation([intercept, slope]),
        "predict": lambda x: intercept + slope * x,
    }


def polynomial_regression(points, degree):
    n = len(points)
    if n < degree + 1:
        raise ValueError(f"A degree-{degree} polynomial needs at least {degree + 1} points.")
    size = degree + 1
    XtX = [[0.0] * size for _ in range(size)]
    Xty = [0.0] * size

    for x, y, _w in points:
        powers = [1.0] * size
        for k in range(1, size):
            powers[k] = powers[k - 1] * x
        for i in range(size):
            Xty[i] += powers[i] * y
            for j in range(size):
                XtX[i][j] += powers[i] * powers[j]

    coefficients = _solve_linear_system(XtX, Xty)

    def predict(x, coeffs=coefficients):
        return sum(c * (x ** power) for power, c in enumerate(coeffs))

    return {
        "type": f"Polynomial Regression (degree {degree})",
        "coefficients": coefficients,
        "equation": _equation(coefficients),
        "predict": predict,
    }


def _solve_linear_system(A, b):
    """Gaussian elimination with partial pivoting — same approach as the JS engine."""
    n = len(A)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]

    for col in range(n):
        pivot_row = col
        max_abs = abs(M[col][col])
        for r in range(col + 1, n):
            if abs(M[r][col]) > max_abs:
                max_abs = abs(M[r][col])
                pivot_row = r
        if max_abs < 1e-12:
            raise ValueError("This dataset is singular for the chosen model.")
        if pivot_row != col:
            M[col], M[pivot_row] = M[pivot_row], M[col]
        for r in range(col + 1, n):
            factor = M[r][col] / M[col][col]
            for c in range(col, n + 1):
                M[r][c] -= factor * M[col][c]

    x = [0.0] * n
    for r in range(n - 1, -1, -1):
        s = M[r][n]
        for c in range(r + 1, n):
            s -= M[r][c] * x[c]
        x[r] = s / M[r][r]
    return x


def _equation(coefficients):
    equation = "y ="
    for power, c in enumerate(coefficients):
        x_part = "" if power == 0 else ("x" if power == 1 else f"x^{power}")
        magnitude = f"{abs(c):.4f}"
        if power == 0:
            equation += f"{' -' if c < 0 else ''} {magnitude}"
        else:
            equation += f" {'-' if c < 0 else '+'} {magnitude}{x_part}"
    return equation


def compute_metrics(points, predict):
    n = len(points)
    y_bar = sum(p[1] for p in points) / n
    ss_res = ss_tot = abs_sum = 0.0
    for x, y, _w in points:
        y_hat = predict(x)
        residual = y - y_hat
        ss_res += residual ** 2
        ss_tot += (y - y_bar) ** 2
        abs_sum += abs(residual)
    r2 = 1.0 if ss_tot < 1e-12 else 1 - ss_res / ss_tot
    rmse = (ss_res / n) ** 0.5
    mae = abs_sum / n
    return {"r2": r2, "rmse": rmse, "mae": mae}


def forecast(model, points, horizon):
    sorted_pts = sorted(points, key=lambda p: p[0])
    step = 1.0
    if len(sorted_pts) >= 2:
        total_gap = sum(sorted_pts[i][0] - sorted_pts[i - 1][0] for i in range(1, len(sorted_pts)))
        step = total_gap / (len(sorted_pts) - 1) or 1.0
    last_x = sorted_pts[-1][0]
    return [(last_x + step * i, model["predict"](last_x + step * i)) for i in range(1, horizon + 1)]


MODELS = {
    "linear": lambda points, degree: linear_regression(points),
    "weighted": lambda points, degree: weighted_linear_regression(points),
    "polynomial": lambda points, degree: polynomial_regression(points, degree),
}


def run(dataset_id, model_type, horizon, degree=2, db_path=extractor.DEFAULT_DB):
    points = extractor.extract(dataset_id, db_path)
    model = MODELS[model_type](points, degree)
    metrics = compute_metrics(points, model["predict"])
    forecast_points = forecast(model, points, horizon)
    fit_points = [(x, model["predict"](x)) for x, _y, _w in points]

    conn = sqlite3.connect(db_path)
    cur = conn.execute(
        "INSERT INTO forecast_runs (dataset_id, model_type, horizon) VALUES (?, ?, ?)",
        (dataset_id, model["type"], horizon),
    )
    run_id = cur.lastrowid
    conn.executemany(
        "INSERT INTO forecast_results (run_id, kind, x, y_predicted) VALUES (?, 'fit', ?, ?)",
        [(run_id, x, y) for x, y in fit_points],
    )
    conn.executemany(
        "INSERT INTO forecast_results (run_id, kind, x, y_predicted) VALUES (?, 'forecast', ?, ?)",
        [(run_id, x, y) for x, y in forecast_points],
    )
    conn.execute(
        "INSERT INTO forecast_metrics (run_id, equation, r2, rmse, mae) VALUES (?, ?, ?, ?, ?)",
        (run_id, model["equation"], metrics["r2"], metrics["rmse"], metrics["mae"]),
    )
    conn.commit()
    conn.close()
    return run_id


def main():
    parser = argparse.ArgumentParser(description="Fit a regression model and store the forecast run.")
    parser.add_argument("--db", default=str(extractor.DEFAULT_DB))
    parser.add_argument("--dataset", type=int, default=1)
    parser.add_argument("--model", choices=list(MODELS), default="weighted")
    parser.add_argument("--degree", type=int, default=2, help="Polynomial degree (only used with --model polynomial).")
    parser.add_argument("--horizon", type=int, default=5, help="How many points ahead to forecast.")
    args = parser.parse_args()

    extractor.ensure_database(args.db)
    run_id = run(args.dataset, args.model, args.horizon, args.degree, args.db)
    print(f"Stored forecast run #{run_id} ({args.model} model, horizon={args.horizon}).")
    print(f"Report it with: python printer.py --db {args.db} --run {run_id}")


if __name__ == "__main__":
    main()
