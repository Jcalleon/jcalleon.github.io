#requires -Version 5.1
<#
.SYNOPSIS
    Shared Qualys VM API v2 session helper. Dot-sourced by every script in
    this showcase rather than duplicated, since session handling is the one
    piece every Qualys VM API script needs and gets wrong if copy-pasted
    inconsistently across a toolkit.

.NOTES
    Qualys VM API v2 uses cookie-based session auth, not a bearer token:
    POST /api/2.0/fo/session/ with action=login returns a QualysSession
    cookie that must be sent on every subsequent call, and explicitly closed
    with action=logout when done. Every request also requires the
    X-Requested-With header — Qualys's WAF rejects requests without it,
    a detail that trips up most first attempts at this API.
#>

function Connect-QualysSession {
    <#
    .SYNOPSIS
        Authenticates to the Qualys API and returns a WebRequestSession
        object carrying the QualysSession cookie for use on every
        subsequent call.
    .PARAMETER BaseUrl
        Your Qualys platform's API base URL, e.g.
        https://qualysapi.qualys.com for US Platform 1. Differs by platform
        and region — see Qualys's "Identify your platform" page.
    .PARAMETER Credential
        API-only service account credentials. Qualys strongly recommends a
        dedicated API user with MFA disabled and scoped to API access only,
        never a named analyst's interactive login.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$BaseUrl,

        [Parameter(Mandatory)]
        [System.Management.Automation.PSCredential]$Credential
    )

    $session = $null
    $loginUri = "$BaseUrl/api/2.0/fo/session/"
    $body = @{
        action   = "login"
        username = $Credential.UserName
        password = $Credential.GetNetworkCredential().Password
    }

    try {
        $response = Invoke-WebRequest -Uri $loginUri -Method Post -Body $body `
            -Headers @{ "X-Requested-With" = "PowerShell-QualysToolkit" } `
            -SessionVariable session -UseBasicParsing -ErrorAction Stop

        if ($response.Content -notmatch "Logged in") {
            throw "Qualys login did not return a confirmation. Response: $($response.Content)"
        }
    }
    catch {
        throw "Qualys session login failed: $($_.Exception.Message)"
    }

    return $session
}

function Disconnect-QualysSession {
    <#
    .SYNOPSIS
        Closes a Qualys API session. Always call this in a finally block —
        Qualys's per-subscription concurrency limits count open sessions,
        and a script that errors out without logging off will eventually
        exhaust that limit and start blocking legitimate calls.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$BaseUrl,

        [Parameter(Mandatory)]
        [Microsoft.PowerShell.Commands.WebRequestSession]$Session
    )

    try {
        Invoke-WebRequest -Uri "$BaseUrl/api/2.0/fo/session/" -Method Post `
            -Body @{ action = "logout" } `
            -Headers @{ "X-Requested-With" = "PowerShell-QualysToolkit" } `
            -WebSession $Session -UseBasicParsing -ErrorAction Stop | Out-Null
    }
    catch {
        # Logout failures shouldn't crash the calling script — the session
        # will expire on its own — but they're worth surfacing for visibility
        # into whether sessions are leaking across scheduled runs.
        Write-Warning "Qualys session logout failed (session will expire naturally): $($_.Exception.Message)"
    }
}

function Invoke-QualysApi {
    <#
    .SYNOPSIS
        Wraps a single Qualys VM API v2 call with the required header and
        consistent error surfacing. Qualys returns HTTP 409 when a
        subscription's concurrency or rate limit is hit — this function
        retries once after a short backoff on a 409 specifically, since
        that's usually transient, rather than treating it the same as a
        hard failure.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Uri,

        [Parameter(Mandatory)]
        [Microsoft.PowerShell.Commands.WebRequestSession]$Session,

        [hashtable]$Body,

        [string]$Method = "Post"
    )

    $headers = @{ "X-Requested-With" = "PowerShell-QualysToolkit" }
    $attempt = 0
    $maxAttempts = 2

    while ($true) {
        $attempt++
        try {
            $params = @{
                Uri            = $Uri
                Method         = $Method
                Headers        = $headers
                WebSession     = $Session
                UseBasicParsing = $true
                ErrorAction    = "Stop"
            }
            if ($Body) { $params["Body"] = $Body }

            return Invoke-WebRequest @params
        }
        catch {
            $statusCode = $_.Exception.Response.StatusCode.value__
            if ($statusCode -eq 409 -and $attempt -lt $maxAttempts) {
                Write-Verbose "Qualys API concurrency/rate limit hit (409) — backing off 30s before retry."
                Start-Sleep -Seconds 30
                continue
            }
            throw "Qualys API call to $Uri failed (HTTP $statusCode): $($_.Exception.Message)"
        }
    }
}
