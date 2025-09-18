#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Verificar que transcripcion_id se está guardando correctamente
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

def verify_transcription_ids():
    """Verificar transcripcion_id en análisis"""
    try:
        client = bigquery.Client(project=PROJECT_ID)
        
        print("VERIFICANDO TRANSCRIPCION_ID EN ANÁLISIS:")
        print("="*50)
        
        query = f"""
        SELECT 
            dni,
            transcripcion_id,
            categoria,
            conformidad,
            created_at
        FROM `{PROJECT_ID}.{DATASET_ID}.analisis_calidad`
        ORDER BY created_at DESC
        LIMIT 5
        """
        
        results = client.query(query).result()
        
        found_with_id = 0
        found_without_id = 0
        
        for i, row in enumerate(results, 1):
            print(f"{i}. DNI: {row.dni}")
            print(f"   Transcripcion ID: {row.transcripcion_id}")
            print(f"   Resultado: {row.categoria} - {row.conformidad}")
            print(f"   Creado: {row.created_at}")
            
            if row.transcripcion_id:
                found_with_id += 1
                print("   ✅ TIENE TRANSCRIPCION_ID")
            else:
                found_without_id += 1
                print("   ❌ SIN TRANSCRIPCION_ID")
            print()
        
        print("RESUMEN:")
        print("-"*30)
        print(f"Con transcripcion_id: {found_with_id}")
        print(f"Sin transcripcion_id: {found_without_id}")
        
        if found_with_id > 0 and found_without_id == 0:
            print("🎉 TODOS los registros tienen transcripcion_id")
        elif found_with_id > 0:
            print("⚠️ ALGUNOS registros tienen transcripcion_id")
        else:
            print("❌ NINGÚN registro tiene transcripcion_id")
            
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    verify_transcription_ids()