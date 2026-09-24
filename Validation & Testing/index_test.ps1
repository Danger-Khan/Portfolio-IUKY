<#
.SYNOPSIS
    Deeper content-quality checks for every index.html on the site — the
    things validate.ps1 doesn't look at because they're not "broken," just
    incomplete: missing <title>/meta description, no viewport meta, missing
    or duplicated <h1>, images without alt text, and duplicate id attributes
    (which silently break getElementById-based scripts on this site).

.USAGE
    powershell -File index_test.ps1

    Exits 0 and prints a pass summary if every index.html page checks out.
    Exits 1 and lists every issue, grouped by file, if anything is missing.
#>

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$indexFiles = Get-ChildItem -Path $root -Recurse -File |
    Where-Object { $_.Name -ieq 'index.html' -and $_.FullName -notmatch '\\node_modules\\' }

$filesChecked = 0
$totalIssues = 0
$reportLines = New-Object System.Collections.Generic.List[string]

foreach ($file in $indexFiles) {
    $filesChecked++
    $text = Get-Content -LiteralPath $file.FullName -Raw
    if ($null -eq $text) { $text = '' }
    $fileIssues = New-Object System.Collections.Generic.List[string]

    # --- 1. <title> present and non-trivial -------------------------------
    $titleMatch = [regex]::Match($text, '<title>\s*([^<]*?)\s*</title>')
    if (-not $titleMatch.Success -or $titleMatch.Groups[1].Value.Trim().Length -lt 3) {
        $fileIssues.Add("Missing or near-empty <title>")
    }

    # --- 2. Meta description present and non-empty -------------------------
    $descMatch = [regex]::Match($text, '<meta\s+name\s*=\s*["'']description["''][^>]*content\s*=\s*["'']([^"'']*)["'']', 'IgnoreCase')
    if (-not $descMatch.Success -or $descMatch.Groups[1].Value.Trim().Length -eq 0) {
        $fileIssues.Add('Missing <meta name="description"> (or it has empty content)')
    }

    # --- 3. Viewport meta present (mobile rendering depends on this) -------
    if ($text -notmatch '<meta\s+name\s*=\s*["'']viewport["'']') {
        $fileIssues.Add('Missing <meta name="viewport"> - page will not scale correctly on mobile')
    }

    # --- 4. Exactly one <h1> ------------------------------------------------
    $h1Count = ([regex]::Matches($text, '<h1\b')).Count
    if ($h1Count -eq 0) {
        $fileIssues.Add('No <h1> found - every page should have exactly one top-level heading')
    } elseif ($h1Count -gt 1) {
        $fileIssues.Add("Multiple <h1> tags found ($h1Count) - should be exactly one per page")
    }

    # --- 5. Every <img> has a non-empty alt attribute -----------------------
    $imgTags = [regex]::Matches($text, '<img\b[^>]*>')
    $missingAlt = 0
    foreach ($img in $imgTags) {
        $altMatch = [regex]::Match($img.Value, 'alt\s*=\s*["'']([^"'']*)["'']')
        if (-not $altMatch.Success -or $altMatch.Groups[1].Value.Trim().Length -eq 0) {
            $missingAlt++
        }
    }
    if ($missingAlt -gt 0) {
        $fileIssues.Add("$missingAlt <img> tag(s) missing alt text (of $($imgTags.Count) total)")
    }

    # --- 6. No duplicate id="..." attributes --------------------------------
    # A duplicate id means getElementById only ever finds the first one -
    # any script wired to the second element silently does nothing.
    $ids = [regex]::Matches($text, '\bid\s*=\s*["'']([^"'']+)["'']') | ForEach-Object { $_.Groups[1].Value }
    $dupeIds = $ids | Group-Object | Where-Object { $_.Count -gt 1 } | ForEach-Object { $_.Name }
    if ($dupeIds.Count -gt 0) {
        $fileIssues.Add("Duplicate id attribute(s): $($dupeIds -join ', ')")
    }

    if ($fileIssues.Count -gt 0) {
        $relPath = $file.FullName.Substring($root.Length).TrimStart('\')
        $reportLines.Add("")
        $reportLines.Add("--- $relPath ---")
        foreach ($issue in $fileIssues) {
            $reportLines.Add("  [FAIL] $issue")
            $totalIssues++
        }
    }
}

Write-Output "Content-checked $filesChecked index.html file(s) under $root"

if ($reportLines.Count -gt 0) {
    foreach ($line in $reportLines) { Write-Output $line }
    Write-Output ""
    Write-Output "RESULT: $totalIssues issue(s) found."
    exit 1
} else {
    Write-Output "RESULT: every index.html has a title, description, viewport meta, exactly one <h1>, alt text on every image, and no duplicate ids."
    exit 0
}
