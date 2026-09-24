<#
.SYNOPSIS
    A QA/QC-style inspection report for the site, built on top of validate.ps1
    (structural/link checks) and index_test.ps1 (content-quality checks).
    Doesn't reinvent either check — runs both, then classifies every finding
    by severity (Critical / Major / Minor) and issues a batch disposition,
    the same shape as a real incoming-inspection QC report:

        Critical  - breaks the page for a visitor (dead link, broken model
                    reference, unbalanced markup, a duplicate id silently
                    breaking a script)
        Major     - works, but shouldn't ship this way (missing meta
                    description/title/viewport, an image with no alt text,
                    an invalid mailto address)
        Minor     - heuristic-only findings worth a look, not confirmed
                    broken (the [heuristic] script-reference checks, a
                    missing/duplicated <h1>)

    Disposition rule (a simple AQL-style batch call, not a formal sampling
    plan — this inspects every unit, not a sample):
        REJECT             - any Critical defect
        CONDITIONAL ACCEPT - no Critical, but at least one Major
        ACCEPT             - no Critical or Major (Minor findings only, or none)

.USAGE
    powershell -File qc_report.ps1

    Exit code mirrors the disposition: 0 for ACCEPT, 1 for CONDITIONAL
    ACCEPT or REJECT (so CI-style callers can still treat non-ACCEPT as a
    failure without parsing the report text).
#>

$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$root = Split-Path -Parent $here

function Get-Findings {
    param([string]$ScriptPath)
    $output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ScriptPath 2>&1
    $findings = New-Object System.Collections.Generic.List[string]
    $currentFile = $null
    foreach ($line in $output) {
        $line = [string]$line
        if ($line -match '^--- (.+?) ---$') {
            $currentFile = $Matches[1]
        } elseif ($line -match '^\s*\[FAIL\]\s*(.+)$') {
            $findings.Add("$currentFile|$($Matches[1])")
        }
    }
    return $findings
}

function Get-Severity {
    param([string]$Text)
    if ($Text -match '^\[heuristic\]') { return 'Minor' }
    if ($Text -match 'Unbalanced <div>') { return 'Critical' }
    if ($Text -match 'Broken link|Broken viewer model reference') { return 'Critical' }
    if ($Text -match 'Duplicate id attribute') { return 'Critical' }
    if ($Text -match 'Invalid mailto address') { return 'Major' }
    if ($Text -match 'Missing or near-empty <title>|Missing <meta name="description">|Missing <meta name="viewport">') { return 'Major' }
    if ($Text -match '<img> tag\(s\) missing alt text') { return 'Major' }
    if ($Text -match 'No <h1> found|Multiple <h1> tags found') { return 'Minor' }
    return 'Minor'
}

Write-Output "================================================================"
Write-Output "  QUALITY CONTROL INSPECTION REPORT"
Write-Output "================================================================"
Write-Output "Report ID     : QC-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Write-Output "Inspected By  : validate.ps1 + index_test.ps1 (automated, 100% inspection)"
Write-Output "Facility      : $root"
Write-Output ""

$rawFindings = @()
$rawFindings += Get-Findings -ScriptPath (Join-Path $here 'validate.ps1')
$rawFindings += Get-Findings -ScriptPath (Join-Path $here 'index_test.ps1')

$htmlFileCount = (Get-ChildItem -Path $root -Recurse -Filter *.html -File |
    Where-Object { $_.FullName -notmatch '\\node_modules\\' }).Count

$defects = foreach ($f in $rawFindings) {
    $parts = $f.Split('|', 2)
    [PSCustomObject]@{
        File     = $parts[0]
        Issue    = $parts[1]
        Severity = Get-Severity -Text $parts[1]
    }
}

$critical = @($defects | Where-Object { $_.Severity -eq 'Critical' })
$major    = @($defects | Where-Object { $_.Severity -eq 'Major' })
$minor    = @($defects | Where-Object { $_.Severity -eq 'Minor' })
$totalDefects = $defects.Count
$defectRate = if ($htmlFileCount -gt 0) { [math]::Round(($totalDefects / $htmlFileCount) * 100, 1) } else { 0 }

Write-Output "--- SUMMARY -----------------------------------------------------"
Write-Output ("{0,-24} {1}" -f "Units Inspected:", $htmlFileCount)
Write-Output ("{0,-24} {1}" -f "Total Defects:", $totalDefects)
Write-Output ("{0,-24} {1}" -f "  Critical:", $critical.Count)
Write-Output ("{0,-24} {1}" -f "  Major:", $major.Count)
Write-Output ("{0,-24} {1}" -f "  Minor:", $minor.Count)
Write-Output ("{0,-24} {1}%" -f "Defect Rate:", $defectRate)
Write-Output ""

function Write-DefectSection {
    param([string]$Title, [array]$Items)
    if ($Items.Count -eq 0) { return }
    Write-Output "--- $Title ($($Items.Count)) ---"
    foreach ($d in ($Items | Sort-Object File)) {
        Write-Output "  [$($d.Severity.ToUpper())] $($d.File)"
        Write-Output "      $($d.Issue)"
    }
    Write-Output ""
}

Write-DefectSection -Title "CRITICAL DEFECTS" -Items $critical
Write-DefectSection -Title "MAJOR DEFECTS" -Items $major
Write-DefectSection -Title "MINOR OBSERVATIONS" -Items $minor

Write-Output "--- DISPOSITION ---------------------------------------------------"
if ($critical.Count -gt 0) {
    $disposition = 'REJECT'
    $exitCode = 1
} elseif ($major.Count -gt 0) {
    $disposition = 'CONDITIONAL ACCEPT (rework required)'
    $exitCode = 1
} else {
    $disposition = 'ACCEPT'
    $exitCode = 0
}
Write-Output "Batch Disposition: $disposition"
Write-Output "================================================================"

exit $exitCode
