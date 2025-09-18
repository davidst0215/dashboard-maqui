@echo off
echo 🔑 Configurando variables de entorno para Cloud Function
echo =====================================================

REM Configurar GOOGLE_APPLICATION_CREDENTIALS
set GOOGLE_APPLICATION_CREDENTIALS=%~dp0..\dashboard-backend\peak-emitter-350713-credentials.json
echo ✅ GOOGLE_APPLICATION_CREDENTIALS configurada: %GOOGLE_APPLICATION_CREDENTIALS%

REM Variables que debes configurar manualmente con tus API keys
echo.
echo ⚠️  CONFIGURA MANUALMENTE TUS API KEYS:
echo.
echo set DEEPGRAM_API_KEY=tu_deepgram_api_key_aqui
echo set OPENAI_API_KEY=tu_openai_api_key_aqui
echo.
echo 📋 Copia y pega los comandos de arriba reemplazando con tus API keys reales
echo.

REM Mostrar estado actual
echo 📊 Estado actual de variables:
echo GOOGLE_APPLICATION_CREDENTIALS: %GOOGLE_APPLICATION_CREDENTIALS%
echo DEEPGRAM_API_KEY: %DEEPGRAM_API_KEY%
echo OPENAI_API_KEY: %OPENAI_API_KEY%

pause