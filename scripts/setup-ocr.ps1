param([string]$Python = '')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$environmentRoot = Join-Path $projectRoot 'rapidocr\.venv'
if (-not $Python) {
    $bundledPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
    if (Test-Path -LiteralPath $bundledPython) { $Python = $bundledPython }
    else { $Python = (Get-Command python -ErrorAction Stop).Source }
}
& $Python -m venv $environmentRoot
if ($LASTEXITCODE -ne 0) { throw 'Could not create the OCR environment. Use Python 3.12 or newer.' }
$environmentPython = Join-Path $environmentRoot 'Scripts\python.exe'
& $environmentPython -m pip install --upgrade 'pip==26.2.2'
if ($LASTEXITCODE -ne 0) { throw 'Could not update pip.' }
& $environmentPython -m pip install -r (Join-Path $projectRoot 'rapidocr\requirements-lock.txt')
if ($LASTEXITCODE -ne 0) { throw 'Could not install OCR dependencies.' }
Write-Output 'OCR environment ready.'
