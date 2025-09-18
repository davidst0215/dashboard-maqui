#!/usr/bin/env python3
"""
Explorar formatos de DNIs en ambas tablas
"""
import os
from google.cloud import bigquery

credentials_path = os.path.join(os.path.dirname(__file__), '..', 'dashboard-backend', 'peak-emitter-350713-credentials.json')
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = credentials_path

PROJECT_ID = "peak-emitter-350713"
DATASET_ID = "Calidad_Llamadas"

def explore_formats():
    """Explorar formatos de DNIs en ambas tablas"""
    try:
        client = bigquery.Client(project=PROJECT_ID)
        
        print("=== FORMATOS EN TABLA TRANSCRIPCIONES ===")
        query_trans = f"""
        SELECT DISTINCT 
            dni,
            LENGTH(CAST(dni AS STRING)) as longitud
        FROM `{PROJECT_ID}.{DATASET_ID}.transcripciones`
        WHERE dni IS NOT NULL
        ORDER BY dni
        LIMIT 10
        """
        
        results_trans = client.query(query_trans).result()
        for row in results_trans:
            print(f"  {row.dni} (longitud: {row.longitud})")
        
        print("\n=== FORMATOS EN TABLA VALIDACIONES ===")
        query_val = f"""
        SELECT DISTINCT 
            NumeroDocumento,
            LENGTH(NumeroDocumento) as longitud,
            TipoNoConfVal1
        FROM `{PROJECT_ID}.FR_Admision.Validacion_Ventas`
        WHERE NumeroDocumento IS NOT NULL
        AND TipoNoConfVal1 IS NOT NULL
        ORDER BY NumeroDocumento
        LIMIT 10
        """
        
        results_val = client.query(query_val).result()
        for row in results_val:
            print(f"  {row.NumeroDocumento} (longitud: {row.longitud}) - {row.TipoNoConfVal1}")
        
        print("\n=== BUSQUEDA ESPECIFICA DE NUESTROS DNIS ===")
        dnis_buscar = ['1150311', '729143']
        
        for dni in dnis_buscar:
            print(f"\nBuscando {dni}:")
            
            # En transcripciones
            query_find_trans = f"""
            SELECT dni, fecha_llamada
            FROM `{PROJECT_ID}.{DATASET_ID}.transcripciones`
            WHERE CAST(dni AS STRING) LIKE '%{dni}%'
            OR CAST(dni AS STRING) = '{dni}'
            LIMIT 3
            """
            
            trans_results = client.query(query_find_trans).result()
            print(f"  Transcripciones:")
            for row in trans_results:
                print(f"    {row.dni} - {row.fecha_llamada}")
            
            # En validaciones
            query_find_val = f"""
            SELECT NumeroDocumento, TipoNoConfVal1, Nombre
            FROM `{PROJECT_ID}.FR_Admision.Validacion_Ventas`
            WHERE CAST(NumeroDocumento AS STRING) LIKE '%{dni}%'
            OR CAST(NumeroDocumento AS STRING) = '{dni}'
            LIMIT 3
            """
            
            val_results = client.query(query_find_val).result()
            print(f"  Validaciones:")
            for row in val_results:
                print(f"    {row.NumeroDocumento} - {row.TipoNoConfVal1} - {row.Nombre}")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    explore_formats()