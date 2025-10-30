@echo off
echo Buscando procesos que usan el puerto 5050...

:: Buscar procesos que usan el puerto 5000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5050') do (
    echo Matando proceso con PID: %%a
    taskkill /f /pid %%a >nul 2>&1
    if errorlevel 1 (
        echo No se pudo matar el proceso %%a
    ) else (
        echo Proceso %%a eliminado exitosamente
    )
)

echo.
echo Verificando si el puerto 5050 esta libre...
netstat -aon | findstr :5050
if errorlevel 1 (
    echo ✅ Puerto 5050 esta libre
) else (
    echo ⚠️  Aun hay procesos usando el puerto 5000
)


