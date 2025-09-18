// AudioPlayer.jsx - Versión corregida
import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// Iconos eliminados - usando controles nativos
import { useAuth } from '../auth/LoginComponent';
import { API_CONFIG, buildApiUrl } from '../../config/api';

export function AudioPlayer({ selectedCall, onClose }) {
  const auth = useAuth();
  const token = auth.token || auth.accessToken || auth.authToken;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const audioRef = useRef(null);
  
  // Usar configuración centralizada
  const API_BASE_URL = API_CONFIG.BASE_URL;

  useEffect(() => {
    const fetchAudioUrl = async () => {
      if (!selectedCall?.ID_AUDIO) {
        setAudioUrl(null);
        setError(null);
        return;
      }

      console.log('🎵 AudioPlayer: Procesando llamada:', selectedCall.ID_AUDIO);
      setIsLoading(true);
      setError(null);
      
      try {
        console.log('🎯 Configurando acceso directo al bucket para:', selectedCall.ID_AUDIO);
        
        if (!selectedCall.ID_AUDIO.startsWith('gs://')) {
          throw new Error('Formato de audio no soportado. Se esperaba gs://');
        }

        // MÉTODO FINAL Y DEFINITIVO: Backend proxy con conversión a MP3 (máxima compatibilidad)
        const audioPath = selectedCall.ID_AUDIO.replace('gs://buckets_llamadas/', '');
        const proxyUrl = buildApiUrl(API_CONFIG.ENDPOINTS.AUDIO_MP3 + '/' + audioPath);
        
        console.log('🔄 Usando backend con conversión WAV → MP3:', proxyUrl);
        console.log('🔗 URL completa generada:', proxyUrl);
        
        // Probar que la URL responde antes de asignarla
        try {
          const testResponse = await fetch(proxyUrl, { method: 'HEAD' });
          console.log('🧪 Test response status:', testResponse.status);
          console.log('🧪 Test response headers:', Array.from(testResponse.headers.entries()));
          
          if (testResponse.ok) {
            setAudioUrl(proxyUrl);
            console.log('✅ URL del proxy validada y asignada');
          } else {
            throw new Error(`Proxy responde con error: ${testResponse.status}`);
          }
        } catch (testError) {
          console.error('❌ Error probando URL del proxy:', testError);
          throw new Error(`Proxy no accesible: ${testError.message}`);
        }
      } catch (err) {
        console.error('❌ Error configurando audio:', err);
        setError(`Error: ${err.message}`);
        setAudioUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAudioUrl();
    
    // Limpiar URL del blob al cambiar de audio
    return () => {
      if (audioUrl && audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [selectedCall, token]);

  // Usar controles nativos del navegador - mucho más simple y confiable

  // Todas las funciones de control eliminadas - usando controles nativos

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
          <span>Reproductor de Audio</span>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Audio element - Ultra simple para debugging */}
        <div className="w-full space-y-2">
          {audioUrl ? (
            <>
              <audio 
                ref={audioRef}
                controls
                preload="none"
                className="w-full"
                src={audioUrl}
                onLoadStart={() => console.log('🎵 Audio loading started')}
                onCanPlay={() => console.log('🎵 Audio can play')}
                onError={(e) => {
                  console.error('🎵 Audio error:', e.target.error);
                  setError(`Audio error: ${e.target.error?.message || 'Unknown error'}`);
                }}
              >
                Tu navegador no soporta la reproducción de audio.
              </audio>
              
              {/* Link directo para testing */}
              <div className="text-center">
                <a 
                  href={audioUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-500 underline text-sm"
                >
                  🔗 Abrir audio directamente en nueva pestaña (para testing)
                </a>
              </div>
            </>
          ) : (
            <div className="h-12 bg-gray-100 rounded flex items-center justify-center text-gray-500">
              Esperando audio...
            </div>
          )}
        </div>

        {/* Estados de carga y error */}
        {isLoading && (
          <div className="text-center text-sm text-blue-500">
            🔄 Convirtiendo WAV a MP3 para máxima compatibilidad...
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
            <div><strong>Archivo:</strong> {selectedCall.ID_LLAMADA}</div>
            <div><strong>Estado:</strong> 
              <span className={`ml-1 ${
                isLoading ? 'text-blue-600' :
                error ? 'text-red-600' :
                audioUrl ? 'text-green-600' : 'text-gray-600'
              }`}>
                {isLoading ? 'Cargando...' : error ? 'Error' : audioUrl ? 'Listo' : 'Configurando...'}
              </span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t">
            <div><strong>Método:</strong> 
              <span className="text-blue-600 ml-1">🔄 WAV → MP3</span>
            </div>
            {audioUrl && !error && (
              <div><strong>Estado:</strong> 
                <span className="text-green-600 ml-1">✅ MP3 listo</span>
              </div>
            )}
          </div>
        </div>

        {/* Mensaje simple */}
        {audioUrl && !error && (
          <div className="text-center text-sm text-gray-600">
            🎵 WAV convertido a MP3 - máxima compatibilidad con navegadores
          </div>
        )}
      </CardContent>
    </Card>
  );
}