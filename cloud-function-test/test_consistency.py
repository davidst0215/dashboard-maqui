#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Probar consistencia ejecutando la misma transcripción múltiples veces
"""
import sys
import codecs
if sys.platform == "win32":
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

import os
import json
from collections import Counter

def test_consistency():
    """Probar consistencia ejecutando 5 veces el mismo análisis"""
    
    # Importar función de análisis
    from main import analyze_quality_with_openai
    
    # Obtener API key
    from main import get_secret_value
    openai_key = get_secret_value('openai-api-key')
    if not openai_key:
        print("ERROR: No se pudo obtener OpenAI API key")
        return
    
    os.environ['OPENAI_API_KEY'] = openai_key
    
    # Transcripción de prueba
    transcripcion = """Aló. Buenas tardes. ¿Qué tal? ¿Con el señor Alejandro Chenco Correa Hilo? Sí. ¿Cómo cómo está usted? Está hablando con Juan Parisaca, que es de la oficina de Maquicistems Arequipa. Señor Alejandro, usted ya es cliente de nosotros. ¿Correcto? Usted ya venía trabajando con nosotros con financiamiento por 400000 dólares, y el mes pasado vimos 100000 dólares adicional. Este mes ya han aprobado los 300 restante, con lo cual completaríamos la inversión de de 800000 dólares. ¿Sí? Exacto, sí. Sí, sí. Perfecto. Más que todo es para validar que usted sí comprende cómo cómo es nuestro sistema de trabajo. ¿No? Usted ya viene pagando sus cuotas mensuales. Me comentó su asesor, la señora Carol, la señorita Carolina, que usted ya tiene pensado empezar a hacer sus remates. ¿Correcto? Para adjudicar su certificado. Sí, correcto. Sí, correcto. Una vez que usted adjudique todos sus certificados, ya sea por sorteo o por remate, iniciaríamos el proceso de adjudicación del bien. Usted puede utilizar sus certificados por separado o en conjunto, como usted lo vea por conveniente. ¿Sí, señor Alejandro? Sí, sí, perfecto, sí. Perfecto, señor Alejandro. En todo caso, era más que todo para informarle eso, lo inscribimos ahora al sistema, desde mañana usted ya puede empezar a hacer su remate si lo por conveniente. Ok, sí, sí. Muy amable. Buenas noches, señor Alejandro, gracias. Buenas noches, gracias. Gracias. Hasta luego."""
    
    dni_test = "729143"
    fecha_test = "2025-05-22"
    
    validation_data_test = {
        "tipo_no_conf_val1": "No Contesta/Contesta tercero",
        "numero_documento": f"00{dni_test}",
        "vendedor": "Juan Parisaca",
        "supervisor": "Test Supervisor", 
        "gestor": "Test Gestor",
        "nombre": "CHEN CORREAZHILONG ALEJANDRO"
    }
    
    print("PRUEBA DE CONSISTENCIA - 5 EJECUCIONES")
    print("="*60)
    
    results = []
    
    for i in range(5):
        print(f"\n--- EJECUCIÓN {i+1}/5 ---")
        
        try:
            result = analyze_quality_with_openai(
                transcripcion, 
                dni_test, 
                fecha_test, 
                validation_data_test
            )
            
            if result.get('success'):
                # Extraer puntuaciones
                puntos = [
                    1 if result.get('puntuacion_identidad', 0) >= 5 else 0,
                    1 if result.get('puntuacion_terminos', 0) >= 5 else 0,
                    1 if result.get('puntuacion_claridad_ganar', 0) >= 5 else 0,
                    1 if result.get('puntuacion_consulta_dudas', 0) >= 5 else 0,
                    1 if result.get('puntuacion_siguientes_pasos', 0) >= 5 else 0
                ]
                
                total_puntos = sum(puntos)
                categoria = result.get('categoria', 'N/A')
                conformidad = result.get('conformidad', 'N/A')
                
                results.append({
                    'ejecucion': i+1,
                    'identidad': puntos[0],
                    'terminos': puntos[1], 
                    'ganar': puntos[2],
                    'dudas': puntos[3],
                    'pasos': puntos[4],
                    'total_puntos': total_puntos,
                    'categoria': categoria,
                    'conformidad': conformidad
                })
                
                print(f"  Puntos: {puntos} = {total_puntos}/5")
                print(f"  Categoría: {categoria}")
                print(f"  Conformidad: {conformidad}")
                
            else:
                print(f"  ❌ Error: {result.get('error')}")
                
        except Exception as e:
            print(f"  ❌ Excepción: {e}")
    
    print("\n" + "="*60)
    print("ANÁLISIS DE CONSISTENCIA:")
    print("="*60)
    
    if results:
        # Analizar variabilidad
        categories = [r['categoria'] for r in results]
        conformidades = [r['conformidad'] for r in results]
        total_puntos_list = [r['total_puntos'] for r in results]
        
        print(f"Categorías: {Counter(categories)}")
        print(f"Conformidades: {Counter(conformidades)}")  
        print(f"Total puntos: {Counter(total_puntos_list)}")
        
        # Calcular variabilidad por criterio
        criterios = ['identidad', 'terminos', 'ganar', 'dudas', 'pasos']
        print("\nVariabilidad por criterio:")
        for criterio in criterios:
            valores = [r[criterio] for r in results]
            variabilidad = len(set(valores)) > 1
            print(f"  {criterio.capitalize()}: {Counter(valores)} {'❌ INCONSISTENTE' if variabilidad else '✅ CONSISTENTE'}")
        
        # Consistencia general
        categoria_consistente = len(set(categories)) == 1
        conformidad_consistente = len(set(conformidades)) == 1
        
        print(f"\n🎯 CONSISTENCIA GENERAL:")
        print(f"   Categoría: {'✅ CONSISTENTE' if categoria_consistente else '❌ INCONSISTENTE'}")
        print(f"   Conformidad: {'✅ CONSISTENTE' if conformidad_consistente else '❌ INCONSISTENTE'}")
        
        if categoria_consistente and conformidad_consistente:
            print("   🎉 SISTEMA CONSISTENTE")
        else:
            print("   ⚠️ NECESITA MEJORAR CONSISTENCIA")

if __name__ == "__main__":
    test_consistency()