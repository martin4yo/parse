@echo off
REM ============================================================
REM Script para clonar base de datos PostgreSQL remota a local
REM ============================================================
REM Servidor remoto: 149.50.148.198:5432
REM Base de datos: parse_db
REM Usuario: postgres
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

REM Solicitar contraseña
set /p PGPASSWORD="Ingresa la contrasena del servidor remoto: "
echo.

REM Crear directorio para backups si no existe
if not exist "backups" mkdir backups

REM Nombre del archivo de backup con timestamp
set TIMESTAMP=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set BACKUP_FILE=backups\parse_db_%TIMESTAMP%.sql

echo [1/5] Creando backup de la base de datos remota...
echo.

REM Exportar PGPASSWORD para pg_dump
set PGPASSWORD=%PGPASSWORD%

REM Crear backup desde el servidor remoto
pg_dump -h 149.50.148.198 -p 5432 -U postgres -d parse_db -F p -f "%BACKUP_FILE%" --no-owner --no-acl -v

if %errorlevel% neq 0 (
    echo.
    echo ERROR: No se pudo crear el backup. Verifica:
    echo - La contrasena sea correcta
    echo - El servidor este accesible
    echo - Tengas permisos en la base de datos
    echo.
    pause
    exit /b 1
)

echo.
echo [2/5] Backup creado exitosamente: %BACKUP_FILE%
echo.

REM Verificar si la base de datos local existe
echo [3/5] Verificando base de datos local...
psql -U postgres -lqt | findstr /C:"parse_db" >nul 2>&1

if %errorlevel% equ 0 (
    echo.
    echo ADVERTENCIA: La base de datos 'parse_db' ya existe localmente.
    set /p OVERWRITE="¿Deseas eliminarla y recrearla? (S/N): "

    if /i "%OVERWRITE%"=="S" (
        echo.
        echo Eliminando base de datos local existente...
        psql -U postgres -c "DROP DATABASE IF EXISTS parse_db;"

        if %errorlevel% neq 0 (
            echo.
            echo ERROR: No se pudo eliminar la base de datos local.
            echo Asegurate de que no haya conexiones activas.
            echo.
            pause
            exit /b 1
        )
    ) else (
        echo.
        echo Operacion cancelada por el usuario.
        pause
        exit /b 0
    )
)

echo.
echo [4/5] Creando base de datos local 'parse_db'...
psql -U postgres -c "CREATE DATABASE parse_db ENCODING 'UTF8';"

if %errorlevel% neq 0 (
    echo.
    echo ERROR: No se pudo crear la base de datos local.
    pause
    exit /b 1
)

echo.
echo [5/5] Restaurando backup en localhost...
echo.

psql -U postgres -d parse_db -f "%BACKUP_FILE%" -v ON_ERROR_STOP=0

if %errorlevel% neq 0 (
    echo.
    echo ADVERTENCIA: Hubo algunos errores durante la restauracion.
    echo Esto es normal si hay diferencias de permisos.
    echo.
)

echo.
echo ============================================================
echo   PROCESO COMPLETADO
echo ============================================================
echo.
echo La base de datos 'parse_db' ha sido clonada exitosamente.
echo.
echo Backup guardado en: %BACKUP_FILE%
echo.
echo Siguiente paso: Actualizar el archivo .env con:
echo DATABASE_URL=postgresql://postgres:TU_PASSWORD_LOCAL@localhost:5432/parse_db
echo.
pause
