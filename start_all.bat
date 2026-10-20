@echo off
chcp 65001 > nul
title Cloud Storage Manager

echo ===================================================
echo 1. Сборка React-фронтенда...
echo ===================================================
cd /d "%~dp0cloud-ui"
call npm run build

echo.
echo ===================================================
echo 2. Запуск Backend Worker #1 (Порт 8001)...
echo ===================================================
start "Cloud Backend [8001]" cmd /k "cd /d "%~dp0cloud-backend" && call .venv\Scripts\activate.bat && uvicorn main:app --host 127.0.0.1 --port 8001 --log-level info"

echo.
echo ===================================================
echo 3. Запуск Backend Worker #2 (Порт 8002)...
echo ===================================================
start "Cloud Backend [8002]" cmd /k "cd /d "%~dp0cloud-backend" && call .venv\Scripts\activate.bat && uvicorn main:app --host 127.0.0.1 --port 8002 --log-level info"

echo.
echo ===================================================
echo 4. Перезапуск Nginx (Балансировщик 8000)...
echo ===================================================
cd /d "%~dp0nginx"
nginx.exe -s reload 2>nul || start nginx.exe

echo.
echo ===================================================
echo Кластер успешно запущен!
echo Nginx (http://localhost:8000) балансирует между 8001 и 8002.
echo ===================================================
pause