@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM Script para clonar base de datos PostgreSQL remota a local
REM ============================================================

echo.
echo ============================================================
echo   CLONACION DE BASE DE DATOS PARSE_DB
echo ============================================================
echo.
echo Servidor remoto: 149.50.148.198:5432
echo Base de datos:   parse_db
echo Usuario:         postgres
echo.

REM Buscar instalación de PostgreSQL
set "PGBIN="

REM Buscar en rutas comunes
for %%V in (17 16 15 14 13 12) do (
    if exist "C:\Program Files\PostgreSQL\%%V\bin\pg_dump.exe" (
        set "PGBIN=C:\Program Files\PostgreSQL\%%V\bin"
        goto :found
    )
)

:found
if "%PGBIN%"=="" (
    echo ERROR: No se encontro PostgreSQL instalado.
    echo Por favor, asegurate de tener PostgreSQL instalado localmente.
    echo Descarga desde: https://www.postgresql.org/download/windows/
    pause
    exit /b 1
)

echo PostgreSQL encontrado en: %PGBIN%
echo.

REM Configurar contraseña
set PGPASSWORD=Q27G4B98

REM Crear directorio para backups si no existe
if not exist "..\backups" mkdir "..\backups"

REM Nombre del archivo de backup
set BACKUP_FILE=..\backups\parse_db_backup.sql

echo [1/5] Creando backup de la base de datos remota...
echo.

REM Crear backup desde el servidor remoto
"%PGBIN%\pg_dump.exe" -h 149.50.148.198 -p 5432 -U postgres -d parse_db -F p -f "%BACKUP_FILE%" --no-owner --no-acl -v

if %errorlevel% neq 0 (
    echo.
    echo ERROR: No se pudo crear el backup.
    echo Verifica que el servidor remoto sea accesible.
    pause
    exit /b 1
)

echo.
echo [2/5] Backup creado exitosamente!
echo Archivo: %BACKUP_FILE%
echo.

REM Verificar si la base de datos local existe
echo [3/5] Verificando base de datos local...

"%PGBIN%\psql.exe" -U postgres -lqt | findstr "parse_db" >nul 2>&1

if %errorlevel% equ 0 (
    echo.
    echo La base de datos 'parse_db' ya existe localmente.
    echo Eliminandola para recrearla...
    "%PGBIN%\psql.exe" -U postgres -c "DROP DATABASE IF EXISTS parse_db;"
)

echo.
echo [4/5] Creando base de datos local 'parse_db'...
"%PGBIN%\psql.exe" -U postgres -c "CREATE DATABASE parse_db ENCODING 'UTF8';"

if %errorlevel% neq 0 (
    echo.
    echo ERROR: No se pudo crear la base de datos local.
    pause
    exit /b 1
)

echo.
echo [5/5] Restaurando backup en localhost...
echo (Esto puede tomar varios minutos...)
echo.

"%PGBIN%\psql.exe" -U postgres -d parse_db -f "%BACKUP_FILE%" -q

echo.
echo ============================================================
echo   PROCESO COMPLETADO EXITOSAMENTE
echo ============================================================
echo.
echo La base de datos 'parse_db' ha sido clonada a localhost.
echo.
echo Backup guardado en: %BACKUP_FILE%
echo.
echo Siguiente paso: Actualizar el archivo .env con:
echo DATABASE_URL=postgresql://postgres:Q27G4B98@localhost:5432/parse_db
echo.

REM Limpiar contraseña
set PGPASSWORD=

pause
