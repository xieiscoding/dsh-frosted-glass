@echo off
setlocal
set "APP_DIR=%~1"
if not defined APP_DIR if exist "%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\app.asar" set "APP_DIR=%LOCALAPPDATA%\Programs\DeepSeek Harness"
if not defined APP_DIR if exist "%ProgramFiles%\DeepSeek Harness\resources\app.asar" set "APP_DIR=%ProgramFiles%\DeepSeek Harness"
if not defined APP_DIR if exist "%ProgramFiles(x86)%\DeepSeek Harness\resources\app.asar" set "APP_DIR=%ProgramFiles(x86)%\DeepSeek Harness"
if not defined APP_DIR (
  echo Could not find the DeepSeek Harness installation automatically.
  echo Usage: "%~nx0" "D:\Path\To\DeepSeek Harness"
  pause
  exit /b 1
)
tasklist 2>nul | find /I "DeepSeek Harness.exe" >nul
if not errorlevel 1 (
  echo Please fully quit DeepSeek Harness first: tray menu -^> Exit.
  pause
  exit /b 1
)
set "NODE=%APP_DIR%\resources\runtime\primary-runtime\dependencies\node\bin\node.exe"
if not exist "%NODE%" (
  echo Bundled Node runtime not found: "%NODE%"
  pause
  exit /b 1
)
"%NODE%" "%~dp0install-glass.mjs" --app-dir "%APP_DIR%"
if errorlevel 1 (
  echo Installation failed. See the output above.
  pause
  exit /b 1
)
echo.
echo Fully quit and reopen DeepSeek Harness to activate the native acrylic window.
pause
