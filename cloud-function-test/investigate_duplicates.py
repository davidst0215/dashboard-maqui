#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Investigar duplicados en BigQuery para DNI específico
"""
import sys
import codecs
if sys.platform == "win32":
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

import os
from google.cloud import bigquery

# Configurar credenciales
credentials_path = os.path.join(os.path.dirname(__file__), '..', 'dashboard-backend', 'peak-emitter-350713-credentials.json')
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = credentials_path

PROJECT_ID = "peak-emitter-350713"
DATASET_ID = "Calidad_Llamadas"

def investigate_duplicates(dni):
    """Investigar duplicados para un DNI específico"""
    try:
        client = bigquery.Client(project=PROJECT_ID)
        
        print(f"INVESTIGANDO DUPLICADOS PARA DNI {dni}:")
        print("="*60)
        
        # 1. Revisar transcripciones
        print("1. TRANSCRIPCIONES:")
        print("-"*40)
        trans_query = f"""
        SELECT 
            dni,
            fecha_llamada,
            LEFT(transcripcion_texto, 100) as preview,
            LENGTH(transcripcion_texto) as longitud,
            duracion_segundos,
            confianza_promedio,
            created_at,
            updated_at
        FROM `{PROJECT_ID}.{DATASET_ID}.transcripciones`
        WHERE dni = '{dni}'
        ORDER BY created_at DESC
        """
        
        trans_results = client.query(trans_query).result()
        trans_count = 0
        
        for row in trans_results:
            trans_count += 1
            print(f"  {trans_count}. Fecha: {row.fecha_llamada}")
            print(f"      Creado: {row.created_at}")
            print(f"      Actualizado: {row.updated_at}")
            print(f"      Longitud: {row.longitud} chars")
            print(f"      Preview: {row.preview}...")
            print()
        
        # 2. Revisar análisis
        print("2. ANÁLISIS:")
        print("-"*40)
        analisis_query = f"""
        SELECT 
            dni,
            fecha_llamada,
            transcripcion_id,
            categoria,
            puntuacion_total,
            conformidad,
            LEFT(comentarios, 100) as comentarios_preview,
            created_at,
            updated_at
        FROM `{PROJECT_ID}.{DATASET_ID}.analisis_calidad`
        WHERE dni = '{dni}'
        ORDER BY created_at DESC
        """
        
        analisis_results = client.query(analisis_query).result()
        analisis_count = 0
        
        for row in analisis_results:
            analisis_count += 1
            print(f"  {analisis_count}. Trans ID: {row.transcripcion_id}")
            print(f"      Fecha: {row.fecha_llamada}")
            print(f"      Creado: {row.created_at}")
            print(f"      Actualizado: {row.updated_at}")
            print(f"      Resultado: {row.categoria} ({row.puntuacion_total}) - {row.conformidad}")
            print(f"      Comentarios: {row.comentarios_preview}...")
            print()
        
        # 3. Verificar IDs únicos
        print("3. VERIFICACIÓN DE UNICIDAD:")
        print("-"*40)
        
        # Contar transcripciones (sin transcripcion_id en esta tabla)
        unique_trans_query = f"""
        SELECT 
            COUNT(*) as total_registros,
            COUNT(DISTINCT CONCAT(dni, '-', CAST(fecha_llamada AS STRING))) as combinaciones_unicas
        FROM `{PROJECT_ID}.{DATASET_ID}.transcripciones`
        WHERE dni = '{dni}'
        """
        
        unique_trans_result = list(client.query(unique_trans_query).result())[0]
        print(f"Transcripciones - Total: {unique_trans_result.total_registros}, Combinaciones únicas: {unique_trans_result.combinaciones_unicas}")
        
        # Contar análisis únicos por transcripcion_id
        unique_analisis_query = f"""
        SELECT 
            COUNT(*) as total_registros,
            COUNT(DISTINCT transcripcion_id) as ids_unicos
        FROM `{PROJECT_ID}.{DATASET_ID}.analisis_calidad`
        WHERE dni = '{dni}'
        """
        
        unique_analisis_result = list(client.query(unique_analisis_query).result())[0]
        print(f"Análisis - Total: {unique_analisis_result.total_registros}, IDs únicos: {unique_analisis_result.ids_unicos}")
        
        # 4. Buscar duplicados en toda la tabla
        print("\n4. DUPLICADOS EN TODA LA TABLA:")
        print("-"*40)
        
        duplicates_query = f"""
        SELECT 
            dni,
            COUNT(*) as total_registros
        FROM `{PROJECT_ID}.{DATASET_ID}.transcripciones`
        GROUP BY dni
        HAVING COUNT(*) > 1
        ORDER BY total_registros DESC
        LIMIT 10
        """
        
        duplicates_results = client.query(duplicates_query).result()
        
        print("DNIs con múltiples registros:")
        for row in duplicates_results:
            print(f"  DNI {row.dni}: {row.total_registros} registros")
        
        # 5. Buscar registros recientes del DNI
        print(f"\n5. HISTÓRICO DEL DNI {dni}:")
        print("-"*40)
        
        historico_query = f"""
        SELECT 
            t.dni,
            t.fecha_llamada,
            t.created_at as trans_created,
            a.created_at as analisis_created,
            a.categoria,
            a.conformidad
        FROM `{PROJECT_ID}.{DATASET_ID}.transcripciones` t
        LEFT JOIN `{PROJECT_ID}.{DATASET_ID}.analisis_calidad` a
        ON t.dni = a.dni AND DATE(t.fecha_llamada) = DATE(a.fecha_llamada)
        WHERE t.dni = '{dni}'
        ORDER BY t.created_at DESC
        """
        
        historico_results = client.query(historico_query).result()
        
        for i, row in enumerate(historico_results, 1):
            print(f"  {i}. Fecha llamada: {row.fecha_llamada}")
            print(f"     Transcripción creada: {row.trans_created}")
            print(f"     Análisis creado: {row.analisis_created}")
            print(f"     Resultado: {row.categoria} - {row.conformidad}")
            print()
        
        return {
            'transcripciones': trans_count,
            'analisis': analisis_count,
            'unique_trans_combinations': unique_trans_result.combinaciones_unicas,
            'unique_analisis_ids': unique_analisis_result.ids_unicos
        }
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    dni_to_investigate = "729143"
    results = investigate_duplicates(dni_to_investigate)
    
    if results:
        print("\n" + "="*60)
        print("RESUMEN:")
        print("="*60)
        print(f"DNI {dni_to_investigate}:")
        print(f"  - Registros de transcripción: {results['transcripciones']}")
        print(f"  - Registros de análisis: {results['analisis']}")  
        print(f"  - Combinaciones únicas transcripción: {results['unique_trans_combinations']}")
        print(f"  - IDs únicos análisis: {results['unique_analisis_ids']}")
        
        if results['transcripciones'] > results['unique_trans_combinations']:
            print("  ⚠️ HAY DUPLICADOS EN TRANSCRIPCIONES")
        if results['analisis'] > results['unique_analisis_ids']:
            print("  ⚠️ HAY DUPLICADOS EN ANÁLISIS")
        if results['transcripciones'] == 1 and results['analisis'] == 1:
            print("  ✅ Un registro por audio (correcto)")
        elif results['transcripciones'] > 1 or results['analisis'] > 1:
            print("  ⚠️ MÚLTIPLES REGISTROS - Posible duplicación")