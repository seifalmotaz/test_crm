@echo off
setlocal EnableDelayedExpansion
title PropCRM Launcher

set "ROOT=%~dp0"
set "BACKEND=%~dp0backend"

echo.
echo  =========================================
echo   PropCRM  ^|  Real Estate CRM
echo  =========================================
echo.
echo  [1] Run locally  (Node.js + PostgreSQL)
echo  [2] Run on Docker (docker compose up)
echo.
set /p CHOICE=" Choose [1/2]: "
echo.

if "%CHOICE%"=="2" goto :docker

:: ===========================================================================
::  LOCAL MODE
:: ===========================================================================
:local

:: -- Prerequisite: Node.js ---------------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js not found in PATH.
    echo  Download and install it from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: -- .env check --------------------------------------------------------------
if not exist "%BACKEND%\.env" (
    echo  [ERROR] backend\.env not found.
    echo.
    if exist "%BACKEND%\.env.example" (
        echo  Creating backend\.env from backend\.env.example ...
        copy "%BACKEND%\.env.example" "%BACKEND%\.env" >nul
        echo  [OK] backend\.env created. Edit it to set DATABASE_URL and secrets.
    ) else (
        echo  Create it manually: copy "%BACKEND%\.env.example" "%BACKEND%\.env"
        echo  Then fill in DATABASE_URL with your PostgreSQL connection string.
    )
    echo.
    pause
    exit /b 1
)

:: -- PostgreSQL check --------------------------------------------------------
echo  Checking PostgreSQL connection on localhost:5432...
powershell -NoProfile -Command "try{$c=New-Object Net.Sockets.TcpClient('127.0.0.1',5432);$c.Close();exit 0}catch{exit 1}" >nul 2>&1
if not errorlevel 1 goto :pg_ok

:: Not reachable — try starting common PostgreSQL Windows service names
echo  Not reachable. Attempting to start the PostgreSQL service...
sc start postgresql-x64-16 >nul 2>&1
sc start postgresql-x64-15 >nul 2>&1
sc start postgresql-x64-14 >nul 2>&1
sc start postgresql >nul 2>&1
timeout /t 4 /nobreak >nul

powershell -NoProfile -Command "try{$c=New-Object Net.Sockets.TcpClient('127.0.0.1',5432);$c.Close();exit 0}catch{exit 1}" >nul 2>&1
if not errorlevel 1 (
    echo  [OK] PostgreSQL service started.
    goto :pg_ok
)

echo.
echo  [ERROR] Cannot connect to PostgreSQL on localhost:5432.
echo.
echo  PostgreSQL is required for local mode.
echo.
echo    [A] Install PostgreSQL 16 automatically (winget, silent)
echo    [Q] Quit
echo.
set /p PG_CHOICE="  Choose [A/Q]: "

if /i "!PG_CHOICE!" neq "A" (
    echo.
    echo  Manual install:  https://www.postgresql.org/download/windows/
    echo.
    echo  After installing, create the app database:
    echo    psql -U postgres -c "CREATE USER propcrm WITH PASSWORD 'PropCRM_2025!';"
    echo    psql -U postgres -c "CREATE DATABASE propcrm OWNER propcrm;"
    echo.
    pause
    exit /b 1
)

echo.
echo  Installing PostgreSQL 16 via winget (this may take a few minutes)...
winget install PostgreSQL.PostgreSQL.16 --accept-package-agreements --accept-source-agreements --override "--mode unattended --superpassword postgres --serverport 5432"
if not errorlevel 1 goto :pg_install_done

echo.
echo  [WARN] winget download failed. Trying Chocolatey...
where choco >nul 2>&1
if errorlevel 1 goto :pg_no_choco
choco install postgresql16 --params "/Password:postgres" -y
if not errorlevel 1 goto :pg_install_done

:pg_no_choco
echo.
echo  [ERROR] Automatic install failed (download blocked or network error).
echo.
echo  Please install PostgreSQL 16 manually, then re-run this script:
echo    - Set the postgres superuser password to: postgres
echo    - Keep the default port: 5432
echo.
start "" "https://www.postgresql.org/download/windows/"
pause
exit /b 1

:pg_install_done
echo.
echo  Starting PostgreSQL service...
sc start postgresql-x64-16 >nul 2>&1
timeout /t 6 /nobreak >nul

powershell -NoProfile -Command "try{$c=New-Object Net.Sockets.TcpClient('127.0.0.1',5432);$c.Close();exit 0}catch{exit 1}" >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] PostgreSQL still not reachable after install.
    echo  Please reboot and run this script again.
    pause
    exit /b 1
)

echo  [OK] PostgreSQL is running. Creating propcrm database...
set "PSQL=C:\Program Files\PostgreSQL\16\bin\psql.exe"
set PGPASSWORD=postgres
"!PSQL!" -U postgres -h localhost -c "CREATE USER propcrm WITH PASSWORD 'PropCRM_2025!';" >nul 2>&1
"!PSQL!" -U postgres -h localhost -c "CREATE DATABASE propcrm OWNER propcrm;" >nul 2>&1
set PGPASSWORD=
echo  [OK] Database ready.
echo.

:pg_ok

:: -- Stop any servers already running on 5001 / 5173 -------------------------
echo  Stopping any existing servers on ports 5001 and 5173...
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":5001 " ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>&1
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>&1
timeout /t 1 /nobreak >nul

:: -- Backend dependencies ----------------------------------------------------
if not exist "%BACKEND%\node_modules" (
    echo  [1/4] Installing backend dependencies...
    pushd "%BACKEND%"
    call npm install
    if errorlevel 1 (
        echo  [ERROR] Backend npm install failed.
        popd
        pause
        exit /b 1
    )
    popd
) else (
    echo  [1/4] Backend dependencies ... OK
)

:: -- Prisma: generate + push + seed ------------------------------------------
echo  [2/4] Setting up database...
pushd "%BACKEND%"

call npx prisma generate --no-hints 2>nul
if errorlevel 1 (
    echo  [WARN] prisma generate had an issue.
)

call npx prisma db push --accept-data-loss --skip-generate
if errorlevel 1 (
    echo  [ERROR] prisma db push failed.
    echo         Verify DATABASE_URL in backend\.env points to a running PostgreSQL.
    popd
    pause
    exit /b 1
)

call node prisma/seed.js >nul 2>&1
if errorlevel 1 (
    echo  [INFO] Seed skipped ^(already seeded^).
)

popd

:: -- Frontend dependencies ---------------------------------------------------
if not exist "%ROOT%node_modules" (
    echo  [3/4] Installing frontend dependencies...
    pushd "%ROOT%"
    call npm install
    if errorlevel 1 (
        echo  [ERROR] Frontend npm install failed.
        popd
        pause
        exit /b 1
    )
    popd
) else (
    echo  [3/4] Frontend dependencies ... OK
)

:: -- Launch servers ----------------------------------------------------------
echo  [4/4] Starting servers...
echo.

start "PropCRM  Backend  :5001" /D "%BACKEND%" cmd /k "npm run dev"
timeout /t 3 /nobreak >nul
start "PropCRM  Frontend :5173" /D "%ROOT%" cmd /k "npm run dev"
timeout /t 4 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo  =========================================
echo   Backend   ->  http://localhost:5001
echo   Frontend  ->  http://localhost:5173
echo   Health    ->  http://localhost:5001/health
echo  =========================================
echo.
echo  Two server windows are running.
echo  Close them (or Ctrl+C inside each) to stop.
echo.
pause >nul
exit /b 0

:: ===========================================================================
::  DOCKER MODE
:: ===========================================================================
:docker

:: -- Check if Docker binary exists in PATH (is it installed?) ----------------
where docker >nul 2>&1
if errorlevel 1 goto :docker_not_installed

:: -- Docker is installed: check if daemon is running -------------------------
docker info >nul 2>&1
if not errorlevel 1 goto :docker_ready

:: -- Installed but not running: try to start Docker Desktop ------------------
:docker_not_running
echo  Docker Desktop is not running. Starting it now...

set "DD_EXE=C:\Program Files\Docker\Docker\Docker Desktop.exe"
if not exist "!DD_EXE!" set "DD_EXE=%LOCALAPPDATA%\Docker\Docker Desktop.exe"
if exist "!DD_EXE!" (
    start "" "!DD_EXE!"
) else (
    powershell -NoProfile -Command "Start-Process 'Docker Desktop' -ErrorAction SilentlyContinue" >nul 2>&1
)

echo  Waiting for Docker engine to be ready (up to 90 seconds)...
set /a _dt=0
:wait_docker
timeout /t 5 /nobreak >nul
docker info >nul 2>&1
if not errorlevel 1 (
    echo  [OK] Docker engine is ready.
    goto :docker_ready
)
set /a _dt+=1
if !_dt! lss 18 goto :wait_docker

echo.
echo  [ERROR] Docker did not start within 90 seconds.
echo  Open Docker Desktop from the Start Menu, wait for the whale icon
echo  to stop animating, then run this script again.
echo.
pause
exit /b 1

:: -- Docker is not installed at all ------------------------------------------
:docker_not_installed
echo  [ERROR] Docker Desktop is not installed on this machine.
echo.
echo    [A] Install Docker Desktop automatically (winget, ~500 MB)
echo    [Q] Quit
echo.
set /p DC_CHOICE="  Choose [A/Q]: "
if /i "!DC_CHOICE!"=="A" (
    echo.
    echo  Installing Docker Desktop...
    winget install Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
    echo.
    echo  =========================================
    echo   Installation complete. NEXT STEPS:
    echo    1. Restart your computer
    echo    2. Launch Docker Desktop from Start Menu
    echo    3. Wait for the whale icon to stop
    echo    4. Re-run this script and choose [2]
    echo  =========================================
    echo.
) else (
    echo.
    echo  Docker Desktop: https://www.docker.com/products/docker-desktop/
    echo.
)
pause
exit /b 0

:: -- Docker is running and ready ---------------------------------------------
:docker_ready

:: -- Stop any processes already using ports 5001, 5173, or 5432 ---------------
echo  Stopping any existing processes on ports 5001, 5173 and 5432...
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":5001 " ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>&1
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>&1
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":5432 " ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>&1
timeout /t 1 /nobreak >nul

:: -- Create root .env for docker-compose if it doesn't exist -----------------
if not exist "%ROOT%.env" (
    if exist "%ROOT%.env.example" (
        copy "%ROOT%.env.example" "%ROOT%.env" >nul
        echo  [OK] .env created from .env.example.
        echo.
    ) else (
        echo  [ERROR] .env.example not found. Cannot create root .env for Docker.
        pause
        exit /b 1
    )
)

echo  [1/2] Building and starting Docker containers...
echo         (first build may take a few minutes)
echo.

pushd "%ROOT%"
docker compose up --build -d --remove-orphans
if errorlevel 1 (
    echo.
    echo  [ERROR] docker compose failed. Check the output above for details.
    popd
    pause
    exit /b 1
)
popd

echo  [2/2] Waiting for backend to become ready...
set /a _tries=0
:wait_backend
timeout /t 3 /nobreak >nul
set /a _tries+=1
curl -sf http://localhost:5001/health >nul 2>&1
if not errorlevel 1 goto :open_browser
if %_tries% geq 30 goto :open_browser
goto :wait_backend

:open_browser
start "" "http://localhost:5173"

echo.
echo  =========================================
echo   Frontend  ->  http://localhost:5173
echo   Backend   ->  http://localhost:5001
echo   Database  ->  localhost:5432  (propcrm)
echo   Health    ->  http://localhost:5001/health
echo  =========================================
echo.
echo  To stop:   docker compose down
echo  To logs:   docker compose logs -f
echo  To reset:  docker compose down -v   ^(WARNING: deletes all data^)
echo.
pause >nul
