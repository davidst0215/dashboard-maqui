#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Probar Cloud Function en producción con audios reales del bucket
"""
import sys
import codecs
if sys.platform == "win32":
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

import requests
import json
import time

# URL de la Cloud Function desplegada
CLOUD_FUNCTION_URL = "https://us-central1-peak-emitter-350713.cloudfunctions.net/process-audio-quality"

def test_production_audio():
    """Probar con audios reales del bucket"""
    
    # Audios reales del bucket que ya sabemos que existen
    test_cases = [
        {
            "name": "CHEN RUNBO - Caso MUY BUENA esperado",
            "dni": "1150311",
            "fecha_llamada": "2025-04-30",
            "audio_path": "gs://buckets_llamadas/001150311/30042025-23_03_40_992241928_001150311_001150311_(c2e40eb8-92f4-43a9-88a0-2f413e60b6bb).wav",
            "expected": "Debería ser MUY BUENA con validación 'No Contesta/Contesta tercero'"
        },
        {
            "name": "CHEN CORREAZHILONG - Caso MEDIA esperado", 
            "dni": "729143",
            "fecha_llamada": "2025-05-22",
            "audio_path": "gs://buckets_llamadas/000729143/22052025-21_10_49_992241928_000729143_000729143_(fd3ccb19-ea4e-4391-aaed-b54784a85047).wav",
            "expected": "Debería ser MEDIA con validación 'No Contesta/Contesta tercero'"
        },
        {
            "name": "Caso adicional para prueba",
            "dni": "887881", 
            "fecha_llamada": "2024-09-27",
            "audio_path": "gs://buckets_llamadas/000887881/27092024-11_21_42_999999135_000887881_000887881-d451af23-bab8-4b09-a9b4-233db47c3e1b.wav",
            "expected": "Caso de prueba adicional"
        }
    ]
    
    print("PROBANDO CLOUD FUNCTION EN PRODUCCION")
    print("=" * 60)
    print(f"URL: {CLOUD_FUNCTION_URL}")
    print()
    
    results = []
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"--- PRUEBA {i}/3: {test_case['name']} ---")
        print(f"DNI: {test_case['dni']}")
        print(f"Audio: {test_case['audio_path'].split('/')[-1]}")
        print(f"Esperado: {test_case['expected']}")
        
        payload = {
            "dni": test_case["dni"],
            "fecha_llamada": test_case["fecha_llamada"], 
            "audio_path": test_case["audio_path"]
        }
        
        try:
            print("🔄 Enviando solicitud...")
            start_time = time.time()
            
            response = requests.post(
                CLOUD_FUNCTION_URL,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=600  # 10 minutos timeout
            )
            
            total_time = time.time() - start_time
            
            if response.status_code == 200:
                result = response.json()
                
                print(f"✅ ÉXITO en {total_time:.1f}s")
                print(f"   📊 Categoría: {result['analysis']['categoria']}")
                print(f"   📈 Puntuación: {result['analysis']['puntuacion_total']}")
                print(f"   🎯 Conformidad: {result['analysis']['conformidad']}")
                print(f"   ⏱️  Duración audio: {result['transcription']['duration']:.1f}s")
                print(f"   🔍 Confianza: {result['transcription']['confidence']:.3f}")
                print(f"   💰 Costo Total: ${result['costs']['deepgram_usd'] + result['costs']['openai_usd']:.4f}")
                print(f"      - Deepgram: ${result['costs']['deepgram_usd']:.4f}")
                print(f"      - OpenAI: ${result['costs']['openai_usd']:.4f}")
                
                # Verificar si coincide con lo esperado
                if "MUY BUENA" in test_case['expected'] and result['analysis']['categoria'] == "MUY BUENA":
                    print("   🎉 ¡RESULTADO ESPERADO CORRECTO!")
                elif "MEDIA" in test_case['expected'] and result['analysis']['categoria'] == "MEDIA":
                    print("   🎉 ¡RESULTADO ESPERADO CORRECTO!")
                else:
                    print(f"   ⚠️  Resultado diferente al esperado")
                
                results.append({
                    'dni': test_case['dni'],
                    'categoria': result['analysis']['categoria'],
                    'puntuacion': result['analysis']['puntuacion_total'],
                    'conformidad': result['analysis']['conformidad'],
                    'duracion': result['transcription']['duration'],
                    'costo_total': result['costs']['deepgram_usd'] + result['costs']['openai_usd'],
                    'tiempo_proceso': total_time,
                    'status': 'success'
                })
                
            else:
                print(f"❌ ERROR HTTP {response.status_code}")
                print(f"   Response: {response.text}")
                results.append({
                    'dni': test_case['dni'],
                    'error': f"HTTP {response.status_code}: {response.text}",
                    'status': 'error'
                })
                
        except Exception as e:
            print(f"💥 EXCEPCIÓN: {str(e)}")
            results.append({
                'dni': test_case['dni'],
                'error': f"Exception: {str(e)}",
                'status': 'exception'
            })
        
        print()
        if i < len(test_cases):
            print("⏳ Esperando 5s antes de la siguiente prueba...")
            time.sleep(5)
    
    # Resumen final
    print("=" * 60)
    print("📊 RESUMEN DE PRUEBAS EN PRODUCCIÓN")
    print("=" * 60)
    
    successful = [r for r in results if r.get('status') == 'success']
    failed = [r for r in results if r.get('status') != 'success']
    
    print(f"✅ Exitosos: {len(successful)}/{len(results)}")
    print(f"❌ Fallidos: {len(failed)}/{len(results)}")
    
    if successful:
        total_cost = sum(r.get('costo_total', 0) for r in successful)
        avg_tiempo = sum(r.get('tiempo_proceso', 0) for r in successful) / len(successful)
        avg_duracion = sum(r.get('duracion', 0) for r in successful) / len(successful)
        
        print(f"💰 Costo total: ${total_cost:.4f}")
        print(f"⏱️  Tiempo promedio: {avg_tiempo:.1f}s")
        print(f"🎵 Duración promedio audio: {avg_duracion:.1f}s")
        
        print(f"\n📈 Categorías obtenidas:")
        categorias = {}
        for r in successful:
            cat = r.get('categoria', 'Unknown')
            categorias[cat] = categorias.get(cat, 0) + 1
        
        for cat, count in categorias.items():
            print(f"   {cat}: {count} audio(s)")
    
    if failed:
        print(f"\n💥 Audios fallidos:")
        for r in failed:
            print(f"   DNI {r['dni']}: {r.get('error', 'Unknown error')}")
    
    return results

if __name__ == "__main__":
    # Verificar si la URL de Cloud Function está actualizada
    if "PLACEHOLDER" in CLOUD_FUNCTION_URL:
        print("⚠️  Por favor actualiza CLOUD_FUNCTION_URL con la URL real de tu Cloud Function")
        exit(1)
    
    test_production_audio()