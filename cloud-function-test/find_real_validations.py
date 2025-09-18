#!/usr/bin/env python3
"""
Buscar DNIs reales que tengan validaciones previas y transcripciones
"""
import os
from google.cloud import bigquery

credentials_path = os.path.join(os.path.dirname(__file__), '..', 'dashboard-backend', 'peak-emitter-350713-credentials.json')
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = credentials_path

PROJECT_ID = "peak-emitter-350713"
DATASET_ID = "Calidad_Llamadas"

def find_dnis_with_both():
    """Buscar DNIs que tengan tanto validación previa como transcripción"""
    try:
        client = bigquery.Client(project=PROJECT_ID)
        
        # Buscar DNIs que estén en ambas tablas
        query = f"""
        SELECT 
            v.NumeroDocumento as dni,
            v.TipoNoConfVal1,
            v.Nombre,
            v.Vendedor,
            v.Supervisor,
            v.FechaHoraVal1,
            t.transcripcion_texto,
            t.fecha_llamada as fecha_transcripcion,
            LENGTH(t.transcripcion_texto) as longitud_texto
        FROM `{PROJECT_ID}.FR_Admision.Validacion_Ventas` v
        INNER JOIN `{PROJECT_ID}.{DATASET_ID}.transcripciones` t
        ON CAST(v.NumeroDocumento AS STRING) = CAST(t.dni AS STRING)
        WHERE v.TipoNoConfVal1 IS NOT NULL
        AND v.TipoNoConfVal1 IN (
            'Adj.Inmediata',
            'Adj.con nro. de cuotas', 
            'No me explicaron bien',
            'No Contesta/Contesta tercero',
            'Otros'
        )
        AND t.transcripcion_texto IS NOT NULL
        AND LENGTH(t.transcripcion_texto) > 200
        ORDER BY v.FechaHoraVal1 DESC
        LIMIT 5
        """
        
        print("Buscando DNIs con validación previa Y transcripción...")
        print("="*60)
        
        query_job = client.query(query)
        results = query_job.result()
        
        found_matches = []
        for i, row in enumerate(results, 1):
            print(f"\n{i}. DNI: {row.dni}")
            print(f"   Nombre: {row.Nombre}")
            print(f"   TipoNoConfVal1: {row.TipoNoConfVal1}")
            print(f"   Vendedor: {row.Vendedor}")
            print(f"   Supervisor: {row.Supervisor}")
            print(f"   Fecha validación: {row.FechaHoraVal1}")
            print(f"   Fecha transcripción: {row.fecha_transcripcion}")
            print(f"   Longitud transcripción: {row.longitud_texto} chars")
            print(f"   Inicio transcripción: {row.transcripcion_texto[:100]}...")
            
            found_matches.append({
                'dni': row.dni,
                'tipo_no_conf_val1': row.TipoNoConfVal1,
                'nombre': row.Nombre,
                'vendedor': row.Vendedor,
                'supervisor': row.Supervisor,
                'transcripcion': row.transcripcion_texto,
                'fecha_validacion': row.FechaHoraVal1,
                'fecha_transcripcion': row.fecha_transcripcion
            })
        
        print(f"\nTotal encontrados: {len(found_matches)}")
        return found_matches
        
    except Exception as e:
        print(f"Error buscando matches: {e}")
        import traceback
        traceback.print_exc()
        return []

if __name__ == "__main__":
    matches = find_dnis_with_both()
    
    if matches:
        print("\n" + "="*60)
        print("RESUMEN DE CASOS ENCONTRADOS:")
        print("="*60)
        for match in matches:
            print(f"DNI {match['dni']}: {match['tipo_no_conf_val1']}")
    else:
        print("\nNo se encontraron DNIs con ambos datos.")