-- database.sql
-- Rule tables for the Humanizer — every phrase/word/contraction swap it makes
-- lives here, not hidden in code. Engine.js keeps its own JS copy of this
-- same data (a browser can't read a .sql file directly without a server);
-- backend_pipeline.py loads this file straight into SQLite. Keep both in
-- sync if you add rules.

CREATE TABLE IF NOT EXISTS ai_phrases (
  id          INTEGER PRIMARY KEY,
  phrase      TEXT NOT NULL,     -- matched case-insensitively, as a whole phrase
  replacement TEXT NOT NULL,
  category    TEXT NOT NULL      -- 'filler', 'cliche', or 'transition'
);

CREATE TABLE IF NOT EXISTS word_substitutions (
  id            INTEGER PRIMARY KEY,
  formal_word   TEXT NOT NULL,   -- matched as a whole word, case-insensitive
  casual_word   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contractions (
  id         INTEGER PRIMARY KEY,
  expanded   TEXT NOT NULL,      -- e.g. "it is"
  contracted TEXT NOT NULL       -- e.g. "it's"
);

INSERT OR IGNORE INTO ai_phrases (id, phrase, replacement, category) VALUES
  (1,  'in today''s fast-paced world',        'these days',              'cliche'),
  (2,  'it is important to note that',        'worth noting:',           'filler'),
  (3,  'in conclusion',                       'overall',                 'transition'),
  (4,  'delve into',                          'dig into',                'cliche'),
  (5,  'navigate the complexities of',        'deal with',               'cliche'),
  (6,  'in the realm of',                     'in',                      'filler'),
  (7,  'plays a crucial role',                'matters a lot',           'cliche'),
  (8,  'plays a pivotal role',                'matters a lot',           'cliche'),
  (9,  'embark on a journey',                 'start out',               'cliche'),
  (10, 'unlock the potential of',             'get the most out of',     'cliche'),
  (11, 'a testament to',                      'proof of',                'cliche'),
  (12, 'at the end of the day',               'in the end',              'filler'),
  (13, 'rich tapestry of',                    'mix of',                  'cliche'),
  (14, 'in order to',                         'to',                      'filler'),
  (15, 'with respect to',                     'about',                   'filler'),
  (16, 'in regard to',                        'about',                   'filler'),
  (17, 'prior to',                            'before',                  'filler'),
  (18, 'a wide range of',                     'lots of',                 'cliche'),
  (19, 'it goes without saying that',         'obviously,',              'filler'),
  (20, 'needless to say',                     'obviously,',              'filler');

INSERT OR IGNORE INTO word_substitutions (id, formal_word, casual_word) VALUES
  (1,  'utilize',       'use'),
  (2,  'utilizes',      'uses'),
  (3,  'utilizing',     'using'),
  (4,  'leverage',      'use'),
  (5,  'leveraging',    'using'),
  (6,  'commence',      'start'),
  (7,  'commenced',     'started'),
  (8,  'terminate',     'end'),
  (9,  'obtain',        'get'),
  (10, 'obtained',      'got'),
  (11, 'purchase',      'buy'),
  (12, 'endeavor',      'try'),
  (13, 'facilitate',    'help'),
  (14, 'demonstrate',   'show'),
  (15, 'demonstrates',  'shows'),
  (16, 'indicate',      'show'),
  (17, 'indicates',     'shows'),
  (18, 'require',       'need'),
  (19, 'requires',      'needs'),
  (20, 'additional',    'more'),
  (21, 'numerous',      'many'),
  (22, 'approximately', 'about'),
  (23, 'subsequently',  'then'),
  (24, 'nevertheless',  'still'),
  (25, 'notwithstanding','still'),
  (26, 'robust',        'solid'),
  (27, 'seamless',      'smooth'),
  (28, 'seamlessly',    'smoothly'),
  (29, 'boasts',        'has'),
  (30, 'myriad',        'many'),
  (31, 'holistic',      'complete'),
  (32, 'underscore',    'highlight'),
  (33, 'underscores',   'highlights'),
  (34, 'furthermore',   'also'),
  (35, 'moreover',      'plus');

INSERT OR IGNORE INTO contractions (id, expanded, contracted) VALUES
  (1,  'it is',      'it''s'),
  (2,  'that is',    'that''s'),
  (3,  'do not',     'don''t'),
  (4,  'does not',   'doesn''t'),
  (5,  'did not',    'didn''t'),
  (6,  'cannot',     'can''t'),
  (7,  'can not',    'can''t'),
  (8,  'will not',   'won''t'),
  (9,  'is not',     'isn''t'),
  (10, 'are not',    'aren''t'),
  (11, 'was not',    'wasn''t'),
  (12, 'were not',   'weren''t'),
  (13, 'has not',    'hasn''t'),
  (14, 'have not',   'haven''t'),
  (15, 'would not',  'wouldn''t'),
  (16, 'should not', 'shouldn''t'),
  (17, 'could not',  'couldn''t'),
  (18, 'I am',       'I''m'),
  (19, 'you are',    'you''re'),
  (20, 'we are',     'we''re'),
  (21, 'they are',   'they''re');
