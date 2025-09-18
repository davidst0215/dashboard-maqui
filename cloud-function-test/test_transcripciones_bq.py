#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test del sistema mejorado de análisis de calidad usando transcripciones reales de BigQuery
"""
import sys
import codecs

# Configurar encoding para Windows
if sys.platform == "win32":
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())
import os
import sys
import json
from google.cloud import bigquery, secretmanager
from unittest.mock import Mock
import time

# Configurar credenciales
credentials_path = os.path.join(os.path.dirname(__file__), '..', 'dashboard-backend', 'peak-emitter-350713-credentials.json')
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = credentials_path

PROJECT_ID = "peak-emitter-350713"
DATASET_ID = "Calidad_Llamadas"

def get_secret_value(secret_id, project_id=PROJECT_ID):
    """Obtener secreto desde Google Cloud Secret Manager"""
    try:
        client = secretmanager.SecretManagerServiceClient()
        name = f"projects/{project_id}/secrets/{secret_id}/versions/latest"
        response = client.access_secret_version(request={"name": name})
        return response.payload.data.decode("UTF-8").strip()
    except Exception as e:
        print(f"Error obteniendo secreto {secret_id}: {e}")
        return None

def get_transcripciones_sample():
    """Obtener muestra de transcripciones desde BigQuery"""
    try:
        client = bigquery.Client(project=PROJECT_ID)
        
        query = f"""
        SELECT 
            dni,
            fecha_llamada,
            transcripcion_texto,
            audio_url,
            duracion_segundos,
            confianza_promedio
        FROM `{PROJECT_ID}.{DATASET_ID}.transcripciones`
        WHERE transcripcion_texto IS NOT NULL 
        AND LENGTH(transcripcion_texto) > 100
        ORDER BY created_at DESC
        LIMIT 5
        """
        
        print("Consultando transcripciones en BigQuery...")
        query_job = client.query(query)
        results = query_job.result()
        
        transcripciones = []
        for row in results:
            transcripciones.append({
                "dni": row.dni,
                "fecha_llamada": row.fecha_llamada.strftime("%Y-%m-%d") if row.fecha_llamada else "2024-01-01",
                "transcripcion": row.transcripcion_texto,
                "audio_url": row.audio_url,
                "duracion": row.duracion_segundos or 0,
                "confianza": row.confianza_promedio or 0.0
            })
        
        print(f"Encontradas {len(transcripciones)} transcripciones")
        return transcripciones
        
    except Exception as e:
        print(f"ERROR consultando transcripciones: {e}")
        return []

def get_validation_sample():
    """Obtener datos de validación para los DNIs"""
    try:
        client = bigquery.Client(project=PROJECT_ID)
        
        # Buscar validaciones con diferentes tipos de problemas
        query = f"""
        SELECT 
            NumeroDocumento,
            TipoNoConfVal1,
            Producto,
            Vendedor,
            Supervisor,
            Gestor,
            FechaHoraVal1
        FROM `{PROJECT_ID}.FR_Admision.Validacion_Ventas`
        WHERE TipoNoConfVal1 IN (
            'Adj.Inmediata',
            'Adj.con nro. de cuotas', 
            'No me explicaron bien',
            'Otros',
            'No Contesta/Contesta tercero'
        )
        ORDER BY FechaHoraVal1 DESC
        LIMIT 10
        """
        
        print("🔍 Consultando validaciones en BigQuery...")
        query_job = client.query(query)
        results = query_job.result()
        
        validaciones = {}
        for row in results:
            dni = str(row.NumeroDocumento)
            validaciones[dni] = {
                "tipo_no_conf_val1": row.TipoNoConfVal1,
                "producto": row.Producto,
                "vendedor": row.Vendedor,
                "supervisor": row.Supervisor,
                "gestor": row.Gestor,
                "fecha_validacion": row.FechaHoraVal1
            }
        
        print(f"✅ Encontradas {len(validaciones)} validaciones")
        return validaciones
        
    except Exception as e:
        print(f"❌ Error consultando validaciones: {e}")
        return {}

def test_analysis_with_real_data():
    """Probar análisis con datos reales combinando transcripciones y validaciones"""
    
    print("=== PRUEBA CON DATOS REALES DE BIGQUERY ===")
    print()
    
    # Obtener API keys
    print("🔑 Obteniendo API keys...")
    deepgram_key = get_secret_value('deepgram-api-key')
    openai_key = get_secret_value('openai-api-key')
    
    if not openai_key:
        print("❌ ERROR: No se pudo obtener OpenAI API key")
        return
    
    os.environ['OPENAI_API_KEY'] = openai_key
    if deepgram_key:
        os.environ['DEEPGRAM_API_KEY'] = deepgram_key
    
    # Importar funciones mejoradas
    from main import analyze_quality_with_openai, get_validation_data
    from google.cloud import bigquery
    
    # Obtener datos
    transcripciones = get_transcripciones_sample()
    validaciones = get_validation_sample()
    
    if not transcripciones:
        print("❌ No se encontraron transcripciones")
        return
    
    print(f"📊 Probando {len(transcripciones)} transcripciones...")
    print("=" * 60)
    
    bigquery_client = bigquery.Client(project=PROJECT_ID)
    results = []
    
    for i, transcripcion in enumerate(transcripciones, 1):
        dni = transcripcion["dni"]
        fecha = transcripcion["fecha_llamada"]
        texto = transcripcion["transcripcion"]
        
        print(f"\n[PRUEBA {i}/{len(transcripciones)}] DNI: {dni}")
        print(f"Fecha: {fecha}")
        print(f"Longitud transcripción: {len(texto)} caracteres")
        
        # Buscar validación correspondiente o crear una de prueba
        if dni in validaciones:
            validation_data = validaciones[dni]
            print(f"✅ Validación encontrada: {validation_data['tipo_no_conf_val1']}")
        else:
            # Simular diferentes tipos de validación para prueba
            tipos_prueba = ['Adj.Inmediata', 'Adj.con nro. de cuotas', 'No me explicaron bien', 'Sin datos']
            tipo_simulado = tipos_prueba[i % len(tipos_prueba)]
            validation_data = {
                "tipo_no_conf_val1": tipo_simulado,
                "producto": "AUTOPRONTO" if i % 2 == 0 else "MOTO",
                "vendedor": "Test Vendedor",
                "supervisor": "Test Supervisor",
                "gestor": "Test Gestor"
            }
            print(f"🧪 Simulando validación: {tipo_simulado}")
        
        try:
            start_time = time.time()
            
            # Analizar con el sistema mejorado
            analysis_result = analyze_quality_with_openai(texto, dni, fecha, validation_data)
            
            process_time = time.time() - start_time
            
            if analysis_result.get('success'):
                print(f"✅ Análisis exitoso en {process_time:.2f}s")
                print(f"   📊 Categoría: {analysis_result.get('categoria', 'N/A')}")
                print(f"   📈 Puntuación: {analysis_result.get('puntuacion_total', 0)}")
                print(f"   🎯 Conformidad: {analysis_result.get('conformidad', 'N/A')}")
                print(f"   💬 Comentario: {analysis_result.get('comentarios', 'N/A')[:100]}...")
                print(f"   💰 Costo: ${analysis_result.get('cost_usd', 0):.4f}")
                
                # Mostrar desglose de puntos
                print(f"   📋 Desglose:")
                print(f"      - Identidad: {analysis_result.get('puntuacion_identidad', 0)}/10")
                print(f"      - Términos: {analysis_result.get('puntuacion_terminos', 0)}/10")
                print(f"      - Ganar (CRÍTICO): {analysis_result.get('puntuacion_claridad_ganar', 0)}/10")
                print(f"      - Dudas: {analysis_result.get('puntuacion_consulta_dudas', 0)}/10")
                print(f"      - Pasos: {analysis_result.get('puntuacion_siguientes_pasos', 0)}/10")
                
                results.append({
                    'dni': dni,
                    'validacion_tipo': validation_data['tipo_no_conf_val1'],
                    'producto': validation_data['producto'],
                    'categoria': analysis_result.get('categoria', 'N/A'),
                    'puntuacion_total': analysis_result.get('puntuacion_total', 0),
                    'conformidad': analysis_result.get('conformidad', 'N/A'),
                    'punto_critico': analysis_result.get('puntuacion_claridad_ganar', 0),
                    'costo': analysis_result.get('cost_usd', 0),
                    'tiempo': process_time,
                    'contexto_aplicado': analysis_result.get('contexto_aplicado', False)
                })
                
            else:
                print(f"❌ Error en análisis: {analysis_result.get('error', 'Unknown')}")
                results.append({
                    'dni': dni,
                    'validacion_tipo': validation_data['tipo_no_conf_val1'],
                    'error': analysis_result.get('error', 'Unknown')
                })
                
        except Exception as e:
            print(f"💥 Excepción: {str(e)}")
            results.append({
                'dni': dni,
                'validacion_tipo': validation_data.get('tipo_no_conf_val1', 'Unknown'),
                'error': f"Exception: {str(e)}"
            })
        
        # Pausa entre análisis
        if i < len(transcripciones):
            print("⏳ Esperando 2s...")
            time.sleep(2)
    
    # Resumen final
    print("\n" + "=" * 60)
    print("📈 RESUMEN DE PRUEBAS")
    print("=" * 60)
    
    successful = [r for r in results if 'error' not in r]
    failed = [r for r in results if 'error' in r]
    
    print(f"✅ Exitosos: {len(successful)}/{len(results)}")
    print(f"❌ Fallidos: {len(failed)}/{len(results)}")
    
    if successful:
        total_cost = sum(r.get('costo', 0) for r in successful)
        avg_tiempo = sum(r.get('tiempo', 0) for r in successful) / len(successful)
        
        print(f"💰 Costo total: ${total_cost:.4f}")
        print(f"⏱️  Tiempo promedio: {avg_tiempo:.2f}s")
        
        print(f"\n📊 Resultados por validación previa:")
        validacion_stats = {}
        for r in successful:
            tipo = r['validacion_tipo']
            if tipo not in validacion_stats:
                validacion_stats[tipo] = {'total': 0, 'conformes': 0, 'no_conformes': 0}
            
            validacion_stats[tipo]['total'] += 1
            if r['conformidad'] == 'Conforme':
                validacion_stats[tipo]['conformes'] += 1
            else:
                validacion_stats[tipo]['no_conformes'] += 1
        
        for tipo, stats in validacion_stats.items():
            conf_pct = (stats['conformes'] / stats['total']) * 100 if stats['total'] > 0 else 0
            print(f"   🔸 {tipo}: {stats['conformes']}/{stats['total']} conformes ({conf_pct:.1f}%)")
        
        print(f"\n🎯 Casos con contexto prioritario aplicado:")
        contexto_aplicado = [r for r in successful if r.get('contexto_aplicado', False)]
        print(f"   {len(contexto_aplicado)} de {len(successful)} casos")
        
        for r in contexto_aplicado:
            print(f"   - DNI {r['dni']}: {r['validacion_tipo']} → {r['categoria']} ({'✅' if r['conformidad'] == 'Conforme' else '❌'})")
    
    if failed:
        print(f"\n💥 Errores encontrados:")
        for r in failed:
            print(f"   - DNI {r['dni']} ({r['validacion_tipo']}): {r['error']}")
    
    return results

if __name__ == "__main__":
    test_analysis_with_real_data()