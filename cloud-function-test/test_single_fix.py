#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Probar corrección con un solo audio
"""
import sys
import codecs
if sys.platform == "win32":
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

import requests
import json
import time

CLOUD_FUNCTION_URL = "https://us-central1-peak-emitter-350713.cloudfunctions.net/process-audio-quality"

def test_single_audio():
    """Probar con un audio para verificar la corrección"""
    
    # Usar el audio que sabemos que funciona
    test_payload = {
        "dni": "1150311",
        "fecha_llamada": "2025-04-30",
        "audio_path": "gs://buckets_llamadas/001150311/30042025-23_03_40_992241928_001150311_001150311_(c2e40eb8-92f4-43a9-88a0-2f413e60b6bb).wav"
    }
    
    print("PROBANDO CORRECCIÓN DE ANALISIS BIGQUERY")
    print("="*50)
    print(f"DNI: {test_payload['dni']}")
    print(f"URL: {CLOUD_FUNCTION_URL}")
    print()
    
    try:
        print("Enviando solicitud...")
        start_time = time.time()
        
        response = requests.post(
            CLOUD_FUNCTION_URL,
            json=test_payload,
            headers={'Content-Type': 'application/json'},
            timeout=300
        )
        
        process_time = time.time() - start_time
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ EXITO en {process_time:.1f}s")
            print(f"   Categoria: {result['analysis']['categoria']}")
            print(f"   Puntuacion: {result['analysis']['puntuacion_total']}")
            print(f"   Conformidad: {result['analysis']['conformidad']}")
            print(f"   Costo total: ${result['costs']['deepgram_usd'] + result['costs']['openai_usd']:.4f}")
            print("\n✅ Si ves este mensaje, significa que NO hubo error de JSON serializable!")
            return True
            
        else:
            print(f"❌ ERROR HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"EXCEPCION: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_single_audio()
    
    if success:
        print("\n🎉 CORRECCIÓN EXITOSA!")
        print("Ahora podemos verificar que el análisis se guardó en BigQuery.")
    else:
        print("\n❌ AÚN HAY PROBLEMAS")
        print("Revisar logs de Cloud Function para más detalles.")