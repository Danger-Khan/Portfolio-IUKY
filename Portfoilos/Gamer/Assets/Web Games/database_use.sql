-- database_use.sql — score storage schema for the Web Games arcade.
--
-- Read this first, because it changes what the file means:
--
-- The arcade does NOT need a database. Every game keeps its best score in the
-- browser's localStorage, which is why the whole folder works offline from a
-- USB stick with no server at all. That is the default and it is what runs on
-- static hosting like GitHub Pages.
--
-- This schema is for the optional case: someone self-hosting the arcade on a
-- machine that actually runs PHP and MySQL/MariaDB, who wants best scores to
-- survive a cleared browser or to be shared between devices. backupengine.php
-- is the endpoint that writes to these tables, and it is only ever called when
-- the player switches "server backup" on from the arcade's settings panel.
--
--   mysql -u <user> -p <database> < database_use.sql
--
-- Written for MySQL / MariaDB. The syntax is deliberately plain so it ports to
-- SQLite or Postgres with only the AUTO_INCREMENT / ENGINE lines changed.

-- --------------------------------------------------------------------------
-- Games. Seeded to match the catalogue in javascript.js -- the `id` values are
-- the same strings the engine uses for its localStorage keys, so a row here
-- lines up with `arcade_best_<id>` in the browser.
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS games (
    id           VARCHAR(32)  NOT NULL,
    title        VARCHAR(64)  NOT NULL,
    folder       VARCHAR(64)  NOT NULL,
    -- Some games score upward (points) and some could score downward (time).
    -- Storing the direction means the leaderboard query does not have to
    -- special-case each game.
    higher_is_better TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO games (id, title, folder, higher_is_better) VALUES
    ('balloon',   'Balloon Shooting', 'Ballon Shooting', 1),
    ('carrace',   'Car Race',         'Car Race',        1),
    ('flappy',    'Flappy Bird',      'Flappy Bird',     1),
    ('spaceio',   'Space IO',         'Space IO',        1),
    ('towerdef',  'Tower Defence',    'Tower Defence',   1),
    ('factoryio', 'Factory IO',       'Factory IO',      1)
ON DUPLICATE KEY UPDATE title = VALUES(title), folder = VALUES(folder);

-- --------------------------------------------------------------------------
-- Every submitted run. Kept as an append-only log rather than one row per
-- player: a history lets you spot a score that jumped from 40 to 4,000,000 in
-- one submission, which a single overwritten "best" column would hide.
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS scores (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    game_id    VARCHAR(32)  NOT NULL,
    player     VARCHAR(48)  NOT NULL DEFAULT 'guest',
    score      INT          NOT NULL,
    -- Truncated hash of the submitting IP. Enough to rate-limit one source
    -- without storing an address that identifies a person.
    source     CHAR(16)     NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_game_score (game_id, score DESC),
    KEY idx_created (created_at),
    CONSTRAINT fk_scores_game FOREIGN KEY (game_id) REFERENCES games (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------------------------
-- Current best per player per game. Derived from `scores`, kept as its own
-- table so the leaderboard is a plain indexed read instead of a MAX() group-by
-- over the whole log every time someone opens the page.
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS best_scores (
    game_id    VARCHAR(32) NOT NULL,
    player     VARCHAR(48) NOT NULL DEFAULT 'guest',
    score      INT         NOT NULL,
    updated_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (game_id, player),
    KEY idx_leaderboard (game_id, score DESC),
    CONSTRAINT fk_best_game FOREIGN KEY (game_id) REFERENCES games (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------------------------
-- Queries backupengine.php actually runs.
-- --------------------------------------------------------------------------

-- Record a run:
--   INSERT INTO scores (game_id, player, score, source) VALUES (?, ?, ?, ?);

-- Promote it to the player's best only if it beats what is stored. The
-- GREATEST() keeps a late-arriving lower score from overwriting a higher one:
--   INSERT INTO best_scores (game_id, player, score) VALUES (?, ?, ?)
--   ON DUPLICATE KEY UPDATE score = GREATEST(score, VALUES(score));

-- Top ten for one game:
--   SELECT player, score, updated_at
--     FROM best_scores
--    WHERE game_id = ?
--    ORDER BY score DESC
--    LIMIT 10;

-- Simple flood check before accepting a submission:
--   SELECT COUNT(*) FROM scores
--    WHERE source = ? AND created_at > (NOW() - INTERVAL 1 MINUTE);
