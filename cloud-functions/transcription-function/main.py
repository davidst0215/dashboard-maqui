"""
Cloud Function - Transcripción con Deepgram
Transcribe audios usando Deepgram y guarda en BigQuery
"""
import functions_framework
import os
import json
import logging
from google.cloud import bigquery, storage, secretmanager
from deepgram import DeepgramClient, PrerecordedOptions
from datetime import datetime, timedelta
import hashlib
import requests
import pandas as pd
from io import StringIO

PROJECT_ID = "peak-emitter-350713"
DATASET_ID = "Calidad_Llamadas"
ANALYSIS_URL = "https://us-central1-peak-emitter-350713.cloudfunctions.net/analyze-quality"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_secret_value(secret_id, project_id=PROJECT_ID):
    """Obtener secreto desde Google Cloud Secret Manager"""
    try:
        client = secretmanager.SecretManagerServiceClient()
        name = f"projects/{project_id}/secrets/{secret_id}/versions/latest"
        response = client.access_secret_version(request={"name": name})
        return response.payload.data.decode("UTF-8").strip()
    except Exception as e:
        logger.error(f"Error obteniendo secreto {secret_id}: {e}")
        return None

def read_csv_mapping():
    """Leer CSV y crear mapeo gsutil_url -> N_Doc"""
    try:
        storage_client = storage.Client(project=PROJECT_ID)
        bucket_name = "buckets_llamadas"
        blob_path = "0000000000000000/registro_llamadas.csv"

        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_path)

        # Leer CSV directamente en pandas
        csv_content = blob.download_as_text()
        df = pd.read_csv(StringIO(csv_content))

        # Limpiar y validar datos
        df = df.dropna(subset=['gsutil_url', 'N_Doc'])
        df['N_Doc'] = df['N_Doc'].astype(str)

        # Crear mapeo gsutil_url -> N_Doc
        mapping = {}
        for _, row in df.iterrows():
            gsutil_url = row['gsutil_url']
            n_doc = row['N_Doc']
            mapping[gsutil_url] = n_doc

        logger.info(f"📋 CSV mapping cargado: {len(mapping)} registros")
        return mapping

    except Exception as e:
        logger.error(f"❌ Error leyendo CSV: {str(e)}")
        return None

def get_dni_from_csv(bucket_name, file_name):
    """Obtener DNI real (N_Doc) desde CSV usando gsutil_url"""
    try:
        # Construir gsutil_url completa
        gsutil_url = f"gs://{bucket_name}/{file_name}"

        # Leer mapeo CSV
        mapping = read_csv_mapping()
        if not mapping:
            logger.error("❌ No se pudo cargar mapping CSV")
            return None

        # Buscar DNI en mapping
        dni = mapping.get(gsutil_url)
        if dni:
            logger.info(f"✅ DNI encontrado en CSV: {dni} para {gsutil_url}")
            return str(dni)
        else:
            logger.warning(f"⚠️ DNI no encontrado en CSV para: {gsutil_url}")
            return None

    except Exception as e:
        logger.error(f"❌ Error obteniendo DNI desde CSV: {str(e)}")
        return None

@functions_framework.http
def transcribe_audio(request):
    """
    HTTP Cloud Function para transcribir audio
    Payload: {"bucketName": "bucket", "fileName": "file.wav"}
    """
    try:
        request_json = request.get_json()
        if not request_json:
            return {"error": "No JSON payload provided"}, 400
            
        bucket_name = request_json.get('bucketName')
        file_name = request_json.get('fileName')
        
        if not all([bucket_name, file_name]):
            return {"error": "Missing required fields: bucketName, fileName"}, 400
            
        # Solo procesar archivos de audio
        if not file_name.lower().endswith(('.wav', '.mp3', '.flac', '.m4a')):
            return {"message": f"Skipping non-audio file: {file_name}"}, 200

        # Obtener DNI real (N_Doc) desde CSV
        dni = get_dni_from_csv(bucket_name, file_name)
        if not dni:
            return {"error": f"Could not find DNI in CSV for file: {file_name}"}, 400

        audio_path = f"gs://{bucket_name}/{file_name}"
        
        logger.info(f"🎤 Transcribiendo audio: {audio_path} - DNI: {dni}")
        
        # Transcribir con Deepgram
        transcription_result = transcribe_with_deepgram(audio_path)
        
        if not transcription_result['success']:
            return {"error": f"Transcription failed: {transcription_result['error']}"}, 500
        
        # Guardar en BigQuery
        bigquery_client = bigquery.Client(project=PROJECT_ID)
        transcripcion_id = save_transcription_to_bigquery(
            bigquery_client, transcription_result, dni, audio_path, file_name
        )
        
        if not transcripcion_id:
            return {"error": "Failed to save transcription"}, 500
        
        logger.info(f"✅ Transcripción completada: {dni}")
        
        # Llamar automáticamente a análisis de calidad
        analysis_result = trigger_quality_analysis(transcripcion_id, dni, transcription_result['text'])
        if analysis_result:
            logger.info(f"✅ Análisis de calidad iniciado para {dni}")
        else:
            logger.warning(f"⚠️ Error iniciando análisis para {dni}")
        
        return {
            "success": True,
            "dni": dni,
            "transcripcion_id": transcripcion_id,
            "duration": transcription_result.get('duration', 0),
            "confidence": transcription_result.get('confidence', 0),
            "cost_usd": transcription_result.get('cost_usd', 0),
            "analysis_triggered": analysis_result
        }
        
    except Exception as e:
        logger.error(f"❌ Error: {str(e)}")
        return {"error": str(e)}, 500

def transcribe_with_deepgram(audio_path):
    """Transcribir audio usando Deepgram"""
    try:
        # Obtener API key
        deepgram_api_key = os.environ.get('DEEPGRAM_API_KEY')
        if not deepgram_api_key:
            deepgram_api_key = get_secret_value('deepgram-api-key')
            
        if not deepgram_api_key:
            return {"success": False, "error": "DEEPGRAM_API_KEY not configured"}
            
        # Configurar cliente Deepgram
        deepgram = DeepgramClient(deepgram_api_key)
        
        # Opciones de transcripción optimizadas
        options = PrerecordedOptions(
            model="nova-2",
            language="es",
            smart_format=True,
            punctuate=True,
            diarize=True,
            multichannel=False,
            alternatives=1,
            profanity_filter=False,
            redact=False
        )
        
        logger.info(f"🎙️ Iniciando transcripción Deepgram: {audio_path}")
        
        # Generar URL firmada
        signed_url = generate_signed_url(audio_path)
        if not signed_url:
            return {"success": False, "error": "Could not generate signed URL for audio"}
        
        # Transcribir
        response = deepgram.listen.prerecorded.v("1").transcribe_url({
            "url": signed_url
        }, options)
        
        # Procesar respuesta
        if response and hasattr(response, "results") and response.results:
            channels = response.results.channels
            if channels and len(channels) > 0:
                alternatives = channels[0].alternatives
                if alternatives and len(alternatives) > 0:
                    transcript = alternatives[0].transcript
                    confidence = alternatives[0].confidence
                    
                    # Calcular duración y costo
                    duration = response.metadata.duration if response.metadata else 0
                    cost_usd = duration / 60.0 * 0.005  # $0.005 per minute
                    
                    logger.info(f"✅ Transcripción exitosa: {len(transcript)} chars, {duration}s")
                    
                    return {
                        "success": True,
                        "text": transcript,
                        "confidence": confidence,
                        "duration": duration,
                        "cost_usd": cost_usd,
                        "full_response": response.to_dict() if hasattr(response, 'to_dict') else str(response)
                    }
        
        return {"success": False, "error": "No transcript found in Deepgram response"}
        
    except Exception as e:
        logger.error(f"❌ Error Deepgram: {str(e)}")
        return {"success": False, "error": str(e)}

def generate_signed_url(gs_path):
    """Generar URL firmada para acceso público temporal"""
    try:
        # Extraer bucket y blob del path gs://
        parts = gs_path.replace('gs://', '').split('/')
        bucket_name = parts[0]
        blob_path = '/'.join(parts[1:])
        
        # Intentar con cuenta de servicio específica
        try:
            credentials_json = get_secret_value('deepgram-signer-credentials')
            if credentials_json:
                from google.oauth2 import service_account
                credentials_info = json.loads(credentials_json)
                credentials = service_account.Credentials.from_service_account_info(credentials_info)
                
                storage_client = storage.Client(project=PROJECT_ID, credentials=credentials)
                bucket = storage_client.bucket(bucket_name)
                blob = bucket.blob(blob_path)
                
                signed_url = blob.generate_signed_url(
                    version='v4',
                    expiration=datetime.utcnow() + timedelta(hours=2),
                    method='GET'
                )
                logger.info("✅ URL firmada generada exitosamente")
                return signed_url
                
        except Exception as credentials_error:
            logger.warning(f"⚠️ Error con cuenta específica: {str(credentials_error)}")
        
        # Fallback: cliente por defecto
        logger.info("🔄 Intentando con cliente por defecto...")
        storage_client = storage.Client(project=PROJECT_ID)
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_path)
        
        try:
            signed_url = blob.generate_signed_url(
                version='v4',
                expiration=datetime.utcnow() + timedelta(hours=2),
                method='GET'
            )
            logger.info("✅ URL firmada generada (método estándar)")
            return signed_url
            
        except Exception as signing_error:
            logger.warning(f"⚠️ No se pudo generar URL firmada: {str(signing_error)}")
            
            # Verificar si es público
            try:
                public_url = f"https://storage.googleapis.com/{bucket_name}/{blob_path}"
                response = requests.head(public_url, timeout=10)
                
                if response.status_code == 200:
                    logger.info("✅ URL pública disponible")
                    return public_url
                else:
                    logger.warning(f"⚠️ No es público: HTTP {response.status_code}")
                    
            except Exception as public_error:
                logger.warning(f"⚠️ Error verificando acceso público: {str(public_error)}")
            
            # Último recurso
            return gs_path
        
    except Exception as e:
        logger.error(f"❌ Error generando URL: {str(e)}")
        return None

def extract_date_from_filename(filename):
    """Extraer fecha del nombre del archivo formato DDMMYYYY y convertir a timestamp"""
    try:
        # Buscar patrón DDMMYYYY al inicio del nombre del archivo
        import re
        # Buscar específicamente 8 dígitos consecutivos al inicio (DDMMYYYY)
        date_match = re.search(r'^(\d{2})(\d{2})(\d{4})', filename)
        if date_match:
            day, month, year = date_match.groups()
            # Validar que sea una fecha válida y convertir a timestamp
            try:
                from datetime import datetime
                parsed_date = datetime.strptime(f"{day}/{month}/{year}", "%d/%m/%Y")
                # Convertir a formato timestamp requerido por BigQuery
                return parsed_date.strftime('%Y-%m-%d %H:%M:%S')
            except ValueError as ve:
                logger.warning(f"Fecha inválida extraída {day}/{month}/{year}: {ve}")
                return datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        else:
            # Si no encuentra fecha, usar fecha actual
            logger.warning(f"No se pudo extraer fecha del archivo: {filename}")
            return datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    except Exception as e:
        logger.error(f"Error extrayendo fecha: {str(e)}")
        return datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')

def save_transcription_to_bigquery(client, transcription_result, dni, audio_path, file_name):
    """Guardar transcripción en BigQuery"""
    try:
        # Generar ID único
        timestamp_str = datetime.utcnow().isoformat()
        id_string = f"{dni}-{timestamp_str}"
        transcripcion_id = hashlib.md5(id_string.encode()).hexdigest()
        
        table_id = f"{PROJECT_ID}.{DATASET_ID}.transcripciones"
        
        # Extraer fecha del nombre del archivo
        fecha_llamada = extract_date_from_filename(file_name)
        
        rows_to_insert = [{
            "dni": dni,
            "fecha_llamada": fecha_llamada,
            "audio_url": audio_path,
            "transcripcion_texto": transcription_result.get('text', ''),
            "transcripcion_json": json.dumps(transcription_result.get('full_response', {})),
            "duracion_segundos": int(transcription_result.get('duration', 0)),
            "confianza_promedio": transcription_result.get('confidence', 0.0),
            "proveedor": "deepgram",
            "estado": "procesado",
            "costo_deepgram_usd": transcription_result.get('cost_usd', 0.0),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }]
        
        errors = client.insert_rows_json(table_id, rows_to_insert)
        if errors:
            logger.error(f"Error inserting transcription: {errors}")
            return None
        else:
            logger.info(f"✅ Transcripción guardada: {dni} (ID: {transcripcion_id})")
            return transcripcion_id
            
    except Exception as e:
        logger.error(f"❌ Error guardando en BigQuery: {str(e)}")
        return None

def trigger_quality_analysis(transcripcion_id, dni, transcription_text):
    """Llamar a la función de análisis de calidad después de completar la transcripción"""
    try:
        payload = {
            "dni": dni,
            "transcription": transcription_text,
            "transcripcion_id": transcripcion_id
        }
        
        logger.info(f"📊 Iniciando análisis de calidad para {dni}")
        
        response = requests.post(
            ANALYSIS_URL,
            json=payload,
            timeout=300  # 5 minutos timeout
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success', False):
                logger.info(f"✅ Análisis exitoso para {dni}")
                return True
            else:
                logger.error(f"❌ Error en análisis {dni}: {result.get('error', 'Unknown')}")
                return False
        else:
            logger.error(f"❌ HTTP {response.status_code} análisis para {dni}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Excepción llamando análisis {dni}: {str(e)}")
        return False