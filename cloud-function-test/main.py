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
def process_audio_quality(request):
    """
    Procesa un audio específico para análisis de calidad
    Payload: {"dni": "12345678", "fecha_llamada": "2024-01-01", "audio_path": "gs://..."}
    """
    try:
        # Obtener parámetros
        request_json = request.get_json()
        if not request_json:
            return {"error": "No JSON payload provided"}, 400
            
        dni = request_json.get('dni')
        fecha_llamada = request_json.get('fecha_llamada')
        audio_path = request_json.get('audio_path')
        
        if not all([dni, fecha_llamada, audio_path]):
            return {"error": "Missing required fields: dni, fecha_llamada, audio_path"}, 400
            
        logger.info(f"🎯 Procesando audio: {dni} - {fecha_llamada}")
        
        # Inicializar clientes
        bigquery_client = bigquery.Client(project=PROJECT_ID)
        storage_client = storage.Client(project=PROJECT_ID)
        
        # Paso 1: Transcribir con Deepgram
        transcription_result = transcribe_with_deepgram(audio_path, dni, fecha_llamada)
        
        if not transcription_result['success']:
            return {"error": f"Transcription failed: {transcription_result['error']}"}, 500
            
        # Paso 2: Guardar transcripción en BigQuery y obtener ID único
        transcripcion_id = save_transcription_to_bigquery(bigquery_client, transcription_result, dni, fecha_llamada, audio_path)
        if not transcripcion_id:
            return {"error": "Failed to save transcription"}, 500
        
        # Paso 3: Obtener datos de validación previa
        validation_data = get_validation_data(bigquery_client, dni, fecha_llamada)
        
        # Paso 4: Analizar calidad con OpenAI (incluyendo contexto de validación)
        analysis_result = analyze_quality_with_openai(transcription_result['text'], dni, fecha_llamada, validation_data)
        
        if not analysis_result['success']:
            return {"error": f"Analysis failed: {analysis_result['error']}"}, 500
            
        # Paso 5: Guardar análisis en BigQuery  
        save_analysis_to_bigquery(bigquery_client, analysis_result, dni, fecha_llamada, transcripcion_id)
        
        # Paso 6: Actualizar métricas
        update_pipeline_metrics(bigquery_client, transcription_result, analysis_result)
        
        logger.info(f"✅ Procesamiento completado: {dni}")
        
        return {
            "success": True,
            "dni": dni,
            "fecha_llamada": fecha_llamada,
            "transcription": {
                "duration": transcription_result.get('duration', 0),
                "confidence": transcription_result.get('confidence', 0)
            },
            "analysis": {
                "categoria": analysis_result.get('categoria', 'PENDIENTE'),
                "conformidad": analysis_result.get('conformidad', 'PENDIENTE'),
                "puntuacion_total": analysis_result.get('puntuacion_total', 0)
            },
            "costs": {
                "deepgram_usd": transcription_result.get('cost_usd', 0),
                "openai_usd": analysis_result.get('cost_usd', 0)
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Error procesando audio: {str(e)}")
        return {"error": str(e)}, 500

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

        3. `punto_3_ganar`: ¿El agente explica que en remate HAY COMPETENCIA con otros clientes?
           EJEMPLOS QUE CUMPLEN: "gana quien más adelante", "compite con otros", "mejor propuesta gana", "depende del fondo"
           NO CUMPLE: Solo menciona remate sin explicar competencia

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
                "puntuacion_identidad": binary_data.get("punto_1_identidad", 0) * 10,
                "puntuacion_terminos": binary_data.get("punto_2_terminos", 0) * 10,
                "puntuacion_claridad_ganar": binary_data.get("punto_3_ganar", 0) * 10,
                "puntuacion_consulta_dudas": binary_data.get("punto_4_dudas", 0) * 10,
                "puntuacion_siguientes_pasos": binary_data.get("punto_5_pasos", 0) * 10,
                "comentarios": json.dumps(comentarios_estructurados, ensure_ascii=False, indent=2),
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
                "comentarios": json.dumps(comentarios_error, ensure_ascii=False, indent=2),
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

def save_analysis_to_bigquery(client, analysis_result, dni, fecha_llamada, transcripcion_id):
    """Guardar análisis en BigQuery con transcripcion_id"""
    try:
        table_id = f"{PROJECT_ID}.{DATASET_ID}.analisis_calidad"
        
        # Convertir fecha a formato timestamp para BigQuery
        if isinstance(fecha_llamada, str):
            fecha_timestamp = f"{fecha_llamada} 00:00:00"
        else:
            fecha_timestamp = fecha_llamada
        
        rows_to_insert = [{
            "dni": dni,
            "fecha_llamada": fecha_timestamp,
            "transcripcion_id": transcripcion_id,
            "categoria": analysis_result.get('categoria', 'PENDIENTE'),
            "puntuacion_total": int(analysis_result.get('puntuacion_total', 0)),
            
            # ACTUALIZADO: Mapear nuevas puntuaciones específicas de los 5 criterios GPT-4o
            "puntuacion_identificacion": analysis_result.get('puntuacion_identidad', 0.0),
            "puntuacion_verificacion": analysis_result.get('puntuacion_terminos', 0.0), 
            "puntuacion_contextualizacion": analysis_result.get('puntuacion_claridad_ganar', 0.0),  # PUNTO CRÍTICO
            "puntuacion_sentimientos": analysis_result.get('puntuacion_siguientes_pasos', 0.0),  # Usar para "siguientes pasos"
            
            "conformidad": analysis_result.get('conformidad', 'PENDIENTE'),
            "comentarios": analysis_result.get('comentarios', ''),
            "analisis_detallado": json.dumps(analysis_result, default=str),
            "modelo_openai": "gpt-4o",
            "tokens_prompt": analysis_result.get('tokens_prompt', 0),
            "tokens_completion": analysis_result.get('tokens_completion', 0),
            "costo_openai_usd": analysis_result.get('cost_usd', 0.0),
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
main = process_audio_quality