@echo off
echo ========================================
echo    DETENIENDO SERVIDOR DE PEDIDOS
echo ========================================
echo.
echo Buscando procesos de Node.js...

tasklist /FI "IMAGENAME eq node.exe" 2>NUL | find /I /N "node.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo Procesos encontrados. Deteniendo...
    taskkill /F /IM node.exe /T >nul 2>&1
    if %errorlevel% equ 0 (
        echo.
        echo [OK] Servidor detenido exitosamente.
    ) else (
        echo.
        echo [ERROR] No se pudieron detener los procesos.
    )
) else (
    echo.
    echo [INFO] No se encontraron procesos de Node.js en ejecucion.
)

echo.
echo Presiona cualquier tecla para cerrar...
pause >nul

