<#
.SYNOPSIS
    Checks specific to the Web Games arcade — the things validate.ps1 can't see
    because they live inside game.js rather than in HTML attributes:

      * every sprite a game loads via loadSprites({...}) exists in its Images/
        folder (a renamed or missing file doesn't throw, it silently falls back
        to the procedural drawing, so nothing else would ever catch it);
      * every PNG sitting in an Images/ folder is actually referenced by that
        game (no dead art quietly shipping in the repo);
      * a folder holding art also holds a CREDITS.md, so the licence of
        third-party art is always recorded next to it;
      * each game has both index.html and game.js;
      * each game's index.html still carries the in-stage fullscreen exit
        control. That one is a regression guard: once an element goes
        fullscreen its siblings stop rendering, so an exit button outside the
        .stage becomes invisible and unreachable, which is exactly the bug
        that shipped once already.

.USAGE
    powershell -File games_test.ps1

    Exits 0 and prints a pass summary if every game checks out.
    Exits 1 and lists every issue, grouped by game, if anything is off.
    Output format matches validate.ps1 so qc_report.ps1 can parse it.
#>

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$gamesRoot = Join-Path $root 'Portfoilos\Gamer\Assets\Web Games'

if (-not (Test-Path -LiteralPath $gamesRoot)) {
    Write-Output "Web Games folder not found at $gamesRoot - nothing to check."
    exit 0
}

# A game folder is any subfolder with a game.js in it.
$gameDirs = Get-ChildItem -LiteralPath $gamesRoot -Directory |
    Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'game.js') }

$checked = 0
$totalIssues = 0
$reportLines = New-Object System.Collections.Generic.List[string]

foreach ($dir in $gameDirs) {
    $checked++
    $issues = New-Object System.Collections.Generic.List[string]
    $gameJsPath = Join-Path $dir.FullName 'game.js'
    $indexPath = Join-Path $dir.FullName 'index.html'
    $imagesDir = Join-Path $dir.FullName 'Images'

    $gameJs = Get-Content -LiteralPath $gameJsPath -Raw
    if ($null -eq $gameJs) { $gameJs = '' }

    # --- 1. index.html present, with the in-stage fullscreen exit control -----
    if (-not (Test-Path -LiteralPath $indexPath)) {
        $issues.Add("Missing index.html next to game.js")
    } else {
        $indexHtml = Get-Content -LiteralPath $indexPath -Raw
        if ($null -eq $indexHtml) { $indexHtml = '' }
        if ($indexHtml -notmatch 'stage-exit-fs') {
            $issues.Add("No in-stage fullscreen exit control (class 'stage-exit-fs') - an exit button outside the fullscreened .stage is unreachable")
        }
    }

    # --- 2. Sprites referenced in game.js must exist -------------------------
    # Matches the 'Images/whatever.png' string literals loadSprites() is given.
    $referenced = @{}
    foreach ($m in [regex]::Matches($gameJs, "['""](Images/([^'""]+\.(?:png|jpg|jpeg|webp|gif)))['""]")) {
        $rel = $m.Groups[1].Value
        $leaf = $m.Groups[2].Value
        $referenced[$leaf] = $true
        $target = Join-Path $dir.FullName ($rel -replace '/', '\')
        if (-not (Test-Path -LiteralPath $target)) {
            $issues.Add("game.js loads `"$rel`" but that file is not there - the game will silently fall back to its procedural drawing")
        }
    }

    # --- 3. No unreferenced art, and art folders carry a CREDITS.md ----------
    if (Test-Path -LiteralPath $imagesDir) {
        $artFiles = Get-ChildItem -LiteralPath $imagesDir -File |
            Where-Object { $_.Extension -match '^\.(png|jpg|jpeg|webp|gif)$' }

        foreach ($art in $artFiles) {
            if (-not $referenced.ContainsKey($art.Name)) {
                $issues.Add("Images/$($art.Name) is never referenced by game.js - dead art")
            }
        }

        if ($artFiles.Count -gt 0 -and -not (Test-Path -LiteralPath (Join-Path $imagesDir 'CREDITS.md'))) {
            $issues.Add("Images/ holds $($artFiles.Count) art file(s) but no CREDITS.md recording where they came from and under what licence")
        }
    }

    if ($issues.Count -gt 0) {
        $relPath = $dir.FullName.Substring($root.Length).TrimStart('\')
        $reportLines.Add("")
        $reportLines.Add("--- $relPath ---")
        foreach ($issue in $issues) {
            $reportLines.Add("  [FAIL] $issue")
            $totalIssues++
        }
    }
}

Write-Output "Checked $checked Web Game(s) under $gamesRoot"

if ($reportLines.Count -gt 0) {
    foreach ($line in $reportLines) { Write-Output $line }
    Write-Output ""
    Write-Output "RESULT: $totalIssues issue(s) found."
    exit 1
} else {
    Write-Output "RESULT: all games check out - every sprite referenced exists, no dead art, credits recorded, fullscreen exit control present."
    exit 0
}
