#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Debuggear mapeo DNI → archivo de audio → transcripción
"""
import sys
import codecs
if sys.platform == "win32":
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

import os
import re
from google.cloud import storage

# Configurar credenciales
credentials_path = os.path.join(os.path.dirname(__file__), '..', 'dashboard-backend', 'peak-emitter-350713-credentials.json')
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = credentials_path

PROJECT_ID = "peak-emitter-350713"
BUCKET_NAME = "buckets_llamadas"

def debug_dni_mapping():
    """Debuggear mapeo DNI → archivo"""
    try:
        client = storage.Client(project=PROJECT_ID)
        bucket = client.bucket(BUCKET_NAME)
        
        print("DEBUGGEANDO MAPEO DNI → ARCHIVO")
        print("="*60)
        
        # Obtener todos los blobs y extraer DNIs
        blobs = list(bucket.list_blobs())
        audio_files = [blob for blob in blobs if blob.name.endswith('.wav')]
        
        print(f"Total archivos .wav encontrados: {len(audio_files)}")
        print()
        
        dni_mapping = {}
        
        for blob in audio_files[:15]:  # Revisar primeros 15
            filename = blob.name.split('/')[-1]  # Solo el nombre del archivo
            
            # Extraer DNI del nombre del archivo usando regex
            # Formato esperado: DDMMYYYY-HH_MM_SS_NNNNNNNN_DDDDDDDD_DDDDDDDD_(UUID).wav
            dni_patterns = [
                r'_(\d{6,8})_\1_',  # Pattern: _DNI_DNI_
                r'_00(\d{6,8})_00\1',  # Pattern: _00DNI_00DNI
                r'_(\d{6,8})_(\d{6,8})_',  # Pattern: _DNI1_DNI2_
            ]
            
            extracted_dni = None
            for pattern in dni_patterns:
                match = re.search(pattern, filename)
                if match:
                    extracted_dni = match.group(1)
                    break
            
            if not extracted_dni:
                # Buscar cualquier secuencia de 6-8 dígitos
                digits = re.findall(r'\d{6,8}', filename)
                if digits:
                    extracted_dni = digits[0]
            
            print(f"Archivo: {filename[:80]}...")
            print(f"  DNI extraído: {extracted_dni}")
            print(f"  Tamaño: {blob.size / (1024*1024):.1f}MB")
            print()
            
            if extracted_dni:
                if extracted_dni not in dni_mapping:
                    dni_mapping[extracted_dni] = []
                dni_mapping[extracted_dni].append({
                    'filename': filename,
                    'path': blob.name,
                    'size': blob.size
                })
        
        print("\nRESUMEN MAPEO DNI:")
        print("-"*40)
        for dni, files in dni_mapping.items():
            print(f"DNI {dni}: {len(files)} archivo(s)")
            for file_info in files:
                print(f"  - {file_info['filename'][:60]}...")
        
        # Revisar DNIs específicos problemáticos
        problematic_dnis = ["729143", "1373740"]
        
        print(f"\nREVISANDO DNIs PROBLEMÁTICOS:")
        print("-"*40)
        
        for dni in problematic_dnis:
            print(f"\nDNI {dni}:")
            if dni in dni_mapping:
                for file_info in dni_mapping[dni]:
                    print(f"  ✅ Encontrado: {file_info['filename']}")
            else:
                print(f"  ❌ No encontrado en el mapeo")
                
                # Buscar manualmente en todos los archivos
                for blob in audio_files:
                    if dni in blob.name:
                        print(f"  🔍 Posible match: {blob.name}")
        
        return dni_mapping
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return {}

if __name__ == "__main__":
    debug_dni_mapping()