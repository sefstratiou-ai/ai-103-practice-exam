param(
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$examRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$examUrl = "http://localhost:3000/"
$examCli = Join-Path $examRoot "node_modules\vinext\dist\cli.js"
$examOutputLog = Join-Path $examRoot ".exam-server.out.log"
$examErrorLog = Join-Path $examRoot ".exam-server.err.log"

function Test-Ai103Server {
    try {
        $examResponse = Invoke-WebRequest -Uri $examUrl -UseBasicParsing -TimeoutSec 2
        return $examResponse.StatusCode -eq 200 -and $examResponse.Content -match "AI-103 Practice Exam"
    }
    catch {
        return $false
    }
}

if (Test-Ai103Server) {
    if (-not $NoBrowser) {
        Start-Process $examUrl
    }
    Write-Host "AI-103 Practice Exam is already running at $examUrl" -ForegroundColor Cyan
    exit 0
}

$examNodeCandidates = @()
$examSystemNode = Get-Command node.exe -ErrorAction SilentlyContinue
if ($examSystemNode) {
    $examNodeCandidates += $examSystemNode.Source
}
$examCodexNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$examNodeCandidates += $examCodexNode

$examNode = $null
foreach ($examCandidate in $examNodeCandidates | Select-Object -Unique) {
    if (-not (Test-Path -LiteralPath $examCandidate)) {
        continue
    }
    $examVersionText = & $examCandidate --version
    $examVersion = [version]($examVersionText.TrimStart("v"))
    if ($examVersion -ge [version]"22.13.0") {
        $examNode = $examCandidate
        break
    }
}

if (-not $examNode) {
    Write-Host "Node.js 22.13 or newer is required." -ForegroundColor Yellow
    Write-Host "Install the current Node.js LTS release, then run this launcher again: https://nodejs.org/"
    Read-Host "Press Enter to close"
    exit 1
}

if (-not (Test-Path -LiteralPath $examCli)) {
    Write-Host "The local packages are missing." -ForegroundColor Yellow
    Write-Host "From this folder, run 'npm install' with Node.js 22.13 or newer, then try again."
    Read-Host "Press Enter to close"
    exit 1
}

$env:WRANGLER_LOG_PATH = ".wrangler/wrangler.log"
$examProcess = Start-Process -FilePath $examNode `
    -ArgumentList @("`"$examCli`"", "dev") `
    -WorkingDirectory $examRoot `
    -RedirectStandardOutput $examOutputLog `
    -RedirectStandardError $examErrorLog `
    -WindowStyle Hidden `
    -PassThru

try {
    $examReady = $false
    for ($examAttempt = 0; $examAttempt -lt 80; $examAttempt++) {
        if ($examProcess.HasExited) {
            throw "The exam server stopped before it was ready."
        }
        if (Test-Ai103Server) {
            $examReady = $true
            break
        }
        Start-Sleep -Milliseconds 250
    }

    if (-not $examReady) {
        throw "The exam server did not become ready in time."
    }

    if (-not $NoBrowser) {
        Start-Process $examUrl
    }

    Write-Host ""
    Write-Host "AI-103 Practice Exam is ready." -ForegroundColor Green
    Write-Host $examUrl -ForegroundColor Cyan
    Write-Host ""
    Read-Host "Press Enter when you want to stop the local exam server"
}
finally {
    if ($examProcess -and -not $examProcess.HasExited) {
        Stop-Process -Id $examProcess.Id -Force
    }
}
