// AudioPlayer.jsx - Versión corregida
import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { useAuth } from '../auth/LoginComponent';

export function AudioPlayer({ selectedCall, onClose }) {
  const auth = useAuth();
  const token = auth.token || auth.accessToken || auth.authToken;
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const audioRef = useRef(null);
  
  // API base URL - Asegúrate de que esta URL sea correcta
  const API_BASE_URL = "https://quality-dashboard-api-919351372784.europe-west1.run.app";

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
        // MÉTODO 1: Usar el endpoint de streaming directo
        if (selectedCall.ID_AUDIO.startsWith('gs://')) {
          const audioPath = selectedCall.ID_AUDIO.replace('gs://buckets_llamadas/', '');
          const streamUrl = `${API_BASE_URL}/api/audio/stream/${audioPath}`;
          
          setAudioUrl(streamUrl);
          console.log('✅ URL de streaming configurada:', streamUrl);
        } 
        // MÉTODO 2: Generar URL firmada usando el endpoint API
        else if (token) {
          setIsConverting(true);
          const response = await fetch(`${API_BASE_URL}/api/audio/signed-url`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              gsPath: selectedCall.ID_AUDIO
            })
          });
          
          const data = await response.json();
          
          if (data.success && data.signed_url) {
            setAudioUrl(data.signed_url);
            console.log('✅ URL firmada generada:', data.signed_url);
          } else {
            throw new Error(data.error || 'Error generando URL firmada');
          }
          setIsConverting(false);
        }
        // Si no tenemos ninguna de las opciones anteriores
        else {
          throw new Error('No se pudo determinar la URL del audio. Formato no soportado.');
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
  }, [selectedCall, token]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    console.log('🎵 Configurando audio con URL:', audioUrl);
    
    // Reset the audio element
    audio.pause();
    audio.src = audioUrl;
    audio.load();
    
    setError(null);
    setIsLoading(true);

    const handleEvents = {
      loadstart: () => {
        console.log('📡 Iniciando carga del audio');
        setIsLoading(true);
      },
      loadedmetadata: () => {
        console.log('⏱️ Metadatos cargados. Duración:', audio.duration);
        if (!isNaN(audio.duration)) {
          setDuration(audio.duration);
        } else {
          console.warn('⚠️ Duración es NaN - problema común con WAV');
          // Algunos archivos WAV no tienen duración en metadatos
          // Pero aún pueden reproducirse correctamente
        }
      },
      canplay: () => {
        console.log('✅ Audio listo para reproducir');
        setIsLoading(false);
      },
      playing: () => {
        console.log('▶️ Audio reproduciendo');
        setIsPlaying(true);
      },
      pause: () => {
        console.log('⏸️ Audio pausado');
        setIsPlaying(false);
      },
      ended: () => {
        console.log('🔚 Audio terminado');
        setIsPlaying(false);
      },
      timeupdate: () => {
        setCurrentTime(audio.currentTime);
      },
      error: (e) => {
        const errorDetails = {
          code: audio.error?.code,
          message: audio.error?.message,
          networkState: audio.networkState,
          readyState: audio.readyState
        };
        
        console.error('❌ Error en el audio:', errorDetails);
        
        let errorMessage = 'Error desconocido';
        if (audio.error) {
          switch (audio.error.code) {
            case 1: errorMessage = 'Carga abortada por el usuario'; break;
            case 2: errorMessage = 'Error de red - Verifica tu conexión'; break;
            case 3: errorMessage = 'Error de decodificación - Problema con el formato'; break;
            case 4: errorMessage = 'Formato no soportado o recurso no encontrado'; break;
            default: errorMessage = `Error ${audio.error.code}: ${audio.error.message}`;
          }
        }
        
        setError(errorMessage);
        setIsLoading(false);
      }
    };

    // Registrar todos los event listeners
    Object.entries(handleEvents).forEach(([event, handler]) => {
      audio.addEventListener(event, handler);
    });

    // Limpiar event listeners
    return () => {
      Object.entries(handleEvents).forEach(([event, handler]) => {
        audio.removeEventListener(event, handler);
      });
    };
  }, [audioUrl]);

  const togglePlay = async () => {
    if (!audioRef.current) return;
    
    try {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        // Antes de reproducir, verificamos si el audio está cargado
        if (audioRef.current.readyState === 0) {
          console.log('🔄 Recargando audio antes de reproducir');
          audioRef.current.load();
        }
        
        console.log('▶️ Iniciando reproducción');
        await audioRef.current.play();
      }
    } catch (error) {
      console.error('❌ Error al reproducir:', error);
      setError(`Error: ${error.name === 'NotAllowedError' 
        ? 'El navegador requiere interacción del usuario para reproducir audio' 
        : error.message}`);
    }
  };

  const handleSeek = (e) => {
    if (!audioRef.current) return;
    const clickX = e.nativeEvent.offsetX;
    const width = e.currentTarget.offsetWidth;
    const seekTime = (clickX / width) * (duration || audioRef.current.duration || 0);
    
    if (isNaN(seekTime)) {
      console.warn('⚠️ No se puede buscar - duración desconocida');
      return;
    }
    
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const skipForward = () => {
    if (!audioRef.current) return;
    const newTime = currentTime + 10;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const skipBackward = () => {
    if (!audioRef.current) return;
    const newTime = Math.max(currentTime - 10, 0);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
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
      // Obtener solo el nombre del archivo de la URL del audio
      const fileName = selectedCall.ID_LLAMADA || 'audio-llamada';
      link.download = `${fileName}.wav`;
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
          <span>Reproductor de Audio</span>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Audio element - Configurado para WAV pero con fallbacks */}
        <audio 
          ref={audioRef} 
          preload="metadata"
          controls={false}
          crossOrigin="anonymous"
        >
          <source src={audioUrl} type="audio/wav" />
          <source src={audioUrl} type="audio/mpeg" />
          <source src={audioUrl} type="audio/mp3" />
          Tu navegador no soporta la reproducción de audio.
        </audio>

        {/* Estados de carga y error */}
        {isLoading && (
          <div className="text-center text-sm text-blue-500">
            {isConverting 
              ? '🔄 Generando URL firmada desde Google Cloud Storage...' 
              : '📡 Cargando audio desde servidor...'}
          </div>
        )}
        
        {error && (
          <div className="text-center text-sm text-red-500 bg-red-50 p-3 rounded">
            <div className="font-semibold mb-2">❌ {error}</div>
            <div className="text-xs mb-3">
              💡 Intenta verificar la conexión o usa las opciones alternativas
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
                    📥 Descargar WAV
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
                {isLoading ? 'Cargando...' : error ? 'Error' : audioUrl ? 'Listo' : 'Configurando...'}
              </span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t">
            <div><strong>Duración:</strong> {formatTime(duration)} {isNaN(duration) && '(estimada)'}</div>
            <div><strong>Formato:</strong> 
              <span className="text-green-600 ml-1">🎵 WAV</span>
            </div>
            {audioUrl && !error && (
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
                style={{ width: `${(duration && !isNaN(duration)) ? (currentTime / duration) * 100 : 0}%` }}
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
              disabled={!audioUrl || error}
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
              disabled={!audioUrl || error}
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