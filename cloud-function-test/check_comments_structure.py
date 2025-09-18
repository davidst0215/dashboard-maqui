#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Verificar estructura de comentarios en BigQuery
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

def check_comments_structure():
    """Verificar estructura de comentarios en análisis"""
    try:
        client = bigquery.Client(project=PROJECT_ID)
        
        print("VERIFICANDO ESTRUCTURA DE COMENTARIOS EN ANÁLISIS:")
        print("="*60)
        
        query = f"""
        SELECT 
            dni,
            categoria,
            conformidad,
            comentarios,
            LENGTH(comentarios) as longitud_comentarios,
            created_at
        FROM `{PROJECT_ID}.{DATASET_ID}.analisis_calidad`
        ORDER BY created_at DESC
        LIMIT 5
        """
        
        results = client.query(query).result()
        
        for i, row in enumerate(results, 1):
            print(f"{i}. DNI: {row.dni}")
            print(f"   Categoría: {row.categoria} - {row.conformidad}")
            print(f"   Longitud comentarios: {row.longitud_comentarios} chars")
            print(f"   Created: {row.created_at}")
            print(f"   Comentarios preview:")
            
            # Mostrar los primeros 300 caracteres de comentarios
            if row.comentarios:
                preview = row.comentarios[:300]
                print(f"   '{preview}...'")
                
                # Verificar si parece ser JSON
                if row.comentarios.startswith('{') or row.comentarios.startswith('['):
                    print("   📋 FORMATO: Parece JSON")
                    try:
                        import json
                        parsed = json.loads(row.comentarios)
                        print(f"   🔍 ESTRUCTURA: {type(parsed).__name__}")
                        if isinstance(parsed, dict):
                            print(f"   📝 KEYS: {list(parsed.keys())[:5]}")
                    except:
                        print("   ❌ JSON INVÁLIDO")
                else:
                    print("   📋 FORMATO: Texto plano")
            else:
                print("   ❌ SIN COMENTARIOS")
            print()
        
        # Verificar si hay registros con comentarios estructurados vs simples
        summary_query = f"""
        SELECT 
            COUNT(*) as total_registros,
            COUNT(comentarios) as con_comentarios,
            COUNT(CASE WHEN comentarios LIKE '{{%' THEN 1 END) as json_format,
            COUNT(CASE WHEN LENGTH(comentarios) > 100 THEN 1 END) as comentarios_largos
        FROM `{PROJECT_ID}.{DATASET_ID}.analisis_calidad`
        """
        
        summary = list(client.query(summary_query).result())[0]
        
        print("RESUMEN:")
        print("-"*40)
        print(f"Total registros: {summary.total_registros}")
        print(f"Con comentarios: {summary.con_comentarios}")
        print(f"Formato JSON: {summary.json_format}")
        print(f"Comentarios largos (>100 chars): {summary.comentarios_largos}")
        
        if summary.json_format == 0:
            print("⚠️ NINGÚN registro tiene comentarios en formato JSON estructurado")
        elif summary.json_format < summary.con_comentarios:
            print("⚠️ ALGUNOS registros tienen formato JSON, otros no")
        else:
            print("✅ TODOS los comentarios están en formato JSON")
            
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_comments_structure()