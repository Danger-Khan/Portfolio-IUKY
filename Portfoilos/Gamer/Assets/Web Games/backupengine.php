<?php
/**
 * backupengine.php — optional server-side backup of arcade best scores.
 *
 * THIS IS NOT REQUIRED. The arcade keeps every best score in the browser's
 * localStorage and works completely offline; on static hosting (GitHub Pages
 * and the like) PHP never runs and this file is simply an inert text file. The
 * games never check whether it responded.
 *
 * It exists for the one case where it is useful: someone self-hosting the
 * arcade on a server that runs PHP and MySQL/MariaDB, who wants best scores to
 * outlive a cleared browser. The player has to switch "server backup" on in the
 * arcade settings before a single request is sent.
 *
 * Setup:
 *   1. Load database_use.sql into your database.
 *   2. Create config.php next to this file (and keep it out of version control):
 *
 *        <?php return [
 *          'dsn'  => 'mysql:host=localhost;dbname=arcade;charset=utf8mb4',
 *          'user' => 'arcade',
 *          'pass' => 'a real password',
 *          'salt' => 'any long random string',
 *        ];
 *
 * Security notes, since this accepts input from anyone who can reach it:
 *   - every query is a prepared statement, so score data can never be parsed
 *     as SQL;
 *   - game ids are checked against a fixed allow-list rather than trusted;
 *   - scores must be integers inside a sane range;
 *   - player names are length-capped and stripped to a safe character set;
 *   - the client IP is salted, hashed and truncated before storage, which is
 *     enough to rate-limit a source without keeping data that identifies a
 *     person;
 *   - submissions are rate-limited per source.
 *
 * What it deliberately does NOT do is claim the scores are trustworthy. Any
 * score posted by a browser can be forged by anyone willing to open the network
 * tab, and no amount of server validation changes that. Treat this as a
 * convenience backup, not a competitive leaderboard.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
// No CORS headers on purpose: same-origin requests only.
header('X-Content-Type-Options: nosniff');

/** Valid game ids — must match the catalogue in javascript.js. */
const GAME_IDS = ['balloon', 'carrace', 'flappy', 'spaceio', 'towerdef', 'factoryio'];

const MAX_SCORE            = 100000000;
const MAX_PER_MINUTE       = 20;
const MAX_REQUEST_BYTES    = 2048;

function fail(string $message, int $status = 400): never
{
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message]);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fail('POST only', 405);
}

$raw = file_get_contents('php://input', false, null, 0, MAX_REQUEST_BYTES + 1);
if ($raw === false || strlen($raw) > MAX_REQUEST_BYTES) {
    fail('request too large');
}

$payload = json_decode($raw, true);
if (!is_array($payload)) {
    fail('expected a JSON object');
}

/* ---------------------------------------------------------------- */
/* Validate every field before it goes anywhere near the database    */
/* ---------------------------------------------------------------- */

$game = (string) ($payload['game'] ?? '');
if (!in_array($game, GAME_IDS, true)) {
    fail('unknown game id');
}

if (!isset($payload['score']) || !is_numeric($payload['score'])) {
    fail('score must be a number');
}
$score = (int) $payload['score'];
if ($score < 0 || $score > MAX_SCORE) {
    fail('score out of range');
}

// Strip the name to letters, digits, spaces and a couple of separators, then
// cap it. Nothing here is rendered as HTML by this script, but the same value
// is read back by a page, so it should not be able to carry markup.
$player = (string) ($payload['player'] ?? 'guest');
$player = preg_replace('/[^A-Za-z0-9 _.\-]/', '', $player) ?? '';
$player = trim(substr($player, 0, 48));
if ($player === '') {
    $player = 'guest';
}

/* ---------------------------------------------------------------- */
/* Config + connection                                               */
/* ---------------------------------------------------------------- */

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
    // The expected state on any static host. Say so plainly instead of
    // pretending something was saved.
    fail('no backend configured — scores stay in your browser', 501);
}

/** @var array{dsn:string,user:string,pass:string,salt:string} $config */
$config = require $configPath;

foreach (['dsn', 'user', 'pass', 'salt'] as $key) {
    if (!isset($config[$key]) || !is_string($config[$key])) {
        fail('backend misconfigured', 500);
    }
}

try {
    $pdo = new PDO($config['dsn'], $config['user'], $config['pass'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
} catch (PDOException $e) {
    // Never echo the driver message: it leaks host names and credentials.
    error_log('arcade backup: ' . $e->getMessage());
    fail('database unavailable', 503);
}

/* ---------------------------------------------------------------- */
/* Rate limit by hashed source                                       */
/* ---------------------------------------------------------------- */

$ip     = (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
$source = substr(hash_hmac('sha256', $ip, $config['salt']), 0, 16);

try {
    $recent = $pdo->prepare(
        'SELECT COUNT(*) FROM scores WHERE source = ? AND created_at > (NOW() - INTERVAL 1 MINUTE)'
    );
    $recent->execute([$source]);
    if ((int) $recent->fetchColumn() >= MAX_PER_MINUTE) {
        fail('slow down', 429);
    }

    $pdo->beginTransaction();

    $insert = $pdo->prepare(
        'INSERT INTO scores (game_id, player, score, source) VALUES (?, ?, ?, ?)'
    );
    $insert->execute([$game, $player, $score, $source]);

    // GREATEST() means an out-of-order or lower submission can never pull a
    // stored best downward.
    $promote = $pdo->prepare(
        'INSERT INTO best_scores (game_id, player, score) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE score = GREATEST(score, VALUES(score))'
    );
    $promote->execute([$game, $player, $score]);

    $lookup = $pdo->prepare('SELECT score FROM best_scores WHERE game_id = ? AND player = ?');
    $lookup->execute([$game, $player]);
    $best = (int) $lookup->fetchColumn();

    $pdo->commit();
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('arcade backup: ' . $e->getMessage());
    fail('could not save that score', 500);
}

echo json_encode([
    'ok'     => true,
    'game'   => $game,
    'player' => $player,
    'score'  => $score,
    'best'   => $best,
]);
