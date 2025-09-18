#!/bin/bash
# Script de despliegue para Cloud Function de Análisis de Calidad

PROJECT_ID="peak-emitter-350713"
FUNCTION_NAME="process-audio-quality"
REGION="us-central1"

echo "🚀 Desplegando Cloud Function mejorada..."
echo "Project: $PROJECT_ID"
echo "Function: $FUNCTION_NAME"
echo "Region: $REGION"
echo ""

# Desplegar función
gcloud functions deploy $FUNCTION_NAME \
  --gen2 \
  --runtime=python311 \
  --region=$REGION \
  --source=. \
  --entry-point=process_audio_quality \
  --trigger=https \
  --memory=1024MB \
  --timeout=540s \
  --max-instances=10 \
  --allow-unauthenticated \
  --project=$PROJECT_ID

echo ""
echo "✅ Despliegue completado!"
echo ""
echo "URL de la función:"
gcloud functions describe $FUNCTION_NAME --region=$REGION --project=$PROJECT_ID --format="value(serviceConfig.uri)"