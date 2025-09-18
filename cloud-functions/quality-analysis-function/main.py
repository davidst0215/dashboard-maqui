"""
Cloud Function de Prueba - Procesamiento de Calidad de Llamadas
Procesa un audio específico usando Deepgram + OpenAI y guarda en BigQuery
"""
import functions_framework
import os
import json
import logging
from google.cloud import bigquery, storage, secretmanager
from deepgram import DeepgramClient, PrerecordedOptions
from openai import OpenAI
from datetime import datetime, timedelta
import requests

# Configuración
PROJECT_ID = "peak-emitter-350713"
DATASET_ID = "Calidad_Llamadas"
BUCKET_PIPELINE = "maqui-pipeline-transcripciones"
BUCKET_AUDIOS = "buckets_llamadas"

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def json_datetime_handler(obj):
    """JSON serializer function that handles datetime objects"""
    if hasattr(obj, 'isoformat'):
        return obj.isoformat()
    return str(obj)

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

@functions_framework.http
def analyze_quality(request):
    """
    Analiza transcripciones de calidad
    Puede recibir parámetros específicos o procesar transcripciones pendientes
    """
    try:
        bigquery_client = bigquery.Client(project=PROJECT_ID)

        # Verificar si se recibieron parámetros específicos
        request_json = request.get_json() if request else None

        if request_json and all(key in request_json for key in ['dni', 'transcription']):
            # Modo específico: analizar transcripción específica
            dni = request_json['dni']
            transcription_text = request_json['transcription']
            transcripcion_id = request_json.get('transcripcion_id')

            logger.info(f"📊 Analizando transcripción específica para DNI: {dni}")

            # Obtener fecha de llamada desde la transcripción o usar actual
            fecha_llamada = get_fecha_from_transcription(bigquery_client, dni, transcripcion_id)

            # Obtener datos de validación
            validation_data = get_validation_data(bigquery_client, dni, fecha_llamada)

            # Analizar con OpenAI
            analysis_result = analyze_quality_with_openai(
                transcription_text, dni, fecha_llamada, validation_data
            )

            if analysis_result['success']:
                # Guardar análisis
                save_analysis_to_bigquery(
                    bigquery_client, analysis_result, dni, fecha_llamada, transcripcion_id
                )
                logger.info(f"✅ Análisis específico completado: {dni} - {analysis_result.get('categoria', 'N/A')}")

                return {
                    "success": True,
                    "dni": dni,
                    "categoria": analysis_result.get('categoria'),
                    "puntuacion_total": analysis_result.get('puntuacion_total'),
                    "conformidad": analysis_result.get('conformidad'),
                    "message": f"Análisis completado para {dni}"
                }
            else:
                logger.error(f"❌ Error analizando {dni}: {analysis_result.get('error', 'Unknown')}")
                return {"error": f"Error analyzing {dni}: {analysis_result.get('error')}"}, 500

        else:
            # Modo automático: procesar transcripciones pendientes
            pending_transcriptions = get_pending_transcriptions(bigquery_client)
            logger.info(f"📊 Analizando {len(pending_transcriptions)} transcripciones pendientes")

            processed_count = 0
            for transcription in pending_transcriptions:
                try:
                    # Obtener datos de validación
                    validation_data = get_validation_data(
                        bigquery_client,
                        transcription['dni'],
                        transcription['fecha_llamada']
                    )

                    # Analizar con OpenAI
                    analysis_result = analyze_quality_with_openai(
                        transcription['transcripcion_texto'],
                        transcription['dni'],
                        transcription['fecha_llamada'],
                        validation_data
                    )

                    if analysis_result['success']:
                        # Guardar análisis
                        save_analysis_to_bigquery(
                            bigquery_client,
                            analysis_result,
                            transcription['dni'],
                            transcription['fecha_llamada'],
                            transcription.get('transcripcion_id', None)
                        )
                        processed_count += 1
                        logger.info(f"✅ Análisis completado: {transcription['dni']} - {analysis_result.get('categoria', 'N/A')}")
                    else:
                        logger.error(f"❌ Error analizando {transcription['dni']}: {analysis_result.get('error', 'Unknown')}")

                except Exception as e:
                    logger.error(f"❌ Error procesando transcripción {transcription.get('dni', 'unknown')}: {str(e)}")
                    continue

            return {
                "success": True,
                "processed": processed_count,
                "total_found": len(pending_transcriptions),
                "message": f"Análisis completado: {processed_count}/{len(pending_transcriptions)}"
            }

    except Exception as e:
        logger.error(f"❌ Error en análisis de calidad: {str(e)}")
        return {"error": str(e)}, 500

def get_fecha_from_transcription(client, dni, transcripcion_id=None):
    """Obtener fecha de llamada desde la transcripción"""
    try:
        if transcripcion_id:
            # Buscar por transcripcion_id si está disponible
            query = f"""
            SELECT fecha_llamada
            FROM `{PROJECT_ID}.{DATASET_ID}.transcripciones`
            WHERE dni = '{dni}'
            ORDER BY created_at DESC
            LIMIT 1
            """
        else:
            # Buscar la más reciente para el DNI
            query = f"""
            SELECT fecha_llamada
            FROM `{PROJECT_ID}.{DATASET_ID}.transcripciones`
            WHERE dni = '{dni}'
            ORDER BY created_at DESC
            LIMIT 1
            """

        result = list(client.query(query).result())
        if result:
            return result[0].fecha_llamada
        else:
            # Fallback: usar fecha actual
            return datetime.utcnow().strftime('%Y-%m-%d')

    except Exception as e:
        logger.error(f"❌ Error obteniendo fecha: {str(e)}")
        return datetime.utcnow().strftime('%Y-%m-%d')

def get_pending_transcriptions(client):
    """Obtener transcripciones pendientes de análisis"""
    try:
        query = f"""
        SELECT
            t.dni,
            t.transcripcion_texto,
            t.audio_url,
            t.fecha_llamada,
            t.created_at
        FROM `{PROJECT_ID}.{DATASET_ID}.transcripciones` t
        LEFT JOIN `{PROJECT_ID}.{DATASET_ID}.analisis_calidad` a
          ON t.dni = a.dni AND DATE(t.fecha_llamada) = DATE(a.fecha_llamada)
        WHERE a.dni IS NULL
          AND t.transcripcion_texto IS NOT NULL
          AND LENGTH(t.transcripcion_texto) > 50
          AND t.estado = 'procesado'
        ORDER BY t.created_at DESC
        LIMIT 20
        """

        query_job = client.query(query)
        results = query_job.result()

        transcriptions = []
        for row in results:
            # Generar transcripcion_id único basado en audio_url (que es único)
            import hashlib
            audio_hash = hashlib.md5(row.audio_url.encode()).hexdigest()[:12]
            transcripcion_id = f"{row.dni}-{audio_hash}"

            transcriptions.append({
                "dni": row.dni,
                "transcripcion_texto": row.transcripcion_texto,
                "audio_url": row.audio_url,
                "fecha_llamada": row.fecha_llamada,
                "created_at": row.created_at,
                "transcripcion_id": transcripcion_id
            })

        return transcriptions

    except Exception as e:
        logger.error(f"❌ Error obteniendo transcripciones: {str(e)}")
        return []

def transcribe_with_deepgram(audio_path, dni, fecha_llamada):
    """Transcribir audio usando Deepgram"""
    try:
        # Intentar obtener desde variables de entorno o Secret Manager
        deepgram_api_key = os.environ.get('DEEPGRAM_API_KEY')
        if not deepgram_api_key:
            # En producción, usar Secret Manager
            deepgram_api_key = get_secret_value('deepgram-api-key')
            
        if not deepgram_api_key:
            return {"success": False, "error": "DEEPGRAM_API_KEY not configured"}
            
        # Configurar cliente Deepgram
        deepgram = DeepgramClient(deepgram_api_key)
        
        # Opciones de transcripción optimizadas para español
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
        
        # Si es una URL gs://, generar URL firmada
        if audio_path.startswith('gs://'):
            logger.info("🔗 Generando URL firmada para Deepgram...")
            signed_url = generate_signed_url(audio_path)
            if not signed_url:
                return {"success": False, "error": "Could not generate signed URL for audio"}
            transcribe_url = signed_url
        else:
            transcribe_url = audio_path
        
        # Transcribir audio desde URL firmada
        response = deepgram.listen.prerecorded.v("1").transcribe_url({
            "url": transcribe_url
        }, options)
        
        # Procesar respuesta
        if response and hasattr(response, "results") and response.results:
            channels = response.results.channels
            if channels and len(channels) > 0:
                alternatives = channels[0].alternatives
                if alternatives and len(alternatives) > 0:
                    transcript = alternatives[0].transcript
                    confidence = alternatives[0].confidence
                    
                    # Calcular duración y costo aproximado
                    duration = response.metadata.duration if response.metadata else 0
                    cost_usd = duration / 60.0 * 0.005  # $0.005 por minuto
                    
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
        logger.error(f"❌ Error Deepgram transcription: {str(e)}")
        return {"success": False, "error": str(e)}

def generate_signed_url(gs_path):
    """Generar URL firmada para acceso público temporal usando cuenta de servicio específica"""
    try:
        # Extraer bucket y blob del path gs://
        parts = gs_path.replace('gs://', '').split('/')
        bucket_name = parts[0]
        blob_path = '/'.join(parts[1:])
        
        # Intentar obtener credenciales de cuenta de servicio desde Secret Manager
        try:
            import json
            from google.oauth2 import service_account
            
            # Obtener credenciales desde Secret Manager
            credentials_json = get_secret_value('deepgram-signer-credentials')
            if credentials_json:
                logger.info("🔑 Usando cuenta de servicio específica para firmar URLs")
                credentials_info = json.loads(credentials_json)
                credentials = service_account.Credentials.from_service_account_info(credentials_info)
                
                # Crear cliente de storage con las credenciales específicas
                storage_client = storage.Client(project=PROJECT_ID, credentials=credentials)
                bucket = storage_client.bucket(bucket_name)
                blob = bucket.blob(blob_path)
                
                # Generar URL firmada
                signed_url = blob.generate_signed_url(
                    version='v4',
                    expiration=datetime.utcnow() + timedelta(hours=2),
                    method='GET'
                )
                logger.info("✅ URL firmada generada exitosamente con cuenta de servicio")
                return signed_url
                
        except Exception as credentials_error:
            logger.warning(f"⚠️ Error usando cuenta de servicio específica: {str(credentials_error)}")
        
        # Fallback: usar cliente de storage por defecto
        logger.info("🔄 Intentando con cliente de storage por defecto...")
        storage_client = storage.Client(project=PROJECT_ID)
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_path)
        
        # Intentar generar URL firmada con diferentes métodos
        try:
            # Método 1: URL firmada estándar (requiere clave privada)
            signed_url = blob.generate_signed_url(
                version='v4',
                expiration=datetime.utcnow() + timedelta(hours=2),
                method='GET'
            )
            logger.info("✅ URL firmada generada exitosamente (método estándar)")
            return signed_url
            
        except Exception as signing_error:
            logger.warning(f"⚠️ No se pudo generar URL firmada: {str(signing_error)}")
            
            # Método 2: Verificar si el blob es públicamente accesible
            try:
                # Construir URL pública directa
                public_url = f"https://storage.googleapis.com/{bucket_name}/{blob_path}"
                
                # Verificar si el archivo es accesible públicamente
                import requests
                response = requests.head(public_url, timeout=10)
                
                if response.status_code == 200:
                    logger.info("✅ URL pública directa disponible")
                    return public_url
                else:
                    logger.warning(f"⚠️ Archivo no es público: HTTP {response.status_code}")
                    
            except Exception as public_error:
                logger.warning(f"⚠️ Error verificando acceso público: {str(public_error)}")
            
            # Método 3: Fallback - usar URL gs:// directamente (Deepgram podría soportarlo)
            logger.info("🔄 Usando URL gs:// como fallback")
            return gs_path
        
    except Exception as e:
        logger.error(f"❌ Error crítico generando URL: {str(e)}")
        return None

def get_validation_data(bigquery_client, dni, fecha_llamada):
    """Obtener datos de validación previa desde BigQuery con formato correcto de DNI"""
    try:
        logger.info(f"🔍 Consultando datos de validación previa para DNI: {dni}")
        
        # Formatear DNI con ceros a la izquierda (formato de 9 dígitos)
        dni_formatted = dni.zfill(9)
        
        query = f"""
        SELECT 
            TipoNoConfVal1,
            NumeroDocumento,
            FechaHoraVal1,
            Vendedor,
            Supervisor,
            Gestor,
            Nombre
        FROM `{PROJECT_ID}.FR_Admision.Validacion_Ventas`
        WHERE TRIM(NumeroDocumento) = '{dni_formatted}'
        OR TRIM(NumeroDocumento) = '{dni}'
        OR (LENGTH(TRIM(NumeroDocumento)) > 0 
            AND REGEXP_CONTAINS(TRIM(NumeroDocumento), r'^[0-9]+$')
            AND CAST(CAST(TRIM(NumeroDocumento) AS NUMERIC) AS STRING) = '{dni}')
        ORDER BY FechaHoraVal1 DESC
        LIMIT 1
        """
        
        query_job = bigquery_client.query(query)
        results = query_job.result()
        
        validation_data = None
        for row in results:
            validation_data = {
                "tipo_no_conf_val1": row.TipoNoConfVal1 or "Sin datos",
                "numero_documento": row.NumeroDocumento,
                "vendedor": row.Vendedor or "Sin datos",
                "supervisor": row.Supervisor or "Sin datos", 
                "gestor": row.Gestor or "Sin datos",
                "nombre": row.Nombre or "Sin datos",
                "fecha_validacion": row.FechaHoraVal1
            }
            break
        
        if validation_data and validation_data["tipo_no_conf_val1"] != "Sin datos":
            logger.info(f"✅ Validación encontrada - Tipo: {validation_data['tipo_no_conf_val1']}, DNI: {validation_data['numero_documento']}")
            return validation_data
        else:
            logger.warning(f"⚠️ No se encontró validación previa para DNI: {dni} (buscado como {dni_formatted})")
            return {"tipo_no_conf_val1": "Sin datos", "numero_documento": dni, "vendedor": "Sin datos", "supervisor": "Sin datos", "gestor": "Sin datos", "nombre": "Sin datos"}
            
    except Exception as e:
        logger.error(f"❌ Error consultando validación previa: {str(e)}")
        return {"tipo_no_conf_val1": "Error", "numero_documento": dni, "vendedor": "Error", "supervisor": "Error", "gestor": "Error", "nombre": "Error"}

def clean_transcript(text):
    """Limpiar transcripción para mejorar calidad de análisis"""
    if not text:
        return text
    
    # Reemplazar caracteres problemáticos comunes
    replacements = {
        '�': 'ñ',  # Muy común en transcripciones
        'Al�': 'Aló',
        'Qu�': 'Qué', 
        'c�mo': 'cómo',
        'est�': 'está',
        'S�': 'Sí',
        'Aj�': 'Ajá',
        'se�or': 'señor',
        'tambi�n': 'también',
        'adi�s': 'adiós',
        'despu�s': 'después',
        'informaci�n': 'información'
    }
    
    cleaned = text
    for old, new in replacements.items():
        cleaned = cleaned.replace(old, new)
    
    # Limpiar espacios múltiples
    import re
    cleaned = re.sub(r'\s+', ' ', cleaned)
    cleaned = cleaned.strip()
    
    return cleaned

def analyze_quality_with_openai(transcript_text, dni, fecha_llamada, validation_data=None):
    """Analizar calidad de llamada con OpenAI"""
    try:
        # Limpiar transcripción antes del análisis
        cleaned_transcript = clean_transcript(transcript_text)
        logger.info(f"Transcripción limpiada: {len(cleaned_transcript)} chars vs {len(transcript_text)} chars originales")
        # Intentar obtener desde variables de entorno o Secret Manager
        openai_api_key = os.environ.get('OPENAI_API_KEY')
        if not openai_api_key:
            # En producción, usar Secret Manager
            openai_api_key = get_secret_value('openai-api-key')
            
        if not openai_api_key:
            return {"success": False, "error": "OPENAI_API_KEY not configured"}
            
        # Obtener contexto de validación
        if not validation_data:
            validation_data = {"tipo_no_conf_val1": "Sin datos", "nombre": "Sin datos"}
        
        tipo_validacion = validation_data.get("tipo_no_conf_val1", "Sin datos")
        nombre_cliente = validation_data.get("nombre", "Sin datos")
        
        # Inferir producto desde el DNI o usar default (podríamos mejorarlo consultando otra tabla)
        producto = "AUTOPRONTO"  # Default, se podría mejorar
        
        # Determinar contexto específico según validación previa
        contexto_prioritario = ""
        criterio_critico_extra = ""
        
        if "Adj.con nro. de cuotas" in tipo_validacion or "Adj.Inmediata" in tipo_validacion:
            contexto_prioritario = """
            🚨 CONTEXTO PRIORITARIO: El cliente tuvo una validación previa con problemas de comprensión sobre adjudicación (""" + tipo_validacion + """). 
            Es CRÍTICO verificar que el agente corrija específicamente estos malentendidos sobre:
            - NO existe adjudicación inmediata garantizada
            - NO existe adjudicación por número fijo de cuotas
            - La adjudicación depende de GANAR sorteo/remate
            """
            criterio_critico_extra = "EXTRA CRÍTICO para este caso: El agente debe corregir explícitamente la creencia errónea del cliente sobre adjudicación inmediata/garantizada."
        
        # Para casos no críticos, NO aplicar contexto prioritario - evaluación normal
        elif tipo_validacion in ["No me explicaron bien", "No Contesta/Contesta tercero", "No es el Nro Telefonico", "Otros"]:
            contexto_prioritario = f"""
            ℹ️ CONTEXTO INFORMATIVO: Validación previa registrada como '{tipo_validacion}'.
            Esta es una llamada de seguimiento. EVALUAR CON CRITERIOS NORMALES - sin penalizaciones extra.
            """
        
        # Determinar script específico según producto
        if "AUTOPRONTO" in producto.upper():
            script_producto = """
            SCRIPT ESPERADO PARA AUTOPRONTO:
            - Saludo: "Buenos días [Nombre], soy [Nombre] de Atención al Cliente de Maquisistema"
            - Propósito: Verificación de depósito y comprensión del sistema
            - Explicación obligatoria: "Las alternativas de adjudicación son: Sorteo, remate y en fecha determinada"
            - Sorteo: "Se realiza en asambleas 1, 5, 10, 15 y 20. Todos tienen la misma probabilidad"
            - Remate: "Completar 24 cuotas (24 menos el mes de avance)"
            - Fecha determinada: "Asamblea 24, todos los asociados al día adjudican automáticamente"
            """
        else:
            script_producto = """
            SCRIPT ESPERADO PARA M/C/A:
            - Saludo: "Buenos días [Nombre], soy [Nombre] de Atención al Cliente de Maquisistema"  
            - Propósito: Verificación de depósito y comprensión del sistema
            - Explicación obligatoria: "Las alternativas de adjudicación son: sorteo y remate"
            - Sorteo: "Cada asociado del grupo cuenta con posibilidad de ganar"
            - Remate: "Oferta voluntaria de adelanto de cuotas. Propuestas secretas y encriptadas"
            - Aclaración crítica: "NADIE le asegura adjudicación con número determinado de cuotas"
            """
        
        # PROMPT BINARIO PREMIUM CONTEXTUALIZADO
        prompt = f"""
        Eres un analista experto senior en control de calidad para call center de fondos colectivos de Maquisistema. 
        
        {contexto_prioritario}
        
        INFORMACIÓN DEL CLIENTE:
        - DNI: {dni}
        - Producto: {producto}
        - Validación previa: {tipo_validacion}
        - Fecha: {fecha_llamada}
        
        {script_producto}
        
        CRITERIOS DE EVALUACIÓN (Responde SOLO con 1 para SÍ CUMPLE o 0 para NO CUMPLE):

        1. `punto_1_identidad`: ¿El agente dice EXPLÍCITAMENTE su nombre Y la palabra exacta "Maquisistema"?
           EJEMPLOS QUE CUMPLEN: "Soy Juan de Maquisistema", "Mi nombre es Ana, de Maquisistema", "Le habla Carlos de Maquisistema"  
           NO CUMPLE: Si dice "Maquicistems", "Máxima", "oficina de" u otras variaciones - DEBE ser "Maquisistema" EXACTO

        2. `punto_2_terminos`: ¿El agente verifica información específica del contrato del cliente?
           EJEMPLOS QUE CUMPLEN: Confirma montos, cuotas, planes, depósitos, modalidades
           NO CUMPLE: Conversación general sin verificar datos específicos

        3. `punto_3_ganar`: ¿El agente explica que NADIE le puede asegurar la adjudicación y que debe GANAR el sorteo o remate?
           EJEMPLOS QUE CUMPLEN: "nadie le asegura", "debe ganar el sorteo", "debe ganar el remate", "no hay garantía de adjudicación", "depende de ganar"
           NO CUMPLE: Si sugiere adjudicación garantizada o asegurada

        4. `punto_4_dudas`: ¿El agente pregunta si el cliente tiene dudas o si entendió?
           EJEMPLOS QUE CUMPLEN: "¿alguna duda?", "¿le queda claro?", "¿tiene claro el proceso?"
           NO CUMPLE: No pregunta por comprensión o dudas

        5. `punto_5_pasos`: ¿El agente dice EXACTAMENTE qué debe hacer el cliente AHORA o próximamente?
           EJEMPLOS QUE CUMPLEN: "debe pagar del 1-17", "vaya a oficinas", "llame mañana", "desde mañana puede empezar"
           NO CUMPLE: Solo explica conceptos generales o modalidades abstractas

        EVALUACIÓN CONTEXTUAL:
        - SOLO para casos CRÍTICOS (Adj.Inmediata, Adj.con nro. cuotas): Si el agente NO corrige explícitamente estos malentendidos → automáticamente "NO CONFORME"
        - Para casos NORMALES (No Contesta/Contesta tercero, No es el Nro Telefonico, No me explicaron bien, Otros) → evaluar con criterios estándar sin penalización extra
        - Para adjudicación inmediata/garantizada mencionada por cliente → automáticamente "NO CONFORME" si no se corrige

        COMENTARIOS:
        - `evaluacion_general`: "CONFORME" (llamada profesional sin problemas graves) o "NO CONFORME" (solo si hubo cortes, malos tratos, o errores serios)
        - `resumen_ejecutivo`: Comentario que incluya: Validación previa ({tipo_validacion}), fortalezas de la llamada, áreas de mejora, y calidad del trato

        FORMATO DE RESPUESTA:
        {{
            "punto_1_identidad": 0 o 1,
            "punto_2_terminos": 0 o 1,
            "punto_3_ganar": 0 o 1,
            "punto_4_dudas": 0 o 1,
            "punto_5_pasos": 0 o 1,
            "evaluacion_general": "CONFORME" o "NO CONFORME",
            "resumen_ejecutivo": "texto breve mencionando validación previa"
        }}

        TRANSCRIPCIÓN A ANALIZAR:
        {cleaned_transcript}
        """
        
        logger.info(f"🤖 Iniciando análisis PREMIUM GPT-4 Turbo para DNI: {dni}")
        logger.info(f"📊 Longitud de transcripción: {len(transcript_text)} caracteres")
        
        client = OpenAI(api_key=openai_api_key)
        
        response = client.chat.completions.create(
            model="gpt-4-turbo",  # 🎯 MODELO MÁS CONSISTENTE PARA ANÁLISIS
            messages=[
                {
                    "role": "system", 
                    "content": "Eres un evaluador de calidad para call centers. REGLAS CRÍTICAS: 1) Evalúa SOLO basado en los ejemplos específicos dados, 2) NO interpretes - si no coincide exactamente con los ejemplos, marca 0, 3) Sé ULTRA-CONSISTENTE: mismo texto = misma evaluación SIEMPRE, 4) Responde SOLO en JSON válido."
                },
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},  # 🎯 FUERZA RESPUESTA JSON VÁLIDA
            temperature=0.0,  # 🎯 MÁXIMA CONSISTENCIA (0 = determinístico)
            max_tokens=1000   # 🎯 MÁS ESPACIO PARA ANÁLISIS DETALLADO
        )
        
        # Procesar respuesta JSON (GPT-4o con response_format garantiza JSON válido)
        content = response.choices[0].message.content.strip()
        
        # Parsear respuesta binaria
        try:
            binary_data = json.loads(content)
            
            # Convertir sistema binario a formato compatible con dashboard
            puntos_cumplidos = sum([
                binary_data.get("punto_1_identidad", 0),
                binary_data.get("punto_2_terminos", 0),
                binary_data.get("punto_3_ganar", 0),
                binary_data.get("punto_4_dudas", 0),
                binary_data.get("punto_5_pasos", 0)
            ])
            
            # Categorización basada en puntos cumplidos
            if puntos_cumplidos == 5 and binary_data.get("punto_3_ganar", 0) == 1:
                categoria = "MUY BUENA"
                puntuacion_total = 100
            elif puntos_cumplidos >= 4:
                categoria = "BUENA"
                puntuacion_total = 80
            elif puntos_cumplidos >= 3:
                categoria = "MEDIA"
                puntuacion_total = 60
            else:
                categoria = "MALA"
                puntuacion_total = 40
                
            # Conformidad basada ÚNICAMENTE en puntos cumplidos (≥ 3)
            # No permitir que evaluacion_general override esta lógica
            punto_critico = binary_data.get("punto_3_ganar", 0)
            conformidad = "Conforme" if puntos_cumplidos >= 3 else "No Conforme"
            
            # NOTA: evaluacion_general ya no determina conformidad, solo para comentarios internos
            
            # Crear estructura completa de comentarios JSON
            comentarios_estructurados = {
                "resumen_ejecutivo": binary_data.get("resumen_ejecutivo", "Análisis completado"),
                "evaluacion_general": binary_data.get("evaluacion_general", "CONFORME"),
                "puntos_evaluacion": {
                    "identidad": {
                        "valor": binary_data.get("punto_1_identidad", 0),
                        "descripcion": "Agente se presenta con nombre y dice 'Maquisistema'"
                    },
                    "terminos": {
                        "valor": binary_data.get("punto_2_terminos", 0),
                        "descripcion": "Verifica información específica del contrato"
                    },
                    "ganar": {
                        "valor": binary_data.get("punto_3_ganar", 0),
                        "descripcion": "Explica competencia en remate"
                    },
                    "dudas": {
                        "valor": binary_data.get("punto_4_dudas", 0),
                        "descripcion": "Consulta dudas del cliente"
                    },
                    "pasos": {
                        "valor": binary_data.get("punto_5_pasos", 0),
                        "descripcion": "Explica próximos pasos del proceso"
                    }
                },
                "analisis_sistema": {
                    "total_puntos": puntuacion_total,
                    "puntos_cumplidos": puntos_cumplidos,
                    "es_critico": punto_critico,
                    "validacion_previa": tipo_validacion,
                    "contexto_aplicado": tipo_validacion in ["Adj.Inmediata", "Adj.con nro. de cuotas"]
                },
                "datos_validacion": validation_data,
                "timestamp_analisis": datetime.utcnow().isoformat()
            }
            
            analysis_data = {
                "categoria": categoria,
                "conformidad": conformidad,
                "puntuacion_total": puntuacion_total,
                # VALORES BINARIOS (0 o 1) - NO multiplicar por 10
                "punto_1_identidad": binary_data.get("punto_1_identidad", 0),
                "punto_2_terminos": binary_data.get("punto_2_terminos", 0),
                "punto_3_ganar": binary_data.get("punto_3_ganar", 0),
                "punto_4_dudas": binary_data.get("punto_4_dudas", 0),
                "punto_5_pasos": binary_data.get("punto_5_pasos", 0),
                "comentarios": binary_data.get("resumen_ejecutivo", "Análisis completado - sin comentarios específicos"),
                "justificacion": f"Sistema binario: {puntos_cumplidos}/5 puntos. Crítico: {'SÍ' if punto_critico else 'NO'}. Validación previa: {tipo_validacion}",
                "validacion_previa": validation_data,  # Incluir datos de validación completos
                "contexto_aplicado": tipo_validacion in ["Adj.Inmediata", "Adj.con nro. de cuotas"]  # Solo contexto crítico
            }
            
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing JSON from GPT-4o: {e}")
            
            # Crear estructura de error JSON para comentarios
            comentarios_error = {
                "resumen_ejecutivo": "Error en análisis de IA - respuesta no válida",
                "evaluacion_general": "ERROR",
                "error_detalles": {
                    "tipo": "JSON_DECODE_ERROR",
                    "mensaje": str(e),
                    "timestamp": datetime.utcnow().isoformat()
                },
                "analisis_sistema": {
                    "total_puntos": 0,
                    "puntos_cumplidos": 0,
                    "es_critico": False,
                    "validacion_previa": validation_data.get("tipo_no_conf_val1", "Unknown"),
                    "contexto_aplicado": False
                }
            }
            
            analysis_data = {
                "categoria": "MALA",
                "conformidad": "No Conforme",
                "puntuacion_total": 0,
                "comentarios": json.dumps(comentarios_error, ensure_ascii=False, indent=2, default=json_datetime_handler),
                "error": f"JSON parse error: {str(e)}"
            }
        
        # Calcular costo para GPT-4o (tarifas premium)
        prompt_tokens = response.usage.prompt_tokens
        completion_tokens = response.usage.completion_tokens
        # GPT-4o: $0.005 per 1K prompt tokens, $0.015 per 1K completion tokens
        cost_usd = (prompt_tokens * 0.005 + completion_tokens * 0.015) / 1000
        
        logger.info(f"✅ Análisis GPT-4o exitoso - Categoría: {analysis_data.get('categoria', 'N/A')}")
        logger.info(f"💰 Costo análisis: ${cost_usd:.4f} USD (Tokens: {prompt_tokens}p + {completion_tokens}c)")
        logger.info(f"🎯 Puntos cumplidos: {puntos_cumplidos}/5 - Crítico: {'✅' if punto_critico else '❌'}")
        
        return {
            "success": True,
            "cost_usd": cost_usd,
            "tokens_prompt": prompt_tokens,
            "tokens_completion": completion_tokens,
            **analysis_data
        }
        
    except Exception as e:
        logger.error(f"❌ Error OpenAI analysis: {str(e)}")
        return {"success": False, "error": str(e)}

def save_transcription_to_bigquery(client, transcription_result, dni, fecha_llamada, audio_path):
    """Guardar transcripción en BigQuery y retornar ID único"""
    try:
        import hashlib
        
        # Generar ID único basado en DNI + fecha + timestamp actual
        # Esto asegura unicidad sin necesidad de modificar el schema de la tabla
        timestamp_str = datetime.utcnow().isoformat()
        id_string = f"{dni}-{fecha_llamada}-{timestamp_str}"
        transcripcion_id = hashlib.md5(id_string.encode()).hexdigest()
        
        table_id = f"{PROJECT_ID}.{DATASET_ID}.transcripciones"
        
        # Convertir fecha a formato timestamp para BigQuery
        if isinstance(fecha_llamada, str):
            fecha_timestamp = f"{fecha_llamada} 00:00:00"
        else:
            fecha_timestamp = fecha_llamada
        
        rows_to_insert = [{
            "dni": dni,
            "fecha_llamada": fecha_timestamp,
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
            logger.info(f"✅ Transcripción guardada en BigQuery: {dni} (ID: {transcripcion_id})")
            return transcripcion_id
            
    except Exception as e:
        logger.error(f"❌ Error saving transcription to BigQuery: {str(e)}")
        return None

def clean_analysis_for_json(analysis_data):
    """Limpiar datos de análisis para serialización JSON"""
    import copy
    from datetime import datetime, date

    def clean_recursive(obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        elif isinstance(obj, dict):
            return {k: clean_recursive(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [clean_recursive(item) for item in obj]
        else:
            return obj

    return clean_recursive(analysis_data)

def save_analysis_to_bigquery(client, analysis_result, dni, fecha_llamada, transcripcion_id):
    """Guardar análisis en BigQuery con transcripcion_id"""
    try:
        table_id = f"{PROJECT_ID}.{DATASET_ID}.analisis_calidad"

        # Convertir fecha a formato timestamp para BigQuery
        if isinstance(fecha_llamada, str):
            fecha_timestamp = f"{fecha_llamada} 00:00:00"
        else:
            fecha_timestamp = fecha_llamada.isoformat() if hasattr(fecha_llamada, 'isoformat') else str(fecha_llamada)

        # Limpiar analysis_result para JSON
        clean_analysis = clean_analysis_for_json(analysis_result)
        
        # DEBUG: Imprimir datos recibidos de OpenAI
        logger.info(f"🔍 DEBUG SAVE - analysis_result keys: {list(analysis_result.keys())}")
        logger.info(f"🔍 DEBUG SAVE - transcripcion_id recibido: {transcripcion_id}")
        logger.info(f"🔍 DEBUG SAVE - analysis_result completo: {analysis_result}")

        # MAPEO CORRECTO DE LOS 5 CRITERIOS BINARIOS (0 o 1)
        punto_1 = float(analysis_result.get('punto_1_identidad', 0))  # 0 o 1
        punto_2 = float(analysis_result.get('punto_2_terminos', 0))   # 0 o 1
        punto_3 = float(analysis_result.get('punto_3_ganar', 0))      # 0 o 1
        punto_4 = float(analysis_result.get('punto_4_dudas', 0))      # 0 o 1
        punto_5 = float(analysis_result.get('punto_5_pasos', 0))      # 0 o 1

        # DEBUG: Imprimir puntuaciones extraídas
        logger.info(f"🔍 DEBUG SAVE - Puntuaciones: P1:{punto_1}, P2:{punto_2}, P3:{punto_3}, P4:{punto_4}, P5:{punto_5}")

        # Calcular puntuación total como decimal para compatibilidad con frontend (0.0-1.0)
        puntos_total = punto_1 + punto_2 + punto_3 + punto_4 + punto_5  # 0-5
        puntuacion_decimal = puntos_total / 5.0  # Convertir a 0.0-1.0

        logger.info(f"🔍 DEBUG SAVE - Puntos total: {puntos_total}, Decimal: {puntuacion_decimal}")
        logger.info(f"🔍 DEBUG SAVE - Guardando con transcripcion_id: {transcripcion_id}")

        rows_to_insert = [{
            "dni": str(dni),
            "fecha_llamada": fecha_timestamp,
            "transcripcion_id": str(transcripcion_id) if transcripcion_id else None,
            "categoria": str(analysis_result.get('categoria', 'PENDIENTE')),
            "puntuacion_total": puntuacion_decimal,  # Como decimal para frontend

            # MAPEO CORRECTO DE LOS 5 CRITERIOS:
            "puntuacion_identificacion": punto_1,        # Criterio 1: Identidad
            "puntuacion_verificacion": punto_2,          # Criterio 2: Verificación
            "puntuacion_contextualizacion": punto_3,     # Criterio 3: Adjudicación (CRÍTICO)
            "puntuacion_consulta_dudas": punto_4,        # Criterio 4: Consulta dudas
            "puntuacion_sentimientos": punto_5,          # Criterio 5: Siguientes pasos

            "conformidad": str(analysis_result.get('conformidad', 'PENDIENTE')),
            "comentarios": str(analysis_result.get('comentarios', '')),
            "analisis_detallado": json.dumps(clean_analysis, ensure_ascii=False, default=str),
            "modelo_openai": "gpt-4-turbo",
            "tokens_prompt": int(analysis_result.get('tokens_prompt', 0)),
            "tokens_completion": int(analysis_result.get('tokens_completion', 0)),
            "costo_openai_usd": float(analysis_result.get('cost_usd', 0.0)),
            "estado": "completado",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }]
        
        errors = client.insert_rows_json(table_id, rows_to_insert)
        if errors:
            logger.error(f"Error inserting analysis: {errors}")
        else:
            logger.info(f"✅ Análisis guardado en BigQuery: {dni}")
            
    except Exception as e:
        logger.error(f"❌ Error saving analysis to BigQuery: {str(e)}")

def update_pipeline_metrics(client, transcription_result, analysis_result):
    """Actualizar métricas del pipeline"""
    try:
        # Aquí actualizaríamos las métricas diarias
        # Por simplicidad, solo logueamos por ahora
        logger.info(f"📊 Métricas actualizadas - Deepgram: ${transcription_result.get('cost_usd', 0):.4f}, OpenAI: ${analysis_result.get('cost_usd', 0):.4f}")
    except Exception as e:
        logger.error(f"❌ Error updating metrics: {str(e)}")

# Alias for Cloud Functions entry point  
main = analyze_quality