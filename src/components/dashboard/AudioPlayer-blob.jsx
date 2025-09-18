// Opción 2: Descarga completa del audio y creación de Blob URL local
import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from '../auth/LoginComponent';
import { API_CONFIG, buildApiUrl } from '../../config/api';

export function AudioPlayerBlob({ selectedCall, onClose }) {
  const auth = useAuth();
  const token = auth.token || auth.accessToken || auth.authToken;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const fetchAndCreateBlob = async () => {
      if (!selectedCall?.ID_AUDIO) {
        setAudioUrl(null);
        setError(null);
        return;
      }

      console.log('🎵 AudioPlayer: Descargando audio completo:', selectedCall.ID_AUDIO);
      setIsLoading(true);
      setError(null);
      setDownloadProgress(0);
      
      try {
        if (!token) {
          throw new Error('Token de autenticación requerido');
        }

        // Obtener URL firmada primero
        const signedApiUrl = buildApiUrl(API_CONFIG.ENDPOINTS.AUDIO_SIGNED_URL);
        const response = await fetch(signedApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            gsPath: selectedCall.ID_AUDIO
          })
        });
        
        if (!response.ok) {
          throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.success || !data.signed_url) {
          throw new Error(data.error || 'Error generando URL firmada');
        }

        console.log('🔗 Descargando audio desde URL firmada...');
        
        // Descargar el archivo completo
        const audioResponse = await fetch(data.signed_url);
        
        if (!audioResponse.ok) {
          throw new Error(`Error descargando audio: ${audioResponse.status}`);
        }

        // Leer como blob
        const audioBlob = await audioResponse.blob();
        
        // Crear URL local del blob
        const blobUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(blobUrl);
        
        console.log('✅ Audio descargado y disponible como Blob URL local');
        
      } catch (err) {
        console.error('❌ Error configurando audio:', err);
        setError(`Error: ${err.message}`);
        setAudioUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndCreateBlob();
    
    // Limpiar URL del blob al desmontar
    return () => {
      if (audioUrl && audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [selectedCall, token]);

  if (!selectedCall || !selectedCall.ID_AUDIO) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          Selecciona una llamada para reproducir el audio
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Reproductor de Audio (Blob Local)</span>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Audio element con Blob URL local */}
        <div className="w-full">
          {audioUrl ? (
            <audio 
              ref={audioRef}
              controls
              preload="metadata"
              className="w-full"
              src={audioUrl}
            >
              Tu navegador no soporta la reproducción de audio.
            </audio>
          ) : (
            <div className="h-12 bg-gray-100 rounded flex items-center justify-center text-gray-500">
              {isLoading ? "Descargando audio..." : "Esperando audio..."}
            </div>
          )}
        </div>

        {/* Estados de carga y error */}
        {isLoading && (
          <div className="text-center text-sm text-blue-500">
            📥 Descargando audio completo para reproducción local...
            {downloadProgress > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            )}
          </div>
        )}
        
        {error && (
          <div className="text-center text-sm text-red-500 bg-red-50 p-3 rounded">
            <div className="font-semibold mb-2">❌ {error}</div>
            <div className="text-xs">
              💡 Verifica tu conexión a internet y reintenta
            </div>
          </div>
        )}

        {/* Información de la llamada */}
        <div className="text-xs text-gray-400 bg-gray-50 p-3 rounded">
          <div className="grid grid-cols-2 gap-2">
            <div><strong>Cliente:</strong> {selectedCall.NOMBRE_CLIENTE}</div>
            <div><strong>DNI:</strong> {selectedCall.DNI}</div>
            <div><strong>Categoría:</strong> 
              <span className={`ml-1 font-semibold ${
                selectedCall.CATEGORÍA === 'MUY BUENA' ? 'text-green-600' :
                selectedCall.CATEGORÍA === 'BUENA' ? 'text-blue-600' :
                selectedCall.CATEGORÍA === 'MEDIA' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {selectedCall.CATEGORÍA}
              </span>
            </div>
            <div><strong>Puntuación:</strong> {selectedCall.PUNTUACION_TOTAL}</div>
          </div>
          <div className="mt-2 pt-2 border-t">
            <div><strong>Método:</strong> 
              <span className="text-green-600 ml-1">📥 Descarga + Blob Local</span>
            </div>
            {audioUrl && !error && (
              <div><strong>Estado:</strong> 
                <span className="text-green-600 ml-1">✅ Audio local listo</span>
              </div>
            )}
          </div>
        </div>

        {/* Mensaje simple */}
        {audioUrl && !error && (
          <div className="text-center text-sm text-gray-600">
            🎵 Audio descargado y disponible localmente - sin restricciones CORS
          </div>
        )}
      </CardContent>
    </Card>
  );
}