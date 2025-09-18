#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Limpiar tablas de BigQuery para prueba fresca
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

def clean_tables():
    """Limpiar tablas de transcripciones y análisis"""
    try:
        client = bigquery.Client(project=PROJECT_ID)
        
        tables_to_clean = [
            f"{PROJECT_ID}.{DATASET_ID}.transcripciones",
            f"{PROJECT_ID}.{DATASET_ID}.analisis_calidad"
        ]
        
        print("LIMPIANDO TABLAS DE BIGQUERY")
        print("="*50)
        
        for table_id in tables_to_clean:
            print(f"\nLimpiando tabla: {table_id}")
            
            # Verificar si la tabla existe
            try:
                table = client.get_table(table_id)
                print(f"  Tabla existe. Registros actuales: {table.num_rows}")
                
                # Usar TRUNCATE para evitar problemas con streaming buffer
                truncate_query = f"TRUNCATE TABLE `{table_id}`"
                print(f"  Ejecutando: {truncate_query}")
                
                job = client.query(truncate_query)
                job.result()  # Esperar a que complete
                
                # Verificar limpieza
                table_after = client.get_table(table_id)
                print(f"  ✅ Tabla limpiada. Registros restantes: {table_after.num_rows}")
                
            except Exception as e:
                if "Not found" in str(e):
                    print(f"  ⚠️ Tabla no existe: {table_id}")
                else:
                    print(f"  ❌ Error limpiando tabla: {e}")
        
        print(f"\n✅ Limpieza completada!")
        print("Las tablas están listas para recibir nuevos datos.")
        
    except Exception as e:
        print(f"❌ Error en limpieza: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    clean_tables()