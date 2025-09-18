#!/usr/bin/env python3
"""
Test simple del sistema mejorado de análisis de calidad
"""
import os
import sys
import json
from google.cloud import bigquery, secretmanager
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

def test_simple():
    """Test simple con transcripciones de BigQuery"""
    
    print("=== PRUEBA SIMPLE CON BIGQUERY ===")
    print()
    
    # Obtener API key de OpenAI
    print("Obteniendo API keys...")
    openai_key = get_secret_value('openai-api-key')
    
    if not openai_key:
        print("ERROR: No se pudo obtener OpenAI API key")
        return
    
    os.environ['OPENAI_API_KEY'] = openai_key
    
    # Importar funciones
    from main import analyze_quality_with_openai, get_validation_data
    
    # Obtener 2 transcripciones de BigQuery
    try:
        client = bigquery.Client(project=PROJECT_ID)
        
        query = f"""
        SELECT 
            dni,
            fecha_llamada,
            transcripcion_texto
        FROM `{PROJECT_ID}.{DATASET_ID}.transcripciones`
        WHERE transcripcion_texto IS NOT NULL 
        AND LENGTH(transcripcion_texto) > 100
        ORDER BY created_at DESC
        LIMIT 2
        """
        
        print("Consultando transcripciones...")
        results = client.query(query).result()
        
        transcripciones = []
        for row in results:
            transcripciones.append({
                "dni": row.dni,
                "fecha_llamada": row.fecha_llamada.strftime("%Y-%m-%d") if row.fecha_llamada else "2024-01-01",
                "texto": row.transcripcion_texto
            })
        
        print(f"Encontradas {len(transcripciones)} transcripciones")
        
        if not transcripciones:
            print("No hay transcripciones disponibles")
            return
        
        # NO simular validaciones - usar las reales desde get_validation_data
        
        print("\n" + "="*50)
        print("INICIANDO ANALISIS")
        print("="*50)
        
        bigquery_client = bigquery.Client(project=PROJECT_ID)
        
        for i, transcripcion in enumerate(transcripciones):
            dni = transcripcion["dni"]
            fecha = transcripcion["fecha_llamada"] 
            texto = transcripcion["texto"]
            
            # Obtener validación real desde BigQuery
            validation_data = get_validation_data(bigquery_client, dni, fecha)
            
            print(f"\n--- PRUEBA {i+1} ---")
            print(f"DNI: {dni}")
            print(f"Validacion previa REAL: {validation_data['tipo_no_conf_val1']}")
            print(f"Nombre cliente: {validation_data.get('nombre', 'N/A')}")
            print(f"DNI validacion: {validation_data.get('numero_documento', 'N/A')}")
            print(f"Longitud texto: {len(texto)} chars")
            print(f"Texto inicio: {texto[:100]}...")
            
            try:
                start_time = time.time()
                
                # Analizar con sistema mejorado usando validación real
                result = analyze_quality_with_openai(texto, dni, fecha, validation_data)
                
                process_time = time.time() - start_time
                
                if result.get('success'):
                    print(f"EXITO en {process_time:.2f}s")
                    print(f"  Categoria: {result.get('categoria', 'N/A')}")
                    print(f"  Puntuacion total: {result.get('puntuacion_total', 0)}")
                    print(f"  Conformidad: {result.get('conformidad', 'N/A')}")
                    print(f"  Costo: ${result.get('cost_usd', 0):.4f}")
                    print(f"  Comentarios: {result.get('comentarios', 'N/A')[:100]}")
                    
                    print("  Puntuaciones detalladas:")
                    print(f"    - Identidad: {result.get('puntuacion_identidad', 0)}/10")
                    print(f"    - Terminos: {result.get('puntuacion_terminos', 0)}/10") 
                    print(f"    - Ganar (CRITICO): {result.get('puntuacion_claridad_ganar', 0)}/10")
                    print(f"    - Dudas: {result.get('puntuacion_consulta_dudas', 0)}/10")
                    print(f"    - Pasos: {result.get('puntuacion_siguientes_pasos', 0)}/10")
                    
                    # Verificar si se aplicó contexto especial
                    if result.get('contexto_aplicado'):
                        print("  >>> CONTEXTO PRIORITARIO APLICADO <<<")
                        
                else:
                    print(f"ERROR: {result.get('error', 'Unknown')}")
                    
            except Exception as e:
                print(f"EXCEPCION: {str(e)}")
            
            if i < len(transcripciones) - 1:
                print("Esperando 3s...")
                time.sleep(3)
        
        print("\n" + "="*50)
        print("PRUEBA COMPLETADA")
        print("="*50)
        
    except Exception as e:
        print(f"Error en prueba: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_simple()