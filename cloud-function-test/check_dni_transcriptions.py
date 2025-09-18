#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Revisar transcripciones para un DNI específico
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

def check_transcriptions_for_dni(dni):
    """Revisar transcripciones para un DNI específico"""
    try:
        client = bigquery.Client(project=PROJECT_ID)
        
        print(f"BUSCANDO TRANSCRIPCIONES PARA DNI {dni}:")
        print("="*60)
        
        # Buscar todas las transcripciones para este DNI
        query = f"""
        SELECT 
            dni,
            fecha_llamada,
            LEFT(transcripcion_texto, 200) as inicio_texto,
            LENGTH(transcripcion_texto) as longitud,
            confianza_promedio,
            created_at,
            transcripcion_texto
        FROM `{PROJECT_ID}.{DATASET_ID}.transcripciones`
        WHERE dni = '{dni}'
        ORDER BY created_at DESC
        """
        
        results = client.query(query).result()
        count = 0
        
        for row in results:
            count += 1
            print(f"{count}. DNI: {row.dni} | Fecha: {row.fecha_llamada}")
            print(f"   Longitud: {row.longitud} chars | Confianza: {row.confianza_promedio:.3f}")
            print(f"   Creado: {row.created_at}")
            print(f"   Inicio: {row.inicio_texto}...")
            print()
            
            # Mostrar más detalles si hay pocos resultados
            if count <= 2:
                print("TRANSCRIPCIÓN COMPLETA:")
                print("-" * 40)
                print(row.transcripcion_texto[:1000] + ("..." if len(row.transcripcion_texto) > 1000 else ""))
                print()
                print("="*60)
                print()
        
        if count == 0:
            print(f"❌ No se encontraron transcripciones para DNI {dni}")
        else:
            print(f"Total encontradas: {count}")
            
        # También revisar análisis
        print(f"\nBUSCANDO ANÁLISIS PARA DNI {dni}:")
        print("-"*40)
        
        analysis_query = f"""
        SELECT 
            dni,
            fecha_llamada,
            categoria,
            puntuacion_total,
            conformidad,
            comentarios,
            created_at
        FROM `{PROJECT_ID}.{DATASET_ID}.analisis_calidad`
        WHERE dni = '{dni}'
        ORDER BY created_at DESC
        """
        
        analysis_results = client.query(analysis_query).result()
        analysis_count = 0
        
        for row in analysis_results:
            analysis_count += 1
            print(f"{analysis_count}. {row.categoria} ({row.puntuacion_total}) - {row.conformidad}")
            print(f"   Fecha: {row.fecha_llamada} | Creado: {row.created_at}")
            print(f"   Comentarios: {row.comentarios[:100]}...")
            print()
            
        if analysis_count == 0:
            print(f"❌ No se encontraron análisis para DNI {dni}")
        else:
            print(f"Total análisis: {analysis_count}")
            
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

def get_full_analysis_details(dni):
    """Obtener detalles completos del análisis"""
    try:
        client = bigquery.Client(project=PROJECT_ID)
        
        print(f"DETALLES COMPLETOS PARA DNI {dni}:")
        print("="*60)
        
        # Query completa para obtener todos los detalles
        query = f"""
        SELECT 
            a.dni,
            a.fecha_llamada,
            a.categoria,
            a.puntuacion_total,
            a.conformidad,
            a.puntuacion_identificacion,
            a.puntuacion_verificacion,
            a.puntuacion_contextualizacion,
            a.puntuacion_sentimientos,
            a.comentarios,
            a.analisis_detallado,
            a.created_at as analisis_created,
            t.transcripcion_texto,
            t.duracion_segundos,
            t.confianza_promedio,
            t.created_at as trans_created
        FROM `{PROJECT_ID}.{DATASET_ID}.analisis_calidad` a
        LEFT JOIN `{PROJECT_ID}.{DATASET_ID}.transcripciones` t
        ON a.dni = t.dni AND DATE(a.fecha_llamada) = DATE(t.fecha_llamada)
        WHERE a.dni = '{dni}'
        ORDER BY a.created_at DESC
        """
        
        results = client.query(query).result()
        
        for row in results:
            print("INFORMACIÓN BÁSICA:")
            print("-"*30)
            print(f"DNI: {row.dni}")
            print(f"Fecha llamada: {row.fecha_llamada}")
            print(f"Categoría: {row.categoria} ({row.puntuacion_total} puntos)")
            print(f"Conformidad: {row.conformidad}")
            print(f"Duración audio: {row.duracion_segundos}s")
            print(f"Confianza transcripción: {row.confianza_promedio:.3f}")
            print()
            
            print("DESGLOSE DETALLADO:")
            print("-"*30)
            print(f"1. Identificación: {row.puntuacion_identificacion}/10")
            print(f"2. Verificación: {row.puntuacion_verificacion}/10") 
            print(f"3. Contextualización: {row.puntuacion_contextualizacion}/10")
            print(f"4. Sentimientos/Pasos: {row.puntuacion_sentimientos}/10")
            print()
            
            # Intentar parsear analisis_detallado si existe
            if row.analisis_detallado:
                print("ANÁLISIS DETALLADO (JSON):")
                print("-"*30)
                import json
                try:
                    detalle = json.loads(row.analisis_detallado) if isinstance(row.analisis_detallado, str) else row.analisis_detallado
                    for key, value in detalle.items():
                        print(f"{key}: {value}")
                except:
                    print("Error parseando JSON detallado")
                print()
            print()
            
            print("COMENTARIOS:")
            print("-"*30)
            print(row.comentarios)
            print()
            
            print("TRANSCRIPCIÓN COMPLETA:")
            print("-"*30)
            print(row.transcripcion_texto)
            print()
            
            print("TIMESTAMPS:")
            print("-"*30) 
            print(f"Transcripción creada: {row.trans_created}")
            print(f"Análisis creado: {row.analisis_created}")
            
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    dni_to_check = "729143"
    get_full_analysis_details(dni_to_check)