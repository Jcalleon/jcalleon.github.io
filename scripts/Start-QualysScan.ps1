#requires -Version 5.1
<#
.SYNOPSIS
    Launches a Qualys VM scan against assets matching a given tag, then
    polls until the scan finishes (or the timeout elapses) instead of
    firing-and-forgetting — useful as a building block for a remediation
    pipeline where downstream steps need to know the scan actually
    completed before pulling fresh detection data.

.DESCRIPTION
    Qualys VM scans run asynchronously: the launch call returns a scan
    reference immediately, and the scan itself can take anywhere from
    minutes to hours depending on scope. This script launches the scan,
    then polls the scan list endpoint on an interval until status is
    "Finished", "Cancelled", or "Error" — or until -TimeoutMinutes elapses,
    at which point it exits non-zero so a scheduled job correctly reports
    failure rather than silently leaving a scan running unmonitored.

.PARAMETER TagName
    The Qualys asset tag identifying which hosts to scan. Tag-based
    targeting (rather than a fixed IP/asset-group list) means scope follows
    asset inventory automatically as systems are tagged or decommissioned.

.EXAMPLE
    .\Start-QualysScan.ps1 -BaseUrl "https://qualysapi.qualys.com" `
        -Credential (Get-Credential) -TagName "Production-Windows" `
        -ScanTitle "Weekly Production Windows Scan"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$BaseUrl,

    [Parameter(Mandatory)]
    [System.Management.Automation.PSCredential]$Credential,

    [Parameter(Mandatory)]
    [string]$TagName,

    [Parameter(Mandatory)]
    [string]$ScanTitle,

    [string]$OptionProfileId,

    [int]$PollIntervalSeconds = 120,

    [int]$TimeoutMinutes = 240
)

Import-Module "$PSScriptRoot\QualysSession.psm1" -Force

$session = Connect-QualysSession -BaseUrl $BaseUrl -Credential $Credential

try {
    Write-Host "Launching scan '$ScanTitle' against tag '$TagName'..."

    $launchBody = @{
        action          = "launch"
        scan_title      = $ScanTitle
        target_from     = "tags"
        tag_set_by      = "name"
        tag_set_include = $TagName
        iscanner_name   = "scanner1" # adjust to your subscription's appliance name
    }
    if ($OptionProfileId) { $launchBody["option_id"] = $OptionProfileId }

    $launchResponse = Invoke-QualysApi -Uri "$BaseUrl/api/2.0/fo/scan/" -Session $session -Body $launchBody
    [xml]$launchXml = $launchResponse.Content

    $scanRef = ($launchXml.SIMPLE_RETURN.RESPONSE.ITEM_LIST.ITEM | Where-Object { $_.KEY -eq "REFERENCE" }).VALUE
    if (-not $scanRef) {
        throw "Scan launch did not return a scan reference. Raw response: $($launchResponse.Content)"
    }
    Write-Host "Scan launched. Reference: $scanRef"

    # ---- Poll until the scan reaches a terminal state ----
    $deadline = (Get-Date).AddMinutes($TimeoutMinutes)
    $terminalStates = @("Finished", "Cancelled", "Error")
    $status = "Running"

    while ($status -notin $terminalStates) {
        if ((Get-Date) -gt $deadline) {
            throw "Scan $scanRef did not reach a terminal state within $TimeoutMinutes minutes. Last known status: $status"
        }

        Start-Sleep -Seconds $PollIntervalSeconds

        $listBody = @{ action = "list"; scan_ref = $scanRef; show_status = 1 }
        $listResponse = Invoke-QualysApi -Uri "$BaseUrl/api/2.0/fo/scan/" -Session $session -Body $listBody
        [xml]$listXml = $listResponse.Content

        $scanNode = $listXml.SCAN_LIST_OUTPUT.RESPONSE.SCAN_LIST.SCAN
        if (-not $scanNode) {
            Write-Warning "Scan $scanRef not found in scan list yet — it may still be initializing."
            continue
        }

        $status = $scanNode.STATUS.STATE
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Scan status: $status"
    }

    if ($status -eq "Finished") {
        Write-Host "Scan $scanRef completed successfully." -ForegroundColor Green
        # Emit the scan reference to the pipeline so a calling script (e.g.
        # the remediation-verification script in this same toolkit) can
        # chain directly off a successful run without re-parsing output.
        [PSCustomObject]@{
            ScanReference = $scanRef
            ScanTitle     = $ScanTitle
            Status        = $status
            CompletedAt   = Get-Date
        }
    }
    else {
        throw "Scan $scanRef ended in non-success state: $status"
    }
}
finally {
    Disconnect-QualysSession -BaseUrl $BaseUrl -Session $session
}
