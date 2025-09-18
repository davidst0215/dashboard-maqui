"""
Cloud Function - Procesador Batch Diario
Ejecuta una vez al día para procesar llamadas nuevas desde el CSV
"""
import functions_framework
import pandas as pd
import requests
import logging
import time
from google.cloud import bigquery, storage
from datetime import datetime
import json

PROJECT_ID = "peak-emitter-350713"
DATASET_ID = "Calidad_Llamadas"
CSV_PATH = "gs://buckets_llamadas/0000000000000000/registro_llamadas.csv"

# URLs de las Cloud Functions existentes
TRANSCRIPTION_URL = "https://us-central1-peak-emitter-350713.cloudfunctions.net/transcribe-audio"
ANALYSIS_URL = "https://us-central1-peak-emitter-350713.cloudfunctions.net/analyze-quality"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@functions_framework.http
def process_daily_batch(request):
    """
    Función principal que se ejecuta diariamente
    Lee el CSV y procesa llamadas no transcritas
    """
    try:
        logger.info("🔄 Iniciando procesamiento batch diario...")
        
        # 1. Leer el CSV desde Cloud Storage
        df_calls = read_csv_from_storage()
        if df_calls is None or df_calls.empty:
            return {"error": "No se pudo leer el CSV o está vacío"}, 400
            
        logger.info(f"📋 CSV leído: {len(df_calls)} llamadas totales")
        
        # 2. Obtener llamadas ya procesadas desde BigQuery
        processed_calls = get_processed_calls()
        logger.info(f"✅ Llamadas ya procesadas: {len(processed_calls)}")
        
        # 3. Encontrar llamadas pendientes
        pending_calls = find_pending_calls(df_calls, processed_calls)
        logger.info(f"⏳ Llamadas pendientes: {len(pending_calls)}")
        
        if len(pending_calls) == 0:
            return {
                "success": True,
                "message": "No hay llamadas nuevas para procesar",
                "total_calls": len(df_calls),
                "processed_calls": len(processed_calls),
                "pending_calls": 0
            }
        
        # 4. Procesar todas las llamadas pendientes en grupos de 500
        batch_size = 500
        total_pending = len(pending_calls)
        calls_to_process = pending_calls  # REACTIVADO: Procesar todas las llamadas
        
        results = process_pending_calls(calls_to_process)
        
        return {
            "success": True,
            "message": f"Procesamiento completado: {results['processed']}/{len(calls_to_process)}",
            "total_calls": len(df_calls),
            "processed_calls": len(processed_calls),
            "pending_calls": len(pending_calls),
            "processed_today": results['processed'],
            "errors_today": results['errors'],
            "remaining_pending": 0  # Procesamos todas las llamadas
        }
        
    except Exception as e:
        logger.error(f"❌ Error en procesamiento batch: {str(e)}")
        return {"error": str(e)}, 500

def read_csv_from_storage():
    """Leer el CSV desde Google Cloud Storage"""
    try:
        storage_client = storage.Client(project=PROJECT_ID)
        bucket_name = "buckets_llamadas"
        blob_path = "0000000000000000/registro_llamadas.csv"
        
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_path)
        
        # Leer CSV directamente en pandas
        csv_content = blob.download_as_text()
        from io import StringIO
        df = pd.read_csv(StringIO(csv_content))
        
        # Limpiar y validar datos
        df = df.dropna(subset=['gsutil_url', 'N_Doc'])
        df['N_Doc'] = df['N_Doc'].astype(str)
        
        return df
        
    except Exception as e:
        logger.error(f"Error leyendo CSV: {str(e)}")
        return None

def get_processed_calls():
    """Obtener URLs de audios ya procesados desde BigQuery"""
    try:
        client = bigquery.Client(project=PROJECT_ID)
        
        query = f"""
        SELECT DISTINCT audio_url
        FROM `{PROJECT_ID}.{DATASET_ID}.transcripciones`
        WHERE estado = 'procesado'
        """
        
        result = client.query(query).to_dataframe()
        return set(result['audio_url'].tolist()) if not result.empty else set()
        
    except Exception as e:
        logger.error(f"Error obteniendo llamadas procesadas: {str(e)}")
        return set()

def find_pending_calls(df_calls, processed_calls):
    """Encontrar llamadas que no han sido procesadas basado en URL de audio"""
    logger.info(f"🔍 Total llamadas en CSV: {len(df_calls)}")
    logger.info(f"🔍 URLs ya procesadas: {len(processed_calls)}")
    
    # Remover duplicados del CSV primero
    df_calls_unique = df_calls.drop_duplicates(subset=['gsutil_url'], keep='first')
    logger.info(f"🔍 URLs únicas en CSV: {len(df_calls_unique)}")
    
    # Filtrar llamadas cuya URL no está en la lista de procesadas
    pending = df_calls_unique[~df_calls_unique['gsutil_url'].isin(processed_calls)]
    
    logger.info(f"🔍 Llamadas pendientes después de filtrar: {len(pending)}")
    
    # Ordenar por fecha más reciente primero
    if 'Fecha_Llamada' in pending.columns:
        pending = pending.sort_values('Fecha_Llamada', ascending=False)
    
    return pending

def process_pending_calls(calls_df):
    """Procesar las llamadas pendientes en grupos de 500"""
    processed = 0
    errors = 0
    total_calls = len(calls_df)
    batch_size = 500
    
    logger.info(f"🚀 Iniciando procesamiento de {total_calls} llamadas en lotes de {batch_size}")
    
    # Procesar en lotes de 500
    for batch_start in range(0, total_calls, batch_size):
        batch_end = min(batch_start + batch_size, total_calls)
        batch_df = calls_df.iloc[batch_start:batch_end]
        
        logger.info(f"📦 Procesando lote {batch_start//batch_size + 1}: llamadas {batch_start+1}-{batch_end} de {total_calls}")
        
        # Procesar cada llamada en el lote actual
        for index, call in batch_df.iterrows():
            try:
                # Extraer información de la llamada
                gsutil_url = call['gsutil_url']
                dni = str(call['N_Doc'])
                
                # Extraer bucket y filename desde la URL
                # gs://buckets_llamadas/000729143/filename.wav
                url_parts = gsutil_url.replace('gs://buckets_llamadas/', '').split('/')
                if len(url_parts) >= 2:
                    bucket_path = url_parts[0]
                    filename = url_parts[1]
                    
                    # Llamar a la función de transcripción
                    success = trigger_transcription(bucket_path, filename, dni)
                    
                    if success:
                        processed += 1
                        if processed % 10 == 0:  # Log cada 10 llamadas
                            logger.info(f"✅ Procesadas {processed}/{total_calls} llamadas")
                    else:
                        errors += 1
                        logger.error(f"❌ Error procesando llamada {dni}")

                    # Pausa para evitar sobrecarga
                    time.sleep(3)  # 3 segundos entre llamadas
                else:
                    errors += 1
                    logger.error(f"❌ URL inválida: {gsutil_url}")

            except Exception as e:
                errors += 1
                logger.error(f"❌ Error procesando llamada {index}: {str(e)}")

            # Pausa adicional cada 5 llamadas
            if (processed + errors) % 5 == 0:
                logger.info("⏸️ Pausa de 5 segundos...")
                time.sleep(5)
        
        # Log progreso del lote
        logger.info(f"📊 Lote completado: {processed} exitosas, {errors} errores")
    
    logger.info(f"🎉 Procesamiento completo: {processed} exitosas, {errors} errores de {total_calls} total")
    return {"processed": processed, "errors": errors}

def trigger_transcription(bucket_path, filename, dni):
    """Llamar a la Cloud Function de transcripción con reintentos"""
    max_retries = 3
    retry_delay = 5  # segundos

    for attempt in range(max_retries):
        try:
            payload = {
                "bucketName": "buckets_llamadas",
                "fileName": f"{bucket_path}/{filename}"
            }

            logger.info(f"🎤 Intento {attempt + 1} transcripción para {dni}")

            response = requests.post(
                TRANSCRIPTION_URL,
                json=payload,
                timeout=300,  # 5 minutos timeout
                headers={'Connection': 'close'}  # Evitar keep-alive
            )

            if response.status_code == 200:
                result = response.json()
                if result.get('success', False):
                    logger.info(f"✅ Transcripción exitosa para {dni}")
                    return True
                else:
                    logger.error(f"❌ Error en transcripción {dni}: {result.get('error', 'Unknown')}")
                    return False
            else:
                logger.error(f"❌ HTTP {response.status_code} para {dni}")
                if attempt < max_retries - 1:
                    logger.info(f"⏳ Reintentando en {retry_delay} segundos...")
                    time.sleep(retry_delay)
                    continue
                return False

        except requests.exceptions.SSLError as ssl_error:
            logger.error(f"❌ SSL Error para {dni} (intento {attempt + 1}): {str(ssl_error)}")
            if attempt < max_retries - 1:
                logger.info(f"⏳ Reintentando en {retry_delay} segundos...")
                time.sleep(retry_delay)
                continue
            return False

        except Exception as e:
            logger.error(f"❌ Excepción llamando transcripción {dni} (intento {attempt + 1}): {str(e)}")
            if attempt < max_retries - 1:
                logger.info(f"⏳ Reintentando en {retry_delay} segundos...")
                time.sleep(retry_delay)
                continue
            return False

    return False