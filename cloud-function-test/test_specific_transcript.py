#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Probar transcripción específica directamente con OpenAI
"""
import sys
import codecs
if sys.platform == "win32":
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

import os
from google.cloud import bigquery, secretmanager

# Configurar credenciales
credentials_path = os.path.join(os.path.dirname(__file__), '..', 'dashboard-backend', 'peak-emitter-350713-credentials.json')
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = credentials_path

PROJECT_ID = "peak-emitter-350713"

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

def test_specific_transcript():
    """Probar transcripción específica"""
    
    # La transcripción que queremos analizar - DNI 729143 (la que da problema)
    transcripcion = """Aló. Buenas tardes. ¿Qué tal? ¿Con el señor Alejandro Chenco Correa Hilo? Sí. ¿Cómo cómo está usted? Está hablando con Juan Parisaca, que es de la oficina de Maquicistems Arequipa. Señor Alejandro, usted ya es cliente de nosotros. ¿Correcto? Usted ya venía trabajando con nosotros con financiamiento por 400000 dólares, y el mes pasado vimos 100000 dólares adicional. Este mes ya han aprobado los 300 restante, con lo cual completaríamos la inversión de de 800000 dólares. ¿Sí? Exacto, sí. Sí, sí. Perfecto. Más que todo es para validar que usted sí comprende cómo cómo es nuestro sistema de trabajo. ¿No? Usted ya viene pagando sus cuotas mensuales. Me comentó su asesor, la señora Carol, la señorita Carolina, que usted ya tiene pensado empezar a hacer sus remates. ¿Correcto? Para adjudicar su certificado. Sí, correcto. Sí, correcto. Una vez que usted adjudique todos sus certificados, ya sea por sorteo o por remate, iniciaríamos el proceso de adjudicación del bien. Usted puede utilizar sus certificados por separado o en conjunto, como usted lo vea por conveniente. ¿Sí, señor Alejandro? Sí, sí, perfecto, sí. Perfecto, señor Alejandro. En todo caso, era más que todo para informarle eso, lo inscribimos ahora al sistema, desde mañana usted ya puede empezar a hacer su remate si lo por conveniente. Ok, sí, sí. Muy amable. Buenas noches, señor Alejandro, gracias. Buenas noches, gracias. Gracias. Hasta luego."""
    
    print("PRUEBA DE TRANSCRIPCIÓN ESPECÍFICA")
    print("="*60)
    print(f"Longitud: {len(transcripcion)} caracteres")
    print(f"Texto inicio: {transcripcion[:100]}...")
    print()
    
    # Simular datos de un cliente - DNI 729143
    dni_test = "729143"  
    fecha_test = "2025-05-22"
    
    # Simular validación según BigQuery
    validation_data_test = {
        "tipo_no_conf_val1": "No Contesta/Contesta tercero", 
        "numero_documento": f"00{dni_test}",
        "vendedor": "Juan Parisaca", 
        "supervisor": "Test Supervisor",
        "gestor": "Test Gestor",
        "nombre": "CHEN CORREAZHILONG ALEJANDRO"
    }
    
    try:
        # Obtener API key
        openai_key = get_secret_value('openai-api-key')
        if not openai_key:
            print("ERROR: No se pudo obtener OpenAI API key")
            return
        
        os.environ['OPENAI_API_KEY'] = openai_key
        
        # Importar función de análisis
        from main import analyze_quality_with_openai
        
        print("ANALIZANDO CON OPENAI GPT-4O...")
        print("-"*40)
        
        result = analyze_quality_with_openai(transcripcion, dni_test, fecha_test, validation_data_test)
        
        if result.get('success'):
            print("✅ ANÁLISIS EXITOSO")
            print(f"   Categoría: {result.get('categoria', 'N/A')}")
            print(f"   Puntuación total: {result.get('puntuacion_total', 0)}")
            print(f"   Conformidad: {result.get('conformidad', 'N/A')}")
            print(f"   Costo: ${result.get('cost_usd', 0):.4f}")
            print()
            
            print("DESGLOSE DETALLADO:")
            print("-"*30)
            print(f"   Identidad: {result.get('puntuacion_identidad', 0)}/10")
            print(f"   Términos: {result.get('puntuacion_terminos', 0)}/10")
            print(f"   Ganar (CRÍTICO): {result.get('puntuacion_claridad_ganar', 0)}/10")
            print(f"   Dudas: {result.get('puntuacion_consulta_dudas', 0)}/10") 
            print(f"   Pasos: {result.get('puntuacion_siguientes_pasos', 0)}/10")
            print()
            
            print("COMENTARIOS:")
            print("-"*20)
            comentarios = result.get('comentarios', 'Sin comentarios')
            print(f"   {comentarios}")
            print()
            
            print("JUSTIFICACIÓN:")
            print("-"*20)
            justificacion = result.get('justificacion', 'Sin justificación')
            print(f"   {justificacion}")
            
            # Verificar análisis manual de SEGUNDA TRANSCRIPCIÓN
            # Manual: Identidad ✅, Términos ✅, Ganar ❌, Dudas ✅, Pasos ✅
            puntos_esperados = 4  # Identidad + Términos + Dudas + Pasos
            categoria_esperada = "BUENA"  # 4/5 = 80% (pero sin punto crítico Ganar = No Conforme)
            
            puntos_reales = sum([
                1 if result.get('puntuacion_identidad', 0) >= 5 else 0,
                1 if result.get('puntuacion_terminos', 0) >= 5 else 0,
                1 if result.get('puntuacion_claridad_ganar', 0) >= 5 else 0,
                1 if result.get('puntuacion_consulta_dudas', 0) >= 5 else 0,
                1 if result.get('puntuacion_siguientes_pasos', 0) >= 5 else 0
            ])
            
            print()
            print("COMPARACIÓN CON ANÁLISIS MANUAL:")
            print("-"*40)
            print(f"   Esperado: {puntos_esperados}/5 puntos → {categoria_esperada}")
            print(f"   Obtenido: {puntos_reales}/5 puntos → {result.get('categoria', 'N/A')}")
            
            if result.get('categoria') == categoria_esperada:
                print("   ✅ COINCIDE con análisis manual")
            else:
                print("   ❌ DIFERENTE al análisis manual")
                print("   Posibles razones:")
                print("   - Criterios muy estrictos")
                print("   - Problemas en limpieza de texto")
                print("   - GPT-4o interpretando diferente")
            
        else:
            print("❌ ERROR EN ANÁLISIS")
            print(f"   Error: {result.get('error', 'Unknown')}")
            
    except Exception as e:
        print(f"EXCEPCIÓN: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_specific_transcript()