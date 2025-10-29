@echo off
echo 🔄 Matando procesos en puerto 5050...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5050') do (
    echo Matando PID: %%a
    taskkill /F /PID %%a 2>nul
)

echo ⏳ Esperando 2 segundos...
timeout /t 2 /nobreak >nul

echo 🚀 Iniciando backend...
cd backend
npm start