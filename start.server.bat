@echo off
title TradeFlow 3
cd /d "%~dp0"
node -e "if(Number(process.versions.node.split('.')[0])<24) process.exit(1)"
if errorlevel 1 (
  echo Install Node.js 24 or newer, then run this launcher again.
  pause
  exit /b 1
)
if not exist "node_modules\xlsx" (
  call npm ci --omit=dev
  if errorlevel 1 exit /b 1
)
node server.js --open
if errorlevel 1 pause
