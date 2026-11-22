@echo off
setlocal
cd /d "%~dp0"

if not exist ".tools\node\npm.cmd" (
  echo.
  echo   Node.js was not found in .tools\node.
  echo   Install Node.js 20+ and run:
  echo     npm install
  echo     npm run dev
  echo.
  pause
  exit /b 1
)

set "PATH=%~dp0.tools\node;%PATH%"
echo Starting Milk Frog Slingshot...
call ".tools\node\npm.cmd" run dev -- --open
