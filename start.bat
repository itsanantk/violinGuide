@echo off
REM Starts the local server and opens the site.
REM The microphone only works over localhost or HTTPS, which is why this
REM exists instead of just double-clicking index.html.

cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8080
  py -m http.server 8080 --bind 127.0.0.1
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8080
  python -m http.server 8080 --bind 127.0.0.1
  goto :eof
)

where node >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8080
  npx --yes http-server -p 8080 -a 127.0.0.1 -c-1
  goto :eof
)

echo Could not find Python or Node to serve the files.
echo Install either one, or run any static server in this folder on port 8080.
pause
