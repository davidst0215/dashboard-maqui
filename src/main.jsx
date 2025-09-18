// src/main.jsx - Con autenticación integrada y datos BigQuery
import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider, LoginComponent, useAuth } from './components/auth/LoginComponent'
import DashboardView from './components/DashboardView'
import { useDashboardCloud } from './hooks/useDashboardCloud'
import './index.css'

// Componente que maneja el login + dashboard
function App() {
  const { isAuthenticated } = useAuth();
  
  console.log('🏠🏠🏠 MAIN.JSX App renderizado - isAuthenticated:', isAuthenticated);
  
  // Hook para datos de BigQuery (se ejecuta siempre)
  const { data, loading, error, refreshData } = useDashboardCloud();
  
  console.log('📊📊📊 MAIN.JSX Hook useDashboardCloud resultado:');
  console.log('  🔢 Data length:', data?.length || 'NULL/UNDEFINED');
  console.log('  🔄 Loading:', loading);
  console.log('  ❌ Error:', error || 'null');

  // Si no está autenticado, mostrar login
  if (!isAuthenticated) {
    return <LoginComponent />;
  }

  // Si está cargando datos desde Cloud
  if (loading) {
    console.log('🔄🔄🔄 MAIN.JSX MOSTRANDO PANTALLA DE CARGA');
    return (
      <div className="min-h-screen bg-gray-100">
        <LoginComponent /> {/* Header con info del usuario */}
        <div className="flex items-center justify-center h-96">
          <div className="text-xl">
            🔄 Cargando datos desde Cloud Storage y BigQuery...
          </div>
        </div>
      </div>
    );
  }

  // Si hay error al cargar datos
  if (error) {
    console.log('❌❌❌ MAIN.JSX MOSTRANDO PANTALLA DE ERROR:', error);
    return (
      <div className="min-h-screen bg-gray-100">
        <LoginComponent /> {/* Header con info del usuario */}
        <div className="flex flex-col items-center justify-center h-96">
          <div className="text-xl text-red-600 mb-4">
            ❌ Error: {error}
          </div>
          <button 
            onClick={refreshData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            🔄 Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Si no hay datos
  if (!data || data.length === 0) {
    console.log('📊📊📊 MAIN.JSX MOSTRANDO PANTALLA "NO HAY DATOS"');
    return (
      <div className="min-h-screen bg-gray-100">
        <LoginComponent /> {/* Header con info del usuario */}
        <div className="flex flex-col items-center justify-center h-96">
          <div className="text-xl text-gray-600 mb-4">
            📊 No hay datos disponibles
          </div>
          <button 
            onClick={refreshData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            🔄 Recargar datos
          </button>
        </div>
      </div>
    );
  }

  // Si está autenticado y hay datos, mostrar dashboard completo
  console.log('🎉🎉🎉 MAIN.JSX RENDERIZANDO DASHBOARD CON DATOS!');
  console.log('  📊 Data length final:', data.length);
  
  return (
    <div>
      <LoginComponent /> {/* Header con info del usuario logueado */}
      <DashboardView cloudData={data} refreshData={refreshData} />
    </div>
  );
}

// Renderizar con el AuthProvider
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)