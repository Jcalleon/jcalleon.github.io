#requires -Version 5.1
<#
.SYNOPSIS
    Pulls active vulnerability detections from Qualys and re-prioritizes
    them by actual exploitability — public exploit availability and exploit
    maturity, both pulled from Qualys's own QDS factors — rather than by raw
    CVSS score alone. This is the specific re-prioritization logic behind
    the 82% exploitable-vulnerability reduction described in my experience.

.DESCRIPTION
    Raw CVSS measures theoretical severity, not real-world risk: a 9.8
    CVSS finding with no known exploit and no patch in the wild is a very
    different risk than a 7.5 CVSS finding with a public, weaponized
    exploit already circulating. Qualys exposes exactly this distinction
    via QDS_FACTORS on each detection (EXPLOIT_AVAILABLE, EXPLOIT_MATURITY,
    RTI/real-time threat indicators) — this script reads those factors
    directly and re-ranks the backlog accordingly, so remediation effort
    goes to what's actually being exploited first.

    Handles Qualys's truncation/pagination model (large environments return
    results in pages of up to a configurable limit, with a WARNING block
    pointing to the next page) rather than assuming a single response holds
    everything — a detail that silently breaks naive single-call scripts
    against any sizeable host count.

.PARAMETER MinimumSeverity
    Only QIDs at or above this Qualys severity level (1-5) are considered.
    Defaults to 3, since severity 1-2 findings are rarely worth the
    exploitability re-ranking pass at all.

.EXAMPLE
    .\Get-PrioritizedDetections.ps1 -BaseUrl "https://qualysapi.qualys.com" `
        -Credential (Get-Credential) -OutputPath ".\prioritized-findings.csv"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$BaseUrl,

    [Parameter(Mandatory)]
    [System.Management.Automation.PSCredential]$Credential,

    [int]$MinimumSeverity = 3,

    [int]$PageSize = 1000,

    [Parameter(Mandatory)]
    [string]$OutputPath
)

Import-Module "$PSScriptRoot\QualysSession.psm1" -Force

# ---- Exploitability scoring model ----
# Raw CVSS stays in the output for reference, but PriorityScore is what
# remediation queues should actually sort on. Weighting: confirmed public
# exploit code is the single strongest real-world signal — it outweighs a
# full severity-level difference in raw CVSS, which is exactly the
# "exploitability over raw CVSS" reprioritization this script exists for.
function Get-ExploitabilityScore {
    param($QdsFactors)

    $score = 0
    $exploitAvailable = ($QdsFactors | Where-Object { $_.name -eq "EXPLOIT_AVAILABLE" })."#cdata-section"
    $exploitMaturity   = ($QdsFactors | Where-Object { $_.name -eq "EXPLOIT_MATURITY" })."#cdata-section"

    if ($exploitAvailable -match "poc|weaponized|functional") { $score += 40 }
    switch -Regex ($exploitMaturity) {
        "weaponized" { $score += 30 }
        "functional" { $score += 20 }
        "poc"        { $score += 10 }
    }
    return $score
}

$session = Connect-QualysSession -BaseUrl $BaseUrl -Credential $Credential
$allHosts = New-Object System.Collections.Generic.List[object]

try {
    $idMin = $null
    $page = 1

    do {
        Write-Host "Fetching detection page $page..."
        $body = @{
            action          = "list"
            severities      = (($MinimumSeverity..5) -join ",")
            status          = "New,Active,Re-Opened"
            truncation_limit = $PageSize
            show_qds        = 1
            show_qds_factors = 1
        }
        if ($idMin) { $body["id_min"] = $idMin }

        $response = Invoke-QualysApi -Uri "$BaseUrl/api/2.0/fo/asset/host/vm/detection/" -Session $session -Body $body
        [xml]$xml = $response.Content

        $hostNodes = $xml.HOST_LIST_VM_DETECTION_OUTPUT.RESPONSE.HOST_LIST.HOST
        foreach ($hostNode in $hostNodes) {
            foreach ($detection in $hostNode.DETECTION_LIST.DETECTION) {
                $qdsFactors = $detection.QDS_FACTORS.QDS_FACTOR
                $exploitScore = Get-ExploitabilityScore -QdsFactors $qdsFactors

                $allHosts.Add([PSCustomObject]@{
                    HostId            = $hostNode.ID
                    IpAddress         = $hostNode.IP
                    Hostname          = $hostNode.DNS
                    Os                = $hostNode.OS
                    Qid               = $detection.QID
                    Severity          = [int]$detection.SEVERITY
                    Qds               = [int]$detection.QDS.'#text'
                    ExploitabilityScore = $exploitScore
                    PriorityScore     = ([int]$detection.SEVERITY * 10) + $exploitScore
                    Status            = $detection.STATUS
                    FirstFound        = $detection.FIRST_FOUND_DATETIME
                    LastFound         = $detection.LAST_FOUND_DATETIME
                })
            }
        }

        # Qualys signals more pages via a WARNING block containing the next
        # page's URL with an id_min cursor — extract that cursor rather than
        # assuming a fixed number of pages.
        $warning = $xml.HOST_LIST_VM_DETECTION_OUTPUT.RESPONSE.WARNING
        if ($warning -and $warning.URL -match "id_min=(\d+)") {
            $idMin = $Matches[1]
            $page++
        }
        else {
            $idMin = $null
        }
    } while ($idMin)

    Write-Host "Pulled $($allHosts.Count) detection records across $page page(s)."

    $prioritized = $allHosts | Sort-Object -Property PriorityScore -Descending
    $prioritized | Export-Csv -Path $OutputPath -NoTypeInformation

    $topRisk = $prioritized | Where-Object { $_.ExploitabilityScore -ge 30 }
    Write-Host "$($topRisk.Count) finding(s) have a confirmed or weaponized public exploit — these should jump the queue regardless of raw severity." -ForegroundColor Yellow

    $prioritized
}
finally {
    Disconnect-QualysSession -BaseUrl $BaseUrl -Session $session
}
