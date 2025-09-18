#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Verificar datos en BigQuery después del procesamiento
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

def verify_tables():
    """Verificar contenido de las tablas de BigQuery"""
    try:
        client = bigquery.Client(project=PROJECT_ID)
        
        print("VERIFICANDO TABLAS DE BIGQUERY")
        print("="*60)
        
        # Verificar tabla de transcripciones
        print("\n1. TABLA TRANSCRIPCIONES:")
        print("-"*40)
        
        transcripciones_query = f"""
        SELECT 
            dni,
            fecha_llamada,
            LENGTH(transcripcion_texto) as longitud_texto,
            duracion_segundos,
            confianza_promedio,
            created_at
        FROM `{PROJECT_ID}.{DATASET_ID}.transcripciones`
        ORDER BY created_at DESC
        LIMIT 15
        """
        
        trans_results = client.query(transcripciones_query).result()
        trans_count = 0
        
        for row in trans_results:
            trans_count += 1
            print(f"  {trans_count}. DNI: {row.dni} | Fecha: {row.fecha_llamada} | Texto: {row.longitud_texto} chars | {row.duracion_segundos}s | Conf: {row.confianza_promedio:.3f}")
        
        # Contar total de registros
        count_trans_query = f"SELECT COUNT(*) as total FROM `{PROJECT_ID}.{DATASET_ID}.transcripciones`"
        count_trans = list(client.query(count_trans_query).result())[0].total
        print(f"\nTotal transcripciones: {count_trans}")
        
        # Verificar tabla de análisis
        print("\n2. TABLA ANALISIS_CALIDAD:")
        print("-"*40)
        
        analisis_query = f"""
        SELECT 
            dni,
            fecha_llamada,
            categoria,
            puntuacion_total,
            conformidad,
            comentarios,
            created_at
        FROM `{PROJECT_ID}.{DATASET_ID}.analisis_calidad`
        ORDER BY created_at DESC
        LIMIT 15
        """
        
        analisis_results = client.query(analisis_query).result()
        analisis_count = 0
        
        for row in analisis_results:
            analisis_count += 1
            print(f"  {analisis_count}. DNI: {row.dni} | {row.categoria} ({row.puntuacion_total}) | {row.conformidad} | {row.comentarios[:50]}...")
        
        # Contar total de análisis
        count_analisis_query = f"SELECT COUNT(*) as total FROM `{PROJECT_ID}.{DATASET_ID}.analisis_calidad`"
        count_analisis = list(client.query(count_analisis_query).result())[0].total
        print(f"\nTotal análisis: {count_analisis}")
        
        # Verificar registros más recientes por timestamp
        print("\n3. ULTIMOS REGISTROS PROCESADOS:")
        print("-"*40)
        
        recent_query = f"""
        SELECT 
            t.dni,
            t.created_at as trans_time,
            a.created_at as analisis_time,
            a.categoria,
            a.conformidad
        FROM `{PROJECT_ID}.{DATASET_ID}.transcripciones` t
        LEFT JOIN `{PROJECT_ID}.{DATASET_ID}.analisis_calidad` a
        ON t.dni = a.dni AND DATE(t.fecha_llamada) = DATE(a.fecha_llamada)
        WHERE t.created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
        ORDER BY t.created_at DESC
        """
        
        recent_results = client.query(recent_query).result()
        recent_count = 0
        
        for row in recent_results:
            recent_count += 1
            analisis_status = f"{row.categoria} - {row.conformidad}" if row.analisis_time else "SIN ANALISIS"
            print(f"  {recent_count}. DNI: {row.dni} | Trans: {row.trans_time} | Análisis: {analisis_status}")
        
        print(f"\nRegistros procesados en la última hora: {recent_count}")
        
        # Resumen
        print("\n" + "="*60)
        print("RESUMEN:")
        print("="*60)
        print(f"Transcripciones totales: {count_trans}")
        print(f"Análisis totales: {count_analisis}")
        print(f"Procesados recientemente: {recent_count}")
        
        if count_trans == 0 and count_analisis == 0:
            print("\n⚠️  LAS TABLAS ESTÁN VACÍAS")
            print("Posibles causas:")
            print("- Error en el procesamiento de Cloud Function")
            print("- Datos insertados en dataset/tabla incorrecta")
            print("- Error en las credenciales de BigQuery")
        elif count_trans > 0 and count_analisis == 0:
            print("\n⚠️  SOLO HAY TRANSCRIPCIONES, FALTA ANÁLISIS")
            print("El pipeline se detuvo después de Deepgram")
        elif count_trans > 0 and count_analisis > 0:
            print("\n✅ AMBAS TABLAS TIENEN DATOS")
            print("El pipeline completo funcionó correctamente")
        
    except Exception as e:
        print(f"ERROR verificando tablas: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    verify_tables()