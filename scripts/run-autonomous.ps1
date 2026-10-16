# Runs Claude Code on this project, unattended, until docs/log/STATUS.md says DONE.
#
# Each round starts a fresh non-interactive session with the /work command. When a session ends
# (usage limit, context full, or a crash) the script waits and starts the next one. A session that
# ends within a few minutes almost always means the usage limit is still in effect, so the script
# keeps retrying every few minutes: work resumes at the first moment the limit lets it.
#
# Usage (from the project folder, in the VS Code terminal):
#   powershell -ExecutionPolicy Bypass -File scripts\run-autonomous.ps1
# Optional:
#   -Model sonnet           model for the orchestrator (subagents choose their own)
#   -RetryMinutes 5         wait between attempts while the usage limit is active
#   -RestartSeconds 30      wait before starting the next session after a normal end

param(
  [string]$Model = "sonnet",
  [int]$RetryMinutes = 5,
  [int]$RestartSeconds = 30
)

$ErrorActionPreference = "Continue"
Set-Location (Split-Path $PSScriptRoot -Parent)
$status = "docs/log/STATUS.md"
$log = "docs/log/runner.log"
New-Item -ItemType Directory -Force -Path "docs/log" | Out-Null

function Write-Log([string]$msg) {
  $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  Write-Host $line
  Add-Content -Path $log -Value $line
}

function Test-Done {
  if (-not (Test-Path $status)) { return $false }
  $first = Get-Content $status -TotalCount 1
  return ($first -match '^\s*DONE')
}

# Keep Windows awake while this script runs (released automatically when it exits).
try {
  Add-Type -Namespace Win32 -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);' -ErrorAction SilentlyContinue
  [Win32.Power]::SetThreadExecutionState([uint32]2147483649) | Out-Null   # 0x80000001 = ES_CONTINUOUS | ES_SYSTEM_REQUIRED
  Write-Log "Keeping the computer awake while the runner is active."
} catch { Write-Log "Could not set keep-awake; set Windows power settings to never sleep." }

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  Write-Log "ERROR: 'claude' command not found. Install Claude Code and log in first (see README.md)."
  exit 1
}

Write-Log "Runner started. Model: $Model"
while (-not (Test-Done)) {
  $start = Get-Date
  Write-Log "Starting a work session."
  claude -p "/work" --model $Model --dangerously-skip-permissions --output-format text 2>&1 |
    ForEach-Object { $_; Add-Content -Path $log -Value $_ }
  $code = $LASTEXITCODE
  $minutes = [math]::Round(((Get-Date) - $start).TotalMinutes, 1)
  Write-Log "Session ended (exit $code) after $minutes min."

  if (Test-Done) { break }

  if ($minutes -lt 3) {
    Write-Log "Short session: probably the usage limit. Trying again in $RetryMinutes min."
    Start-Sleep -Seconds ($RetryMinutes * 60)
  } else {
    Start-Sleep -Seconds $RestartSeconds
  }
}
Write-Log "STATUS.md says DONE. Read docs/log/FINAL-REPORT.md."
