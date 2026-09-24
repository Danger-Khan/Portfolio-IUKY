#!/usr/bin/env python3
"""
extractor.py — first stage of the Forecast Models pipeline.

Makes sure database.sql has been loaded into a real SQLite database (creating
it on first run), then pulls a dataset out as clean (x, y, weight) tuples for
worker.py to fit a model against. Also usable standalone to list or inspect
datasets.

Usage:
    python extractor.py --list                  # list datasets in the database
    python extractor.py --dataset 1              # print dataset 1's points
"""

import argparse
import sqlite3
import sys
from pathlib import Path

# Windows consoles default to a legacy codepage that mangles the em dash
# used in the seed description below; force UTF-8 so output looks right.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")

HERE = Path(__file__).resolve().parent
DEFAULT_DB = HERE / "forecast.db"
SCHEMA_SQL = HERE / "database.sql"


def ensure_database(db_path=DEFAULT_DB, schema_path=SCHEMA_SQL):
    """Creates + seeds the SQLite database from database.sql if it doesn't exist yet."""
    db_path = Path(db_path)
    is_new = not db_path.exists()
    conn = sqlite3.connect(db_path)
    if is_new:
        with open(schema_path, encoding="utf-8") as f:
            conn.executescript(f.read())
        conn.commit()
    else:
        # Re-running the schema is safe (CREATE TABLE IF NOT EXISTS / INSERT OR IGNORE),
        # so an existing database still picks up any new seed rows added to the .sql file.
        with open(schema_path, encoding="utf-8") as f:
            conn.executescript(f.read())
        conn.commit()
    return conn


def list_datasets(db_path=DEFAULT_DB):
    conn = ensure_database(db_path)
    rows = conn.execute("SELECT id, name, description FROM datasets ORDER BY id").fetchall()
    conn.close()
    return rows


def extract(dataset_id, db_path=DEFAULT_DB):
    """Returns a list of (x, y, weight) tuples for the given dataset id."""
    conn = ensure_database(db_path)
    rows = conn.execute(
        "SELECT x, y, weight FROM data_points WHERE dataset_id = ? ORDER BY x",
        (dataset_id,),
    ).fetchall()
    conn.close()
    if not rows:
        raise ValueError(f"No data points found for dataset {dataset_id}.")
    return rows


def main():
    parser = argparse.ArgumentParser(description="Extract a dataset from the Forecast Models database.")
    parser.add_argument("--db", default=str(DEFAULT_DB), help="Path to the SQLite database file.")
    parser.add_argument("--list", action="store_true", help="List available datasets and exit.")
    parser.add_argument("--dataset", type=int, default=1, help="Dataset id to extract (default: 1).")
    args = parser.parse_args()

    if args.list:
        for row_id, name, description in list_datasets(args.db):
            print(f"[{row_id}] {name} — {description or ''}")
        return

    points = extract(args.dataset, args.db)
    print(f"Dataset {args.dataset}: {len(points)} point(s)")
    for x, y, w in points:
        print(f"  x={x:>6}  y={y:>8}  weight={w}")


if __name__ == "__main__":
    main()
