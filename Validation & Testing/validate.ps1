<#
.SYNOPSIS
    Validates the portfolio site: checks every .html file for unbalanced
    <div> tags, broken local links/assets (href, src, and CAD viewer
    "model=" query parameters), invalid mailto: addresses, and - as a
    best-effort secondary pass - asset file paths referenced from inline
    <script> blocks (e.g. Three.js loader.load('*.glb') calls).

.USAGE
    powershell -File validate.ps1
    (or, from inside PowerShell:  .\validate.ps1)

    Exits 0 and prints a pass summary if everything checks out.
    Exits 1 and lists every issue, grouped by file, if anything is broken.
#>

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$htmlFiles = Get-ChildItem -Path $root -Recurse -Filter *.html -File |
    Where-Object { $_.FullName -notmatch '\\node_modules\\' }

$assetExtensions = 'glb|gltf|stl|step|stp|igs|iges|sldprt|sldasm|dxf|png|jpg|jpeg|gif|svg|mp4|pdf|docx|xlsx|mp3|wav'
$hrefDoubleQuoted = [regex]'(?:href|src)\s*=\s*"([^"]*)"'
$hrefSingleQuoted = [regex]"(?:href|src)\s*=\s*'([^']*)'"
$assetStringPattern = [regex]"['""]([^'""]+?\.(?:$assetExtensions))['""]"

$filesChecked = 0
$totalIssues = 0
$reportLines = New-Object System.Collections.Generic.List[string]

foreach ($file in $htmlFiles) {
    $filesChecked++
    # Get-Content -Raw returns $null (not "") for a 0-byte file — treat that
    # as an empty, still-being-written scaffold rather than crashing on it.
    $text = Get-Content -LiteralPath $file.FullName -Raw
    if ($null -eq $text) { $text = '' }
    $dir = $file.DirectoryName
    $fileIssues = New-Object System.Collections.Generic.List[string]

    # --- 1. Structural check: <div> / </div> balance ---------------------
    $openDivs = ([regex]::Matches($text, '<div\b')).Count
    $closeDivs = ([regex]::Matches($text, '</div>')).Count
    if ($openDivs -ne $closeDivs) {
        $fileIssues.Add("Unbalanced <div> tags: $openDivs opening vs $closeDivs closing")
    }

    # --- 2. href / src attribute resolution -------------------------------
    $attrMatches = New-Object System.Collections.Generic.List[System.Text.RegularExpressions.Match]
    foreach ($m in $hrefDoubleQuoted.Matches($text)) { $attrMatches.Add($m) }
    foreach ($m in $hrefSingleQuoted.Matches($text)) { $attrMatches.Add($m) }

    foreach ($m in $attrMatches) {
        $raw = [System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value)
        if ($raw -eq '' -or $raw.StartsWith('#')) { continue }

        if ($raw -match '^(https?:|mailto:|tel:|data:|javascript:)') {
            if ($raw -match '^mailto:') {
                $addr = $raw.Substring(7)
                $atCount = ([regex]::Matches($addr, '@')).Count
                if ($atCount -ne 1 -or $addr -match '\s') {
                    $fileIssues.Add("Invalid mailto address: `"$raw`"")
                }
            }
            continue
        }

        # Split off fragment (#...) then query (?...) before resolving the path.
        $pathPart = $raw
        $queryPart = $null
        $hashIdx = $pathPart.IndexOf('#')
        if ($hashIdx -ge 0) { $pathPart = $pathPart.Substring(0, $hashIdx) }
        $qIdx = $pathPart.IndexOf('?')
        if ($qIdx -ge 0) {
            $queryPart = $pathPart.Substring($qIdx + 1)
            $pathPart = $pathPart.Substring(0, $qIdx)
        } elseif ($raw.Contains('?')) {
            # '?' came after a literal '#' was stripped above - recover it from the original.
            $afterHash = $raw
            if ($hashIdx -ge 0) { $afterHash = $raw.Substring($hashIdx) }
            $qIdx2 = $afterHash.IndexOf('?')
            if ($qIdx2 -ge 0) { $queryPart = $afterHash.Substring($qIdx2 + 1) }
        }

        if ($pathPart -ne '') {
            $decoded = [System.Uri]::UnescapeDataString($pathPart)
            $target = Join-Path $dir $decoded
            if (-not (Test-Path -LiteralPath $target)) {
                $fileIssues.Add("Broken link: `"$raw`" -> not found at $target")
                if ($raw.Contains('#') -and -not $raw.Contains('%23')) {
                    $fileIssues.Add("  (this href contains a literal '#' - if the target path really has a '#' in it, it needs to be escaped as %23)")
                }
            }
        }

        # CAD viewer links pass the real model file in a ?model=... query param.
        if ($queryPart) {
            foreach ($kv in ($queryPart -split '&')) {
                if ($kv -like 'model=*') {
                    $modelDecoded = [System.Uri]::UnescapeDataString($kv.Substring(6))
                    $modelTarget = Join-Path $dir $modelDecoded
                    if (-not (Test-Path -LiteralPath $modelTarget)) {
                        $fileIssues.Add("Broken viewer model reference: `"$modelDecoded`" -> not found at $modelTarget")
                    }
                }
            }
        }
    }

    # --- 3. Heuristic: asset paths referenced from inline JS --------------
    $seen = @{}
    foreach ($m in $assetStringPattern.Matches($text)) {
        $raw = $m.Groups[1].Value
        if ($raw -match '^(https?:|data:)') { continue }
        if ($seen.ContainsKey($raw)) { continue }
        $seen[$raw] = $true

        $decoded = [System.Uri]::UnescapeDataString($raw)
        $leafName = Split-Path $decoded -Leaf
        $candidate1 = Join-Path $dir $decoded
        $candidate2 = Join-Path (Join-Path $dir 'Assets') $leafName
        $found = (Test-Path -LiteralPath $candidate1) -or (Test-Path -LiteralPath $candidate2)
        if (-not $found) {
            $assetsRoot = Join-Path $dir 'Assets'
            if (Test-Path -LiteralPath $assetsRoot) {
                $nestedHit = Get-ChildItem -LiteralPath $assetsRoot -Recurse -File -Filter $leafName -ErrorAction SilentlyContinue |
                    Select-Object -First 1
                if ($nestedHit) { $found = $true }
            }
        }
        if (-not $found) {
            $fileIssues.Add("[heuristic] Script references `"$raw`" - not found next to this file or in its Assets folder (checked subfolders too)")
        }
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

Write-Output "Validated $filesChecked HTML file(s) under $root"

if ($reportLines.Count -gt 0) {
    foreach ($line in $reportLines) { Write-Output $line }
    Write-Output ""
    Write-Output "RESULT: $totalIssues issue(s) found."
    exit 1
} else {
    Write-Output "RESULT: all checks passed - no unbalanced tags, broken links, or invalid mailto addresses found."
    exit 0
}
