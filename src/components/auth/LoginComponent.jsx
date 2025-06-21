// src/components/auth/LoginComponent.jsx
import React, { useState, createContext, useContext, useEffect } from 'react';

// 🔗 Configuración del backend (cambia aquí cuando quieras nueva URL)
const BACKEND_URL = 'https://quality-dashboard-api-919351372784.europe-west1.run.app';


console.log('🔗 Backend URL configurada:', BACKEND_URL);

// Context para manejar autenticación global
const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Provider de autenticación
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('auth_token'));
  const [loading, setLoading] = useState(true);

  // Verificar estado del backend (silencioso)
  const checkBackendHealth = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.ok;
    } catch (error) {
      console.error('❌ Error conectando al backend:', error);
      return false;
    }
  };

  // Verificar token al cargar
  useEffect(() => {
    const initAuth = async () => {
      console.log('🔐 Inicializando autenticación...');
      
      // Verificar backend de forma silenciosa
      const backendOk = await checkBackendHealth();
      
      if (!backendOk) {
        console.log('❌ Backend no disponible');
        setLoading(false);
        return;
      }

      // Si hay token, verificarlo
      if (token) {
        try {
          console.log('🔍 Verificando token existente...');
          const response = await fetch(`${BACKEND_URL}/api/auth/verify`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('✅ Token válido, usuario:', data.user);
            setUser(data.user);
          } else {
            console.log('❌ Token inválido, limpiando...');
            localStorage.removeItem('auth_token');
            setToken(null);
          }
        } catch (error) {
          console.error('❌ Error verificando token:', error);
          localStorage.removeItem('auth_token');
          setToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [token]);

  const login = async (email, password) => {
    try {
      console.log('🔐 Intentando login:', email);
      
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Login exitoso:', data.user);
        localStorage.setItem('auth_token', data.access_token);
        setToken(data.access_token);
        setUser(data.user);
        return { success: true };
      } else {
        console.log('❌ Login fallido:', data.message);
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('❌ Error en login:', error);
      return { 
        success: false, 
        message: `Error de conexión: ${error.message}` 
      };
    }
  };

  const logout = () => {
    console.log('🚪 Cerrando sesión...');
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  };

  const getSignedUrl = async (gsPath) => {
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    try {
      console.log('🎵 Solicitando URL firmada:', gsPath);
      
      const response = await fetch(`${BACKEND_URL}/api/audio/signed-url`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gsPath }),
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ URL firmada obtenida');
        return data.signed_url;
      } else {
        throw new Error(data.error || 'Error obteniendo URL firmada');
      }
    } catch (error) {
      console.error('❌ Error obteniendo URL firmada:', error);
      throw error;
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    getSignedUrl,
    isAuthenticated: !!user,
    checkBackendHealth
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ✨ Componente de Login LIMPIO
export const LoginComponent = () => {
  const { login, isAuthenticated, loading } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const result = await login(formData.email, formData.password);

    if (!result.success) {
      setError(result.message);
    }

    setIsLoading(false);
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Mostrar estado de carga inicial
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return null; // No mostrar nada cuando está autenticado
  }

  // ✨ Pantalla de login LIMPIA Y PROFESIONAL
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Acceso al Dashboard</h1>
            <p className="text-gray-600 mt-2">Sistema de Calidad de Ventas</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Correo electrónico
              </label>
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="usuario@empresa.com"
                required
                disabled={isLoading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 transition duration-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <input
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="••••••••"
                required
                disabled={isLoading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 transition duration-200"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// Menú de usuario logueado
export const UserMenu = () => {
  const { logout, user } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="bg-white border border-green-300 hover:bg-green-50 text-green-800 px-3 py-1 rounded text-sm transition duration-200"
      >
        👤 {user?.role}
      </button>
      
      {showMenu && (
        <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg z-10">
          <div className="p-3 border-b">
            <p className="text-sm font-medium">{user?.email}</p>
            <p className="text-xs text-gray-500">{user?.role}</p>
            {user?.name && (
              <p className="text-xs text-gray-400">{user.name}</p>
            )}
          </div>
          <div className="p-1">
            <button
              onClick={() => {
                setShowMenu(false);
                logout();
              }}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition duration-200"
            >
              🚪 Cerrar Sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
};