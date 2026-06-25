#requires -Version 5.1
<#
.SYNOPSIS
    Rolls up remediation-verification output into a plain-language summary
    suitable for a compliance audit or a non-technical stakeholder update —
    the translation layer between raw QID-level data and "are we actually
    getting safer, and how fast."

.DESCRIPTION
    A spreadsheet of QIDs and CVSS scores answers a security engineer's
    question. It does not answer a director's question, which is closer to
    "what's our actual exposure trend, and is the team keeping up with
    what's coming in." This script computes that trend (open vs. closed
    over a configurable window, mean time to remediate by severity, and the
    exploit-confirmed backlog specifically) from the same verification data
    Confirm-RemediationStatus.ps1 produces, and renders it as both an HTML
    report (for email/SharePoint) and a flat CSV (for whoever wants to
    re-slice it themselves).

.PARAMETER VerificationHistoryPath
    A folder of dated CSVs, one per verification run (e.g.
    remediation-status-2026-06-01.csv, remediation-status-2026-06-08.csv).
    Trend analysis needs multiple time points — this isn't meaningful on a
    single run alone, which is why this script intentionally requires a
    folder, not a single file.

.EXAMPLE
    .\Build-ComplianceReport.ps1 -VerificationHistoryPath ".\verification-history" `
        -OutputHtmlPath ".\weekly-exposure-report.html"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$VerificationHistoryPath,

    [Parameter(Mandatory)]
    [string]$OutputHtmlPath,

    [string]$OutputCsvPath,

    [int]$TrendWindowDays = 30
)

if (-not (Test-Path $VerificationHistoryPath)) {
    throw "Verification history folder not found: $VerificationHistoryPath"
}

$cutoff = (Get-Date).AddDays(-$TrendWindowDays)
$historyFiles = Get-ChildItem -Path $VerificationHistoryPath -Filter "*.csv" |
    Where-Object { $_.LastWriteTime -ge $cutoff } |
    Sort-Object LastWriteTime

if ($historyFiles.Count -lt 2) {
    throw "Need at least 2 verification runs within the last $TrendWindowDays days to compute a trend; found $($historyFiles.Count)."
}

Write-Host "Building trend report from $($historyFiles.Count) verification run(s) between $($historyFiles[0].LastWriteTime.ToShortDateString()) and $($historyFiles[-1].LastWriteTime.ToShortDateString())."

$allRuns = foreach ($file in $historyFiles) {
    $rows = Import-Csv -Path $file.FullName
    foreach ($row in $rows) {
        [PSCustomObject]@{
            RunDate          = $file.LastWriteTime.Date
            HostId           = $row.HostId
            Qid              = $row.Qid
            PriorSeverity    = [int]$row.PriorSeverity
            VerifiedStatus   = $row.VerifiedStatus
        }
    }
}

# ---- Mean time to remediate, by severity ----
# Calculated from the first run where a given Host+QID appears "Fixed",
# minus the earliest run where that same pair appeared at all — an
# approximation bounded by how far back history goes, called out explicitly
# in the report rather than presented as exact.
$mttrBySeverity = @{}
$grouped = $allRuns | Group-Object -Property { "$($_.HostId)|$($_.Qid)" }

foreach ($group in $grouped) {
    $sorted = $group.Group | Sort-Object RunDate
    $firstSeen = $sorted[0].RunDate
    $firstFixed = ($sorted | Where-Object { $_.VerifiedStatus -eq "Fixed" } | Select-Object -First 1).RunDate
    if ($firstFixed) {
        $daysToFix = ($firstFixed - $firstSeen).Days
        $severity = $sorted[0].PriorSeverity
        if (-not $mttrBySeverity.ContainsKey($severity)) { $mttrBySeverity[$severity] = New-Object System.Collections.Generic.List[int] }
        $mttrBySeverity[$severity].Add($daysToFix)
    }
}

$mttrSummary = foreach ($severity in ($mttrBySeverity.Keys | Sort-Object -Descending)) {
    $days = $mttrBySeverity[$severity]
    [PSCustomObject]@{
        Severity         = $severity
        SampleSize       = $days.Count
        MeanDaysToFix    = [math]::Round(($days | Measure-Object -Average).Average, 1)
        MedianDaysToFix  = ($days | Sort-Object)[[math]::Floor($days.Count / 2)]
    }
}

# ---- Latest-run snapshot ----
$latestRun = $allRuns | Where-Object { $_.RunDate -eq $historyFiles[-1].LastWriteTime.Date }
$openCount = ($latestRun | Where-Object { $_.VerifiedStatus -in @("New", "Active", "Re-Opened") }).Count
$fixedCount = ($latestRun | Where-Object { $_.VerifiedStatus -eq "Fixed" }).Count
$reopenedCount = ($latestRun | Where-Object { $_.VerifiedStatus -eq "Re-Opened" }).Count

# ---- Render ----
$html = @"
<html>
<head><style>
  body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #1a1a1a; }
  h1 { font-size: 22px; } h2 { font-size: 16px; margin-top: 32px; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 13px; }
  th { background: #f4f4f4; }
  .metric { display: inline-block; margin-right: 32px; }
  .metric-value { font-size: 28px; font-weight: 700; }
  .metric-label { font-size: 12px; color: #666; }
  .warn { color: #b00020; font-weight: 600; }
</style></head>
<body>
  <h1>Vulnerability Exposure Report</h1>
  <p>Window: $($historyFiles[0].LastWriteTime.ToShortDateString()) – $($historyFiles[-1].LastWriteTime.ToShortDateString()) ($($historyFiles.Count) verification runs)</p>

  <div class="metric"><div class="metric-value">$openCount</div><div class="metric-label">Currently open</div></div>
  <div class="metric"><div class="metric-value">$fixedCount</div><div class="metric-label">Confirmed fixed this run</div></div>
  <div class="metric"><div class="metric-value $(if ($reopenedCount -gt 0) { 'warn' })">$reopenedCount</div><div class="metric-label">Reopened since last fixed</div></div>

  <h2>Mean time to remediate, by severity</h2>
  <table>
    <tr><th>Severity</th><th>Sample size</th><th>Mean days to fix</th><th>Median days to fix</th></tr>
$(($mttrSummary | ForEach-Object { "    <tr><td>$($_.Severity)</td><td>$($_.SampleSize)</td><td>$($_.MeanDaysToFix)</td><td>$($_.MedianDaysToFix)</td></tr>" }) -join "`n")
  </table>

  <p style="margin-top:32px; font-size:11px; color:#888;">
    MTTR figures are bounded by the lookback window above — a finding first
    observed before the window started, or fixed after it ended, won't be
    reflected accurately. Generated $(Get-Date -Format 'yyyy-MM-dd HH:mm') UTC.
  </p>
</body>
</html>
"@

$html | Out-File -FilePath $OutputHtmlPath -Encoding UTF8
Write-Host "Report written to $OutputHtmlPath"

if ($OutputCsvPath) {
    $mttrSummary | Export-Csv -Path $OutputCsvPath -NoTypeInformation
    Write-Host "MTTR data exported to $OutputCsvPath"
}

[PSCustomObject]@{
    OpenCount      = $openCount
    FixedCount     = $fixedCount
    ReopenedCount  = $reopenedCount
    MttrSummary    = $mttrSummary
}
