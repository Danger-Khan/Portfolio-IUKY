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

-- Deleted entirely (whole word/phrase, case-insensitive) when "Length" = Shorten.
CREATE TABLE IF NOT EXISTS filler_terms (
  id   INTEGER PRIMARY KEY,
  term TEXT NOT NULL
);

-- Prepended to alternating sentences, in id order, when "Length" = Extend.
CREATE TABLE IF NOT EXISTS transition_connectors (
  id        INTEGER PRIMARY KEY,
  connector TEXT NOT NULL
);

-- US -> UK spelling, whole word, case-insensitive. Used for both the "UK" and
-- "AUS" dialect options — Australian English follows British spelling here.
-- Only unambiguous spelling-only pairs are included (e.g. "tire"/"tyre" and
-- "practice"/"practise" are skipped: both have a second, unrelated meaning in
-- English where swapping the spelling would just be wrong).
CREATE TABLE IF NOT EXISTS us_uk_spelling (
  id          INTEGER PRIMARY KEY,
  us_spelling TEXT NOT NULL,
  uk_spelling TEXT NOT NULL
);

-- Business/tech jargon -> plain English, matched as a whole word/phrase,
-- case-insensitive. Applied when "Remove jargon" is on.
CREATE TABLE IF NOT EXISTS jargon_terms (
  id     INTEGER PRIMARY KEY,
  jargon TEXT NOT NULL,
  plain  TEXT NOT NULL
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

INSERT OR IGNORE INTO filler_terms (id, term) VALUES
  (1,  'really'), (2, 'very'), (3, 'actually'), (4, 'basically'),
  (5,  'just'), (6, 'quite'), (7, 'simply'), (8, 'certainly'),
  (9,  'definitely'), (10, 'literally'), (11, 'essentially'), (12, 'virtually'),
  (13, 'totally'), (14, 'absolutely'), (15, 'truly'),
  (16, 'in fact'), (17, 'as a matter of fact'), (18, 'so to speak'),
  (19, 'sort of'), (20, 'kind of'), (21, 'to be honest'), (22, 'if you will');

INSERT OR IGNORE INTO transition_connectors (id, connector) VALUES
  (1, 'In addition, '), (2, 'What''s more, '), (3, 'On top of that, '),
  (4, 'To put it another way, '), (5, 'Building on that, '), (6, 'Beyond that, ');

INSERT OR IGNORE INTO us_uk_spelling (id, us_spelling, uk_spelling) VALUES
  (1,  'color', 'colour'), (2, 'colors', 'colours'), (3, 'colored', 'coloured'), (4, 'coloring', 'colouring'),
  (5,  'favorite', 'favourite'), (6, 'favorites', 'favourites'),
  (7,  'honor', 'honour'), (8, 'honors', 'honours'), (9, 'honored', 'honoured'), (10, 'honoring', 'honouring'),
  (11, 'labor', 'labour'), (12, 'labors', 'labours'), (13, 'labored', 'laboured'), (14, 'laboring', 'labouring'),
  (15, 'neighbor', 'neighbour'), (16, 'neighbors', 'neighbours'), (17, 'neighborhood', 'neighbourhood'), (18, 'neighborhoods', 'neighbourhoods'),
  (19, 'behavior', 'behaviour'), (20, 'behaviors', 'behaviours'), (21, 'behavioral', 'behavioural'),
  (22, 'center', 'centre'), (23, 'centers', 'centres'), (24, 'centered', 'centred'), (25, 'centering', 'centring'),
  (26, 'theater', 'theatre'), (27, 'theaters', 'theatres'),
  (28, 'liter', 'litre'), (29, 'liters', 'litres'),
  (30, 'fiber', 'fibre'), (31, 'fibers', 'fibres'),
  (32, 'organize', 'organise'), (33, 'organizes', 'organises'), (34, 'organized', 'organised'), (35, 'organizing', 'organising'), (36, 'organization', 'organisation'), (37, 'organizations', 'organisations'),
  (38, 'realize', 'realise'), (39, 'realizes', 'realises'), (40, 'realized', 'realised'), (41, 'realizing', 'realising'), (42, 'realization', 'realisation'),
  (43, 'recognize', 'recognise'), (44, 'recognizes', 'recognises'), (45, 'recognized', 'recognised'), (46, 'recognizing', 'recognising'),
  (47, 'analyze', 'analyse'), (48, 'analyzes', 'analyses'), (49, 'analyzed', 'analysed'), (50, 'analyzing', 'analysing'),
  (51, 'apologize', 'apologise'), (52, 'apologized', 'apologised'), (53, 'apologizing', 'apologising'),
  (54, 'capitalize', 'capitalise'), (55, 'capitalized', 'capitalised'),
  (56, 'customize', 'customise'), (57, 'customized', 'customised'),
  (58, 'emphasize', 'emphasise'), (59, 'emphasized', 'emphasised'),
  (60, 'finalize', 'finalise'), (61, 'finalized', 'finalised'),
  (62, 'maximize', 'maximise'), (63, 'maximized', 'maximised'),
  (64, 'minimize', 'minimise'), (65, 'minimized', 'minimised'),
  (66, 'memorize', 'memorise'), (67, 'memorized', 'memorised'),
  (68, 'optimize', 'optimise'), (69, 'optimized', 'optimised'),
  (70, 'prioritize', 'prioritise'), (71, 'prioritized', 'prioritised'),
  (72, 'specialize', 'specialise'), (73, 'specialized', 'specialised'),
  (74, 'summarize', 'summarise'), (75, 'summarized', 'summarised'),
  (76, 'utilize', 'utilise'), (77, 'utilizes', 'utilises'), (78, 'utilized', 'utilised'), (79, 'utilizing', 'utilising'),
  (80, 'defense', 'defence'), (81, 'defenses', 'defences'),
  (82, 'offense', 'offence'), (83, 'offenses', 'offences'),
  (84, 'gray', 'grey'),
  (85, 'aluminum', 'aluminium'),
  (86, 'mom', 'mum'), (87, 'moms', 'mums'),
  (88, 'math', 'maths'),
  (89, 'airplane', 'aeroplane'), (90, 'airplanes', 'aeroplanes'),
  (91, 'cozy', 'cosy'),
  (92, 'pajamas', 'pyjamas'),
  (93, 'jewelry', 'jewellery'),
  (94, 'traveled', 'travelled'), (95, 'traveling', 'travelling'), (96, 'traveler', 'traveller'), (97, 'travelers', 'travellers'),
  (98, 'canceled', 'cancelled'), (99, 'canceling', 'cancelling'),
  (100, 'modeling', 'modelling'), (101, 'modeled', 'modelled'),
  (102, 'fueled', 'fuelled'), (103, 'fueling', 'fuelling'),
  (104, 'signaled', 'signalled'), (105, 'signaling', 'signalling'),
  (106, 'counselor', 'counsellor'), (107, 'counselors', 'counsellors'),
  (108, 'plow', 'plough'), (109, 'plows', 'ploughs'),
  (110, 'mold', 'mould'), (111, 'molds', 'moulds'), (112, 'molding', 'moulding'),
  (113, 'skeptic', 'sceptic'), (114, 'skeptical', 'sceptical'), (115, 'skepticism', 'scepticism');

INSERT OR IGNORE INTO jargon_terms (id, jargon, plain) VALUES
  (1,  'synergy', 'teamwork'), (2, 'synergies', 'benefits'),
  (3,  'circle back', 'follow up'), (4, 'touch base', 'talk'),
  (5,  'low-hanging fruit', 'easy wins'), (6, 'move the needle', 'make a difference'),
  (7,  'deep dive', 'close look'), (8, 'deep-dive', 'close look'),
  (9,  'actionable', 'useful'), (10, 'bandwidth', 'capacity'),
  (11, 'ecosystem', 'network'), (12, 'value-add', 'benefit'), (13, 'value add', 'benefit'),
  (14, 'best-in-class', 'top-tier'), (15, 'best in class', 'top-tier'),
  (16, 'game-changer', 'big deal'), (17, 'game changer', 'big deal'),
  (18, 'think outside the box', 'get creative'),
  (19, 'going forward', 'from now on'),
  (20, 'reach out', 'contact'), (21, 'loop in', 'include'), (22, 'loop you in', 'include you'),
  (23, 'take this offline', 'discuss this separately'),
  (24, 'core competency', 'strength'), (25, 'core competencies', 'strengths'),
  (26, 'paradigm shift', 'major change'),
  (27, 'ideate', 'brainstorm'),
  (28, 'operationalize', 'put into practice'),
  (29, 'incentivize', 'motivate'),
  (30, 'drill down', 'look closer'),
  (31, 'level set', 'get on the same page'),
  (32, 'boil the ocean', 'try to do too much'),
  (33, 'bleeding edge', 'newest'),
  (34, 'best practice', 'proven method'), (35, 'best practices', 'proven methods'),
  (36, 'win-win', 'good for everyone');
