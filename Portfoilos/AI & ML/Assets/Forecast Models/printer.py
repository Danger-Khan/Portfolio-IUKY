#!/usr/bin/env python3
"""
printer.py — third stage of the Forecast Models pipeline.

Formats a forecast run stored by worker.py as a readable report: the fitted
equation, R²/RMSE/MAE, and the forecasted points. With no --run given, prints
the most recent run.

Usage:
    python printer.py                 # most recent run
    python printer.py --run 3
    python printer.py --run 3 --out report.txt
"""

import argparse
import sqlite3
import sys

import extractor

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")


def latest_run_id(conn):
    row = conn.execute("SELECT id FROM forecast_runs ORDER BY id DESC LIMIT 1").fetchone()
    if not row:
        raise ValueError("No forecast runs yet — run worker.py first.")
    return row[0]


def format_run(run_id, db_path=extractor.DEFAULT_DB):
    conn = sqlite3.connect(db_path)
    run = conn.execute(
        "SELECT dataset_id, model_type, horizon, run_at FROM forecast_runs WHERE id = ?", (run_id,)
    ).fetchone()
    if not run:
        conn.close()
        raise ValueError(f"No forecast run with id {run_id}.")
    dataset_id, model_type, horizon, run_at = run

    dataset = conn.execute("SELECT name FROM datasets WHERE id = ?", (dataset_id,)).fetchone()
    metrics = conn.execute(
        "SELECT equation, r2, rmse, mae FROM forecast_metrics WHERE run_id = ?", (run_id,)
    ).fetchone()
    forecast_rows = conn.execute(
        "SELECT x, y_predicted FROM forecast_results WHERE run_id = ? AND kind = 'forecast' ORDER BY x",
        (run_id,),
    ).fetchall()
    conn.close()

    equation, r2, rmse, mae = metrics
    lines = [
        f"Forecast Run #{run_id} — {run_at}",
        "=" * 40,
        f"Dataset:  {dataset[0] if dataset else dataset_id}",
        f"Model:    {model_type}",
        f"Equation: {equation}",
        "",
        f"R^2:  {r2:.4f}",
        f"RMSE: {rmse:.4f}",
        f"MAE:  {mae:.4f}",
        "",
        f"Forecast — next {horizon} point(s):",
    ]
    for x, y in forecast_rows:
        lines.append(f"  x={x:>8.2f}   predicted y={y:>10.3f}")
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description="Print a formatted report for a stored forecast run.")
    parser.add_argument("--db", default=str(extractor.DEFAULT_DB))
    parser.add_argument("--run", type=int, help="Run id to report (default: the most recent run).")
    parser.add_argument("--out", metavar="FILE", help="Write the report to a file instead of stdout.")
    args = parser.parse_args()

    conn = extractor.ensure_database(args.db)
    run_id = args.run if args.run is not None else latest_run_id(conn)
    conn.close()

    report = format_run(run_id, args.db)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"wrote {args.out}")
    else:
        print(report, end="")


if __name__ == "__main__":
    main()
