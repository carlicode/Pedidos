@echo off
cd /d "%~dp0"
echo Iniciando servidor...
start "Servidor Pedidos" /MIN cmd /c "npm run dev:all"
timeout /t 2 >nul
exit

