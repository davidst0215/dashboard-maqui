#!/bin/bash

# 🚀 Script de despliegue completo para Dashboard Maqui
# Autor: Claude Code Assistant
# Fecha: 2025-09-13

set -e  # Exit on any error

PROJECT_ID="peak-emitter-350713"
REGION="us-central1"

echo "🚀 ========== INICIANDO DESPLIEGUE DASHBOARD MAQUI =========="
echo "📍 Proyecto: $PROJECT_ID"
echo "🌍 Región: $REGION"
echo ""

# Verificar que gcloud esté configurado
echo "🔍 Verificando configuración de gcloud..."
if ! gcloud config get-value project >/dev/null 2>&1; then
    echo "❌ Error: gcloud no está configurado. Ejecuta: gcloud auth login"
    exit 1
fi

# Configurar proyecto
echo "⚙️ Configurando proyecto..."
gcloud config set project $PROJECT_ID

# Habilitar APIs necesarias
echo "🔌 Habilitando APIs necesarias..."
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    cloudfunctions.googleapis.com \
    speech.googleapis.com \
    aiplatform.googleapis.com \
    storage.googleapis.com \
    bigquery.googleapis.com

echo ""
echo "🏗️ ========== PASO 1: DESPLEGAR BACKEND (Cloud Run) =========="
cd dashboard-backend

echo "🔨 Construyendo y desplegando backend..."
gcloud builds submit --config cloudbuild.yaml

echo "✅ Backend desplegado exitosamente!"
BACKEND_URL=$(gcloud run services describe maqui-dashboard-backend --region=$REGION --format="value(status.url)")
echo "🔗 URL del Backend: $BACKEND_URL"

cd ..

echo ""
echo "📱 ========== PASO 2: CONFIGURAR FRONTEND (Vercel) =========="

# Actualizar URL del backend en producción
sed -i "s|VITE_API_BASE_URL=.*|VITE_API_BASE_URL=$BACKEND_URL|" .env.production

echo "✅ Configuración del frontend actualizada"
echo "🔗 Para desplegar en Vercel:"
echo "   1. Conecta tu repositorio GitHub con Vercel"
echo "   2. Vercel detectará automáticamente React y desplegará"
echo "   3. Configura las variables de entorno en Vercel Dashboard"

echo ""
echo "☁️ ========== PASO 3: DESPLEGAR CLOUD FUNCTIONS =========="

echo "🎤 Desplegando función de transcripción..."
cd cloud-functions/transcription-function
npm install
gcloud functions deploy transcribeAudio \
    --trigger-bucket=buckets_llamadas \
    --runtime=nodejs18 \
    --memory=1GB \
    --timeout=540s \
    --region=$REGION

cd ../quality-analysis-function

echo "🧠 Desplegando función de análisis de calidad..."
npm install
gcloud functions deploy analyzeQuality \
    --trigger-http \
    --runtime=nodejs18 \
    --memory=1GB \
    --timeout=540s \
    --allow-unauthenticated \
    --region=$REGION

ANALYSIS_URL=$(gcloud functions describe analyzeQuality --region=$REGION --format="value(httpsTrigger.url)")

cd ../..

echo ""
echo "⏰ ========== PASO 4: CONFIGURAR SCHEDULER (OPCIONAL) =========="
echo "🕐 Configurando cron job para análisis periódico..."

gcloud scheduler jobs create http quality-analysis-cron \
    --schedule="0 */6 * * *" \
    --uri="$ANALYSIS_URL" \
    --http-method=POST \
    --location=$REGION \
    --description="Ejecuta análisis de calidad cada 6 horas" || echo "⚠️ Scheduler ya existe o falló (no crítico)"

echo ""
echo "🎉 ========== DESPLIEGUE COMPLETADO =========="
echo ""
echo "📊 URLs de tu aplicación:"
echo "   🖥️  Backend API: $BACKEND_URL"
echo "   🧠 Análisis IA: $ANALYSIS_URL"
echo "   📱 Frontend: [Configurar en Vercel]"
echo ""
echo "🔧 Próximos pasos:"
echo "   1. Desplegar frontend en Vercel conectando tu repo GitHub"
echo "   2. Probar que las Cloud Functions respondan correctamente"
echo "   3. Subir un archivo de audio para probar el pipeline completo"
echo ""
echo "✅ El sistema ahora es completamente independiente y escalable!"