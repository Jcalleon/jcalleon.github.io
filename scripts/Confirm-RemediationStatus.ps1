#requires -Version 5.1
<#
.SYNOPSIS
    Re-checks a list of previously-identified findings (host + QID pairs)
    against current Qualys detection data and reports which are confirmed
    fixed, still active, or reopened — the automated verification step that
    replaced manually re-checking remediation status across 5,000+ systems.

.DESCRIPTION
    The easy part of vulnerability management is finding problems; the
    expensive part is confirming they actually got fixed. Before this
    existed, "did the patch actually take" was answered by someone manually
    re-running a scan and eyeballing the diff. This script takes the prior
    finding list (the output of Get-PrioritizedDetections.ps1, or any CSV
    with HostId/Qid columns) and Qualys's STATUS field — New, Active, Fixed,
    Re-Opened — to answer that automatically, on a schedule, at any scale.

    A "Re-Opened" status specifically matters: it means a finding that was
    previously verified fixed has come back, which usually indicates a
    configuration drift or a patch that didn't survive a redeploy/image
    refresh — operationally a different problem than "never fixed" and
    worth flagging distinctly rather than lumping both into "still open."

.PARAMETER PriorFindingsPath
    CSV with at least HostId and Qid columns — typically yesterday's or last
    week's prioritized-findings export from this same toolkit.

.EXAMPLE
    .\Confirm-RemediationStatus.ps1 -BaseUrl "https://qualysapi.qualys.com" `
        -Credential (Get-Credential) -PriorFindingsPath ".\prioritized-findings.csv" `
        -ReportPath ".\remediation-status.csv"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$BaseUrl,

    [Parameter(Mandatory)]
    [System.Management.Automation.PSCredential]$Credential,

    [Parameter(Mandatory)]
    [string]$PriorFindingsPath,

    [Parameter(Mandatory)]
    [string]$ReportPath
)

Import-Module "$PSScriptRoot\QualysSession.psm1" -Force

if (-not (Test-Path $PriorFindingsPath)) {
    throw "Prior findings file not found: $PriorFindingsPath"
}
$priorFindings = Import-Csv -Path $PriorFindingsPath
Write-Host "Loaded $($priorFindings.Count) prior finding(s) to verify."

$hostIds = $priorFindings.HostId | Select-Object -Unique
$qids = $priorFindings.Qid | Select-Object -Unique

$session = Connect-QualysSession -BaseUrl $BaseUrl -Credential $Credential
$results = New-Object System.Collections.Generic.List[object]

try {
    # Querying by explicit host IDs and QIDs (rather than a broad re-scan
    # of everything) keeps this check fast and cheap enough to run daily
    # against a backlog that might otherwise take hours to fully re-scan.
    $body = @{
        action = "list"
        ids    = ($hostIds -join ",")
        qids   = ($qids -join ",")
        status = "New,Active,Fixed,Re-Opened"
    }

    $response = Invoke-QualysApi -Uri "$BaseUrl/api/2.0/fo/asset/host/vm/detection/" -Session $session -Body $body
    [xml]$xml = $response.Content

    $currentStatusByHostQid = @{}
    foreach ($hostNode in $xml.HOST_LIST_VM_DETECTION_OUTPUT.RESPONSE.HOST_LIST.HOST) {
        foreach ($detection in $hostNode.DETECTION_LIST.DETECTION) {
            $key = "$($hostNode.ID)|$($detection.QID)"
            $currentStatusByHostQid[$key] = @{
                Status         = $detection.STATUS
                LastFound      = $detection.LAST_FOUND_DATETIME
            }
        }
    }

    foreach ($finding in $priorFindings) {
        $key = "$($finding.HostId)|$($finding.Qid)"
        $current = $currentStatusByHostQid[$key]

        # If the key is missing entirely from current results, Qualys no
        # longer has an active/fixed/reopened record for it at all — most
        # commonly because the host itself was decommissioned, which is
        # worth distinguishing from "we verified it's fixed."
        $verifiedStatus = if ($current) { $current.Status } else { "NoLongerReported" }

        $results.Add([PSCustomObject]@{
            HostId           = $finding.HostId
            Hostname         = $finding.Hostname
            Qid              = $finding.Qid
            PriorSeverity    = $finding.Severity
            PriorPriorityScore = $finding.PriorityScore
            VerifiedStatus   = $verifiedStatus
            LastFound        = $current.LastFound
            VerifiedAt       = Get-Date
        })
    }

    $results | Export-Csv -Path $ReportPath -NoTypeInformation

    $summary = $results | Group-Object -Property VerifiedStatus | Select-Object Name, Count
    Write-Host "`nRemediation verification summary:" -ForegroundColor Cyan
    $summary | ForEach-Object { Write-Host "  $($_.Name): $($_.Count)" }

    $reopened = $results | Where-Object { $_.VerifiedStatus -eq "Re-Opened" }
    if ($reopened.Count -gt 0) {
        Write-Host "`n$($reopened.Count) finding(s) have REOPENED since last verified fixed — likely config drift or a non-persistent patch:" -ForegroundColor Red
        $reopened | Select-Object Hostname, Qid, LastFound | Format-Table -AutoSize
    }

    $results
}
finally {
    Disconnect-QualysSession -BaseUrl $BaseUrl -Session $session
}
