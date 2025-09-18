// config/api.js - Configuración centralizada de API

export const API_CONFIG = {
  // Base URL del backend
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3007',
  
  // Endpoints específicos
  ENDPOINTS: {
    DASHBOARD_DATA: '/api/dashboard/data',
    AUDIO_SIGNED_URL: '/api/audio/signed-url',
    AUDIO_STREAM: '/api/audio/stream',
    AUDIO_MP3: '/api/audio/mp3',
    AUTH: '/api/auth'
  },

  // Configuración para desarrollo local
  DEV: {
    CORS: {
      origin: 'http://localhost:5177',
      credentials: true
    }
  }
};

// Helper para construir URLs completas
export const buildApiUrl = (endpoint, params = {}) => {
  const url = new URL(endpoint, API_CONFIG.BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  return url.toString();
};

console.log('🔧 API Config loaded:', {
  baseUrl: API_CONFIG.BASE_URL,
  isDev: API_CONFIG.BASE_URL.includes('localhost')
});