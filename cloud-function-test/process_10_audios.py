#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Procesar 10 audios del bucket usando la Cloud Function
"""
import sys
import codecs
if sys.platform == "win32":
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

import os
import requests
import json
import time
from google.cloud import storage

# Configurar credenciales
credentials_path = os.path.join(os.path.dirname(__file__), '..', 'dashboard-backend', 'peak-emitter-350713-credentials.json')
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = credentials_path

# Configuración
CLOUD_FUNCTION_URL = "https://us-central1-peak-emitter-350713.cloudfunctions.net/process-audio-quality"
BUCKET_NAME = "buckets_llamadas"
PROJECT_ID = "peak-emitter-350713"

def list_audio_files():
    """Listar archivos de audio en el bucket"""
    try:
        client = storage.Client(project=PROJECT_ID)
        bucket = client.bucket(BUCKET_NAME)
        
        print("BUSCANDO ARCHIVOS DE AUDIO EN EL BUCKET")
        print("="*50)
        
        # Listar archivos .wav directamente
        all_blobs = bucket.list_blobs()
        
        audio_files = []
        
        print("Explorando bucket...")
        for blob in all_blobs:
            if blob.name.endswith('.wav') and len(audio_files) < 10:
                # Extraer DNI del path (ej: 000729143/archivo.wav)
                path_parts = blob.name.split('/')
                if len(path_parts) >= 2:
                    dni_folder = path_parts[0]
                    dni = dni_folder.lstrip('0')  # Remover ceros iniciales
                    
                    # Inferir fecha del nombre del archivo
                    filename = blob.name.split('/')[-1]
                    date_match = filename[:8]  # DDMMYYYY
                    try:
                        day = date_match[:2]
                        month = date_match[2:4] 
                        year = date_match[4:8]
                        fecha_llamada = f"{year}-{month}-{day}"
                    except:
                        fecha_llamada = "2024-01-01"  # Fecha por defecto
                    
                    audio_files.append({
                        'dni': dni,
                        'fecha_llamada': fecha_llamada,
                        'audio_path': f"gs://{BUCKET_NAME}/{blob.name}",
                        'filename': filename,
                        'size_mb': blob.size / (1024*1024) if blob.size else 0
                    })
                    
                    print(f"  {len(audio_files)}. DNI: {dni} | Fecha: {fecha_llamada} | {filename[:50]}...")
                    
                if len(audio_files) >= 10:
                    break
        
        print(f"\nEncontrados {len(audio_files)} archivos de audio para procesar")
        return audio_files
        
    except Exception as e:
        print(f"ERROR listando archivos: {e}")
        import traceback
        traceback.print_exc()
        return []

def process_audio_batch(audio_files):
    """Procesar lote de audios usando Cloud Function"""
    print(f"\nPROCESANDO {len(audio_files)} AUDIOS")
    print("="*60)
    
    results = []
    total_cost = 0
    total_duration = 0
    start_batch = time.time()
    
    for i, audio in enumerate(audio_files, 1):
        print(f"\n--- AUDIO {i}/{len(audio_files)} ---")
        print(f"DNI: {audio['dni']}")
        print(f"Fecha: {audio['fecha_llamada']}")
        print(f"Archivo: {audio['filename']}")
        print(f"Tamaño: {audio['size_mb']:.1f}MB")
        
        payload = {
            "dni": audio["dni"],
            "fecha_llamada": audio["fecha_llamada"],
            "audio_path": audio["audio_path"]
        }
        
        try:
            print("Enviando a Cloud Function...")
            start_time = time.time()
            
            response = requests.post(
                CLOUD_FUNCTION_URL,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=600  # 10 minutos
            )
            
            process_time = time.time() - start_time
            
            if response.status_code == 200:
                result = response.json()
                
                print(f"EXITO en {process_time:.1f}s")
                print(f"  Categoria: {result['analysis']['categoria']}")
                print(f"  Puntuacion: {result['analysis']['puntuacion_total']}")
                print(f"  Conformidad: {result['analysis']['conformidad']}")
                print(f"  Duracion audio: {result['transcription']['duration']:.1f}s")
                print(f"  Confianza: {result['transcription']['confidence']:.3f}")
                print(f"  Costo: ${result['costs']['deepgram_usd'] + result['costs']['openai_usd']:.4f}")
                
                cost = result['costs']['deepgram_usd'] + result['costs']['openai_usd']
                total_cost += cost
                total_duration += result['transcription']['duration']
                
                results.append({
                    'dni': audio['dni'],
                    'filename': audio['filename'],
                    'categoria': result['analysis']['categoria'],
                    'puntuacion': result['analysis']['puntuacion_total'],
                    'conformidad': result['analysis']['conformidad'],
                    'duracion_audio': result['transcription']['duration'],
                    'confianza': result['transcription']['confidence'],
                    'costo': cost,
                    'tiempo_proceso': process_time,
                    'status': 'success'
                })
                
            else:
                print(f"ERROR HTTP {response.status_code}")
                print(f"Response: {response.text[:200]}...")
                
                results.append({
                    'dni': audio['dni'],
                    'filename': audio['filename'],
                    'error': f"HTTP {response.status_code}",
                    'status': 'error'
                })
                
        except Exception as e:
            print(f"EXCEPCION: {str(e)}")
            results.append({
                'dni': audio['dni'],
                'filename': audio['filename'], 
                'error': f"Exception: {str(e)}",
                'status': 'exception'
            })
        
        # Pausa entre audios para evitar rate limits
        if i < len(audio_files):
            print("Esperando 3s...")
            time.sleep(3)
    
    batch_time = time.time() - start_batch
    
    # Generar resumen
    print("\n" + "="*60)
    print("RESUMEN DEL PROCESAMIENTO")
    print("="*60)
    
    successful = [r for r in results if r['status'] == 'success']
    failed = [r for r in results if r['status'] != 'success']
    
    print(f"Exitosos: {len(successful)}/{len(results)}")
    print(f"Fallidos: {len(failed)}/{len(results)}")
    print(f"Tiempo total: {batch_time:.1f}s ({batch_time/60:.1f} min)")
    
    if successful:
        print(f"Costo total: ${total_cost:.4f}")
        print(f"Duracion total audio: {total_duration:.1f}s ({total_duration/60:.1f} min)")
        print(f"Tiempo promedio proceso: {sum(r['tiempo_proceso'] for r in successful)/len(successful):.1f}s")
        
        # Estadísticas por categoría
        print(f"\nCategorías obtenidas:")
        categorias = {}
        conformes = 0
        for r in successful:
            cat = r['categoria']
            categorias[cat] = categorias.get(cat, 0) + 1
            if r['conformidad'] == 'Conforme':
                conformes += 1
        
        for cat, count in categorias.items():
            pct = (count / len(successful)) * 100
            print(f"  {cat}: {count} audios ({pct:.1f}%)")
        
        conf_pct = (conformes / len(successful)) * 100
        print(f"\nConformidad: {conformes}/{len(successful)} audios ({conf_pct:.1f}%)")
        
    if failed:
        print(f"\nAudios fallidos:")
        for r in failed:
            print(f"  {r['dni']}: {r.get('error', 'Unknown')}")
    
    return results

def main():
    """Función principal"""
    print("PROCESAMIENTO MASIVO DE 10 AUDIOS")
    print("="*60)
    print(f"Bucket: {BUCKET_NAME}")
    print(f"Cloud Function: {CLOUD_FUNCTION_URL}")
    print()
    
    # Paso 1: Listar archivos
    audio_files = list_audio_files()
    
    if not audio_files:
        print("No se encontraron archivos de audio")
        return
    
    if len(audio_files) < 10:
        print(f"ADVERTENCIA: Solo se encontraron {len(audio_files)} archivos (menos de 10)")
    
    # Paso 2: Procesar lote
    results = process_audio_batch(audio_files)
    
    # Paso 3: Guardar resultados
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    results_file = f"batch_results_{timestamp}.json"
    
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"\n✅ Resultados guardados en: {results_file}")
    print(f"✅ Datos almacenados en BigQuery:")
    print(f"   - Tabla transcripciones: {len([r for r in results if r['status'] == 'success'])} registros")
    print(f"   - Tabla analisis_calidad: {len([r for r in results if r['status'] == 'success'])} registros")

if __name__ == "__main__":
    main()