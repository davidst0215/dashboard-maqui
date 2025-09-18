#!/usr/bin/env python3
"""
Test local para la Cloud Function
Simula una request HTTP para probar la función localmente
"""
import json
import os
import sys
from unittest.mock import Mock

# Agregar el directorio actual al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Importar la función principal
from main import process_audio_quality

def test_audio_quality_processing():
    """Test de la función de procesamiento de audio"""
    
    # Crear un mock request
    mock_request = Mock()
    
    # Payload de prueba
    test_payload = {
        "dni": "12345678",
        "fecha_llamada": "2024-01-01",
        "audio_path": "gs://buckets_llamadas/test-audio.wav"
    }
    
    # Configurar el mock
    mock_request.get_json.return_value = test_payload
    mock_request.method = 'POST'
    
    print("🧪 Iniciando test local de Cloud Function...")
    print(f"📋 Payload de prueba: {json.dumps(test_payload, indent=2)}")
    
    try:
        # Ejecutar la función
        result = process_audio_quality(mock_request)
        
        print("✅ Función ejecutada exitosamente")
        print(f"📤 Resultado: {json.dumps(result, indent=2, ensure_ascii=False)}")
        
        return result
        
    except Exception as e:
        print(f"❌ Error en la ejecución: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

def test_error_cases():
    """Test de casos de error"""
    
    print("\n🧪 Testing casos de error...")
    
    # Test 1: Sin payload
    mock_request = Mock()
    mock_request.get_json.return_value = None
    
    result = process_audio_quality(mock_request)
    print(f"Test sin payload: {result}")
    
    # Test 2: Payload incompleto
    mock_request.get_json.return_value = {"dni": "123"}
    result = process_audio_quality(mock_request)
    print(f"Test payload incompleto: {result}")

if __name__ == "__main__":
    print("🎯 Cloud Function Test Local")
    print("=" * 50)
    
    # Verificar variables de entorno
    deepgram_key = os.environ.get('DEEPGRAM_API_KEY')
    openai_key = os.environ.get('OPENAI_API_KEY')
    
    print(f"🔑 DEEPGRAM_API_KEY: {'✅ Configurada' if deepgram_key else '❌ No configurada'}")
    print(f"🔑 OPENAI_API_KEY: {'✅ Configurada' if openai_key else '❌ No configurada'}")
    print(f"🔑 GOOGLE_APPLICATION_CREDENTIALS: {'✅ Configurada' if os.environ.get('GOOGLE_APPLICATION_CREDENTIALS') else '❌ No configurada'}")
    
    if not deepgram_key or not openai_key:
        print("\n⚠️  Para un test completo, configura las variables de entorno:")
        print("export DEEPGRAM_API_KEY='tu_key_aqui'")
        print("export OPENAI_API_KEY='tu_key_aqui'")
        print("export GOOGLE_APPLICATION_CREDENTIALS='path/to/credentials.json'")
    
    print("\n" + "=" * 50)
    
    # Ejecutar tests
    test_audio_quality_processing()
    test_error_cases()
    
    print("\n🎉 Tests completados")