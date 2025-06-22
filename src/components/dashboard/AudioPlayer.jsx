// src/components/dashboard/AudioPlayer.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { useAuth } from '../auth/LoginComponent';

// Función para convertir gs:// a URL de Google Cloud Storage
const convertGsToCloudUrl = (gsPath) => {
  if (!gsPath || !gsPath.startsWith('gs://')) {
    console.warn('⚠️ URL no válida:', gsPath);
    return null;
  }
  
  // Convertir gs://buckets_llamadas/... a https://storage.cloud.google.com/buckets_llamadas/...
  const cloudUrl = gsPath.replace('gs://', 'https://storage.cloud.google.com/');
  
  console.log('🔗 URL convertida:', gsPath, '→', cloudUrl);
  return cloudUrl;
};

export function AudioPlayer({ selectedCall, onClose }) {
  const { getSignedUrl } = useAuth();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const audioRef = useRef(null);

  // Convertir gs:// a URL directa cuando cambia la llamada seleccionada
  useEffect(() => {
    const fetchAudioUrl = async () => {
      if (!selectedCall?.ID_AUDIO) {
        setAudioUrl(null);
        setError(null);
        return;
      }

      console.log('🎵 AudioPlayer: Procesando nueva llamada:', selectedCall.ID_AUDIO);
      
      try {
        // Extraer path del audio
        const audioPath = selectedCall.ID_AUDIO.replace('gs://buckets_llamadas/', '');
        const streamUrl = `https://quality-dashboard-api-919351372784.europe-west1.run.app/api/audio/stream/${audioPath}`;
        
        setAudioUrl(streamUrl);
        setError(null);
        console.log('✅ URL de streaming MP3 configurada:', streamUrl);
      } catch (err) {
        console.error('❌ Error configurando stream:', err);
        setError('Error configurando reproductor: ' + err.message);
        setAudioUrl(null);
      }
    }

    fetchAudioUrl();
  }, [selectedCall, getSignedUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    console.log('🎵 Configurando audio MP3 con URL:', audioUrl);
    
    setError(null);
    setIsLoading(true);

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const updateDuration = () => {
      console.log('⏱️ Duración cargada:', audio.duration);
      setDuration(audio.duration);
      setIsLoading(false);
    };
    
    const handleLoadStart = () => {
      console.log('📡 Iniciando carga del audio MP3');
      setIsLoading(true);
    };
    
    const handleCanPlay = () => {
      console.log('✅ Audio MP3 listo para reproducir');
      setIsLoading(false);
    };
    
    const handleEnded = () => {
      console.log('🔚 Audio terminado');
      setIsPlaying(false);
    };
    
    const handleError = (e) => {
      console.error('❌ Error en el audio:', e);
      console.error('❌ Detalles del error:', {
        error: audio.error,
        networkState: audio.networkState,
        readyState: audio.readyState,
        src: audio.src
      });
      
      let errorMessage = 'Error desconocido';
      if (audio.error) {
        switch (audio.error.code) {
          case 1:
            errorMessage = 'Carga de audio abortada por el usuario';
            break;
          case 2:
            errorMessage = 'Error de red - Verifica tu conexión';
            break;
          case 3:
            errorMessage = 'Error de decodificación - Problema con el formato de audio';
            break;
          case 4:
            errorMessage = 'Formato de audio no soportado - Contacta al administrador';
            break;
          default:
            errorMessage = `Error ${audio.error.code}: ${audio.error.message}`;
        }
      }
      
      setError(errorMessage);
      setIsLoading(false);
    };

    const handleProgress = () => {
      console.log('📈 Progreso de carga...');
    };

    // Event listeners
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('progress', handleProgress);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('progress', handleProgress);
    };
  }, [audioUrl]);

  const togglePlay = async () => {
    if (!audioRef.current) return;
    
    try {
      if (isPlaying) {
        console.log('⏸️ Pausando audio');
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        console.log('▶️ Reproduciendo audio MP3');
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('❌ Error al reproducir:', error);
      if (error.name === 'NotAllowedError') {
        setError('Error: El navegador requiere interacción del usuario para reproducir audio');
      } else {
        setError(`Error de reproducción: ${error.message}`);
      }
    }
  };

  const handleSeek = (e) => {
    if (!audioRef.current || !duration) return;
    const clickX = e.nativeEvent.offsetX;
    const width = e.currentTarget.offsetWidth;
    const newTime = (clickX / width) * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const skipForward = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.min(currentTime + 10, duration);
  };

  const skipBackward = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(currentTime - 10, 0);
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const openInNewTab = () => {
    if (audioUrl) {
      window.open(audioUrl, '_blank');
    }
  };

  const downloadAudio = () => {
    if (audioUrl) {
      const link = document.createElement('a');
      link.href = audioUrl;
      link.download = `${selectedCall.ID_LLAMADA}.mp3`; // ✅ Cambió a MP3
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

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
          <span>Reproductor de Audio MP3</span>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Audio element con mejor compatibilidad para MP3 */}
        {audioUrl && (
          <audio 
            ref={audioRef} 
            preload="metadata"
            controls={false}
          >
            <source src={audioUrl} type="audio/mpeg" />
            <source src={audioUrl} type="audio/mp3" />
            <source src={audioUrl} type="audio/wav" />
            <source src={audioUrl} type="audio/ogg" />
            Tu navegador no soporta la reproducción de audio.
          </audio>
        )}

        {/* Estados de carga y error */}
        {isLoading && (
          <div className="text-center text-sm text-blue-500">
            📡 Convirtiendo y cargando audio desde Google Cloud Storage...
          </div>
        )}
        
        {error && (
          <div className="text-center text-sm text-red-500 bg-red-50 p-3 rounded">
            <div className="font-semibold mb-2">❌ {error}</div>
            <div className="text-xs mb-3">
              💡 El audio se está convirtiendo de WAV a MP3 para mejor compatibilidad
            </div>
            <div className="mt-2 space-x-2">
              {audioUrl && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={openInNewTab}
                  >
                    🔗 Abrir enlace
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={downloadAudio}
                    className="bg-green-50 hover:bg-green-100"
                  >
                    📥 Descargar MP3
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(audioUrl);
                      alert('URL copiada');
                    }}
                  >
                    📋 Copiar URL
                  </Button>
                </>
              )}
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
                {isLoading ? 'Convirtiendo a MP3...' : error ? 'Error' : audioUrl ? 'MP3 Listo' : 'Configurando...'}
              </span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t">
            <div><strong>Duración:</strong> {formatTime(duration)}</div>
            <div><strong>Formato:</strong> 
              <span className="text-green-600 ml-1">🎵 MP3 (Convertido desde WAV)</span>
            </div>
            {audioUrl && (
              <div><strong>Acceso:</strong> 
                <span className="text-green-600 ml-1">✅ Autorizado</span>
              </div>
            )}
          </div>
        </div>

        {/* Controles de reproducción */}
        <div className="space-y-3">
          {/* Barra de progreso */}
          <div className="space-y-1">
            <div 
              className="w-full h-2 bg-gray-200 rounded-full cursor-pointer hover:h-3 transition-all"
              onClick={handleSeek}
            >
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-150"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Botones de control */}
          <div className="flex items-center justify-center space-x-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={skipBackward}
              disabled={!duration}
              className="hover:bg-gray-100"
            >
              <SkipBack className="w-4 h-4" />
              <span className="ml-1 text-xs">10s</span>
            </Button>
            
            <Button 
              onClick={togglePlay}
              disabled={isLoading || error || !audioUrl}
              className="w-14 h-14 rounded-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300"
            >
              {isPlaying ? 
                <Pause className="w-6 h-6 text-white" /> : 
                <Play className="w-6 h-6 text-white ml-1" />
              }
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={skipForward}
              disabled={!duration}
              className="hover:bg-gray-100"
            >
              <span className="mr-1 text-xs">10s</span>
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>

          {/* Control de volumen */}
          <div className="flex items-center space-x-3 px-4">
            <Volume2 className="w-4 h-4 text-gray-500" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer hover:bg-gray-300"
            />
            <span className="text-xs text-gray-500 w-10 text-right">{Math.round(volume * 100)}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}