#!/usr/bin/env python3
"""
Verificar validación previa real del DNI 1150311
"""
import os
from google.cloud import bigquery

# Configurar credenciales
credentials_path = os.path.join(os.path.dirname(__file__), '..', 'dashboard-backend', 'peak-emitter-350713-credentials.json')
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = credentials_path

PROJECT_ID = "peak-emitter-350713"

def check_validation(dni):
    """Verificar validación previa real de un DNI específico"""
    try:
        client = bigquery.Client(project=PROJECT_ID)
        
        # Primero ver la estructura de la tabla
        schema_query = f"""
        SELECT column_name, data_type 
        FROM `{PROJECT_ID}.FR_Admision.INFORMATION_SCHEMA.COLUMNS` 
        WHERE table_name = 'Validacion_Ventas'
        ORDER BY ordinal_position
        """
        
        print("Estructura de la tabla:")
        schema_job = client.query(schema_query)
        schema_results = schema_job.result()
        
        columns = []
        for row in schema_results:
            print(f"  {row.column_name} ({row.data_type})")
            columns.append(row.column_name)
        
        print()
        
        # Ahora hacer la consulta considerando formato con ceros
        query = f"""
        SELECT *
        FROM `{PROJECT_ID}.FR_Admision.Validacion_Ventas`
        WHERE CAST(NumeroDocumento AS STRING) = '{dni}'
        OR CAST(NumeroDocumento AS STRING) = '{dni.zfill(9)}'
        OR REPLACE(CAST(NumeroDocumento AS STRING), '0', '') = '{dni}'
        ORDER BY FechaHoraVal1 DESC
        LIMIT 3
        """
        
        print(f"Consultando validacion previa para DNI: {dni}")
        print("="*50)
        
        query_job = client.query(query)
        results = query_job.result()
        
        found = False
        for i, row in enumerate(results, 1):
            found = True
            print(f"Registro {i}:")
            # Imprimir todos los campos disponibles
            for column in columns:
                try:
                    value = getattr(row, column)
                    print(f"  {column}: {value}")
                except:
                    print(f"  {column}: <error reading>")
            print()
        
        if not found:
            print(f"No se encontró validación previa para DNI: {dni}")
        
        return found
        
    except Exception as e:
        print(f"Error consultando validación: {e}")
        return False

def check_both_dnis():
    """Verificar ambos DNIs de la prueba"""
    print("VERIFICACION DE VALIDACIONES PREVIAS REALES")
    print("="*60)
    print()
    
    # DNI 1 - que analizamos
    print("1. DNI: 1150311")
    check_validation("1150311")
    
    print("-"*50)
    
    # DNI 2 - el segundo de la prueba  
    print("2. DNI: 729143")
    check_validation("729143")

if __name__ == "__main__":
    check_both_dnis()