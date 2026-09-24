-- database.sql
-- Schema + seed data for the Forecast Models pipeline (extractor.py -> worker.py
-- -> printer.py). SQLite. extractor.py runs this automatically the first time
-- there's no database file yet, so nothing needs to be run by hand.

CREATE TABLE IF NOT EXISTS datasets (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS data_points (
  id         INTEGER PRIMARY KEY,
  dataset_id INTEGER NOT NULL REFERENCES datasets(id),
  x          REAL NOT NULL,
  y          REAL NOT NULL,
  weight     REAL NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS forecast_runs (
  id         INTEGER PRIMARY KEY,
  dataset_id INTEGER NOT NULL REFERENCES datasets(id),
  model_type TEXT NOT NULL,
  horizon    INTEGER NOT NULL,
  run_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS forecast_results (
  id           INTEGER PRIMARY KEY,
  run_id       INTEGER NOT NULL REFERENCES forecast_runs(id),
  kind         TEXT NOT NULL,        -- 'fit' (a training point's predicted y) or 'forecast' (a future point)
  x            REAL NOT NULL,
  y_predicted  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS forecast_metrics (
  run_id INTEGER PRIMARY KEY REFERENCES forecast_runs(id),
  equation TEXT NOT NULL,
  r2       REAL NOT NULL,
  rmse     REAL NOT NULL,
  mae      REAL NOT NULL
);

-- Same 10-point demo dataset the browser Forecasting Lab loads via "Load
-- Sample Dataset", so a run through this pipeline lines up with the live lab.
INSERT OR IGNORE INTO datasets (id, name, description) VALUES
  (1, 'Sample Growth Series', 'The default 10-point demo dataset — matches the browser lab''s "Load Sample Dataset" button.');

INSERT OR IGNORE INTO data_points (id, dataset_id, x, y, weight) VALUES
  (1,  1, 1,  12.4, 1),
  (2,  1, 2,  15.1, 1),
  (3,  1, 3,  14.8, 1),
  (4,  1, 4,  18.6, 1.2),
  (5,  1, 5,  21.2, 1.2),
  (6,  1, 6,  20.9, 1.5),
  (7,  1, 7,  24.7, 1.5),
  (8,  1, 8,  27.3, 1.8),
  (9,  1, 9,  29.0, 1.8),
  (10, 1, 10, 32.5, 2);
