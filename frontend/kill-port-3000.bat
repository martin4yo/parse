@echo off
echo Buscando procesos que usan el puerto 3000...

:: Buscar procesos que usan el puerto 5000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    echo Matando proceso con PID: %%a
    taskkill /f /pid %%a >nul 2>&1
    if errorlevel 1 (
        echo No se pudo matar el proceso %%a
    ) else (
        echo Proceso %%a eliminado exitosamente
    )
)

echo.
echo Verificando si el puerto 3000 esta libre...
netstat -aon | findstr :3000
if errorlevel 1 (
    echo ✅ Puerto 3000 esta libre
) else (
    echo ⚠️  Aun hay procesos usando el puerto 5000
)



