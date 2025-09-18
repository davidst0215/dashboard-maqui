"""
Cloud Function - Activar Análisis para Transcripciones Existentes
Procesa todas las transcripciones sin análisis
"""
import functions_framework
import requests
import logging
from google.cloud import bigquery

PROJECT_ID = "peak-emitter-350713"
DATASET_ID = "Calidad_Llamadas"
ANALYSIS_URL = "https://us-central1-peak-emitter-350713.cloudfunctions.net/analyze-quality"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@functions_framework.http
def trigger_batch_analysis(request):
    """
    HTTP Cloud Function para activar análisis en lote
    """
    try:
        logger.info("🔄 Iniciando análisis en lote para transcripciones existentes...")
        
        # 1. Obtener todas las transcripciones sin análisis
        client = bigquery.Client(project=PROJECT_ID)
        
        query = f"""
        SELECT t.dni, t.transcripcion_texto, t.audio_url
        FROM `{PROJECT_ID}.{DATASET_ID}.transcripciones` t
        LEFT JOIN `{PROJECT_ID}.{DATASET_ID}.analisis_calidad` a 
            ON t.dni = a.dni AND t.audio_url = a.audio_url
        WHERE t.estado = 'procesado' 
        AND a.dni IS NULL
        ORDER BY t.created_at DESC
        LIMIT 500
        """
        
        result = client.query(query).to_dataframe()
        
        if result.empty:
            return {
                "success": True,
                "message": "No hay transcripciones pendientes de análisis",
                "processed": 0
            }
        
        logger.info(f"📋 Encontradas {len(result)} transcripciones para analizar")
        
        # 2. Procesar cada transcripción
        processed = 0
        errors = 0
        
        for index, row in result.iterrows():
            try:
                dni = str(row['dni'])
                transcription_text = row['transcripcion_texto']
                
                success = trigger_single_analysis(dni, transcription_text)
                
                if success:
                    processed += 1
                    if processed % 10 == 0:
                        logger.info(f"✅ Procesadas {processed}/{len(result)} transcripciones")
                else:
                    errors += 1
                    
            except Exception as e:
                errors += 1
                logger.error(f"❌ Error procesando DNI {row.get('dni', 'unknown')}: {str(e)}")
        
        logger.info(f"🎉 Análisis en lote completo: {processed} exitosas, {errors} errores")
        
        return {
            "success": True,
            "message": f"Análisis en lote completado: {processed}/{len(result)}",
            "processed": processed,
            "errors": errors,
            "total_found": len(result)
        }
        
    except Exception as e:
        logger.error(f"❌ Error en análisis en lote: {str(e)}")
        return {"error": str(e)}, 500

def trigger_single_analysis(dni, transcription_text):
    """Llamar a la función de análisis para una transcripción"""
    try:
        payload = {
            "dni": dni,
            "transcription": transcription_text
        }
        
        response = requests.post(
            ANALYSIS_URL,
            json=payload,
            timeout=120  # 2 minutos timeout
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success', False):
                return True
            else:
                logger.error(f"❌ Error análisis {dni}: {result.get('error', 'Unknown')}")
                return False
        else:
            logger.error(f"❌ HTTP {response.status_code} análisis {dni}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Excepción análisis {dni}: {str(e)}")
        return False