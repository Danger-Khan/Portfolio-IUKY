-- database.sql — Slicer Lab data.
--
-- material_profiles: real, standard FDM print-setting ranges per material
-- (nozzle/bed temperature, fan, speed) — the kind of reference card that
-- ships with Cura/PrusaSlicer/OrcaSlicer/Bambu Studio profiles.
--
-- real_jobs: the actual PrusaSlicer summary stats read out of the five real
-- .gcode files sitting in ../Freelance in this portfolio (not invented —
-- copied from each file's own "; estimated printing time" / "; filament
-- used [g]" / etc. header comments). engine.js keeps its own JS copy of
-- both tables (a browser can't read a .sql file without a server);
-- analyzer.py loads this file straight into SQLite.

CREATE TABLE IF NOT EXISTS material_profiles (
  id               INTEGER PRIMARY KEY,
  material         TEXT NOT NULL,
  nozzle_temp_min  INTEGER NOT NULL,
  nozzle_temp_max  INTEGER NOT NULL,
  bed_temp_min     INTEGER NOT NULL,
  bed_temp_max     INTEGER NOT NULL,
  fan_hint         TEXT NOT NULL,
  speed_hint       TEXT NOT NULL,
  notes            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS real_jobs (
  id               INTEGER PRIMARY KEY,
  filename         TEXT NOT NULL,
  part_name        TEXT NOT NULL,
  material         TEXT NOT NULL,
  print_time       TEXT NOT NULL,
  filament_g       REAL NOT NULL,
  filament_cost    REAL NOT NULL,
  nozzle_temp      INTEGER NOT NULL,
  bed_temp         INTEGER NOT NULL,
  note             TEXT NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO material_profiles
  (id, material, nozzle_temp_min, nozzle_temp_max, bed_temp_min, bed_temp_max, fan_hint, speed_hint, notes) VALUES
  (1, 'PLA',      190, 220,  50,  60, '100% after the first layer',   '40-60 mm/s',
      'Easiest material to print — low warping, no enclosure needed. Lowest heat resistance of the common filaments, so not great for hot environments (e.g. a car dashboard).'),
  (2, 'PETG',     230, 250,  70,  90, '30-50% — too much fan causes weak layer bonding', '40-60 mm/s',
      'Stronger and more temperature-resistant than PLA, but strings more. Every real print in this portfolio''s CAM folder was PETG (see Real Jobs below) at 230-240C / 80C bed.'),
  (3, 'ABS',      230, 250,  90, 110, '0-10% — high fan causes layer cracking/warping', '40-60 mm/s',
      'Warps badly without an enclosure and a heated bed; needs ventilation (fumes). More impact- and heat-resistant than PLA/PETG.'),
  (4, 'TPU/FLEX', 210, 230,  30,  60, '20-50%',                        '15-30 mm/s (slow — direct drive helps a lot)',
      'Flexible filament — slow print speeds and minimal retraction avoid jams in a bowden setup. The 11h43m FLEX print in this portfolio''s CAM folder ran at 190C nozzle / 40C bed.'),
  (5, 'ASA',      240, 260,  90, 110, '0-10%',                         '40-60 mm/s',
      'ABS-like properties with better UV resistance — a common choice for outdoor parts. Needs an enclosure like ABS.'),
  (6, 'Nylon',    240, 270,  70,  90, '0-20%',                         '30-50 mm/s',
      'Very tough and abrasion-resistant, but hygroscopic — absorbs moisture from the air and must be dried before printing or it will bubble/pop mid-print.');

-- Cost is whatever currency the original PrusaSlicer material-cost profile
-- was configured in — not verified here, so shown as-is without a currency
-- symbol rather than guessing.
INSERT OR IGNORE INTO real_jobs
  (id, filename, part_name, material, print_time, filament_g, filament_cost, nozzle_temp, bed_temp, note) VALUES
  (1, '33m,PETG,cabletiebelttensioner.gcode', 'Cable Tie Belt Tensioner', 'PETG', '33m 18s',   4.09,   163.57, 240, 80, ''),
  (2, '18m,PETG,riemenspanner.gcode',         'Riemenspanner',            'PETG', '17m 43s',   2.24,    89.60, 240, 80, ''),
  (3, '1h49m,PETG,box.gcode',                 'Box',                      'PETG', '1h 49m 18s', 56.50, 2260.13, 230, 80, ''),
  (4, '40m,PETG,box.gcode',                   'Box (resumed print)',      'PETG', '1h 49m 18s', 56.50, 2260.13, 230, 80,
      'Filename says 40m, but the file''s own embedded stats report the same totals as the 1h49m box above — its G-code body starts mid-object at Z38.3mm, consistent with a resliced resume-after-pause file. Shown exactly as the file reports it, not corrected.'),
  (5, '11h43m,FLEX,pl.gcode',                 'PL (Recycler part)',       'FLEX', '11h 43m 27s', 70.24, 2458.38, 190, 40, '');
