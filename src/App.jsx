// src/App.jsx - Dashboard público sin autenticación
import React from 'react';
import DashboardView from './components/DashboardView';
import { useDashboardPublic } from './hooks/useDashboardCloud';

// Componente principal del dashboard público
function DashboardApp() {
  console.log('🌍🌍🌍 DashboardApp renderizado - Modo Público');

  // Hook para datos de BigQuery público (sin autenticación)
  const { data, loading, error, refreshData } = useDashboardPublic();
  console.log('📊📊📊 Hook useDashboardCloud RESULTADO COMPLETO:');
  console.log('  🔢 Data length:', data?.length || 'NULL/UNDEFINED');
  console.log('  🔄 Loading:', loading);
  console.log('  ❌ Error:', error || 'null');
  console.log('  📋 Data type:', typeof data);
  console.log('  🎯 Data preview:', data?.slice(0, 2) || 'NULL');
  console.log('  ✅ isAuthenticated:', isAuthenticated);

  // Si está cargando datos desde Cloud
  if (loading) {
    console.log('🔄🔄🔄 MOSTRANDO PANTALLA DE CARGA - Loading=true');
    return (
      <div className="min-h-screen bg-gray-100">
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
    console.log('❌❌❌ MOSTRANDO PANTALLA DE ERROR:', error);
    return (
      <div className="min-h-screen bg-gray-100">
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
    console.log('📊📊📊 MOSTRANDO PANTALLA "NO HAY DATOS"');
    console.log('  🔍 data:', data);
    console.log('  🔢 data.length:', data?.length);
    return (
      <div className="min-h-screen bg-gray-100">
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

  // Dashboard con datos Cloud - SIN EXCEL
  console.log('🎉🎉🎉 RENDERIZANDO DASHBOARD CON DATOS!');
  console.log('  📊 Data length final:', data.length);
  console.log('  🏆 Pasando a DashboardView:', { dataLength: data.length, hasRefresh: !!refreshData });
  
  return (
    <div className="min-h-screen bg-gray-100">
      <DashboardView cloudData={data} refreshData={refreshData} />
    </div>
  );
}

// App principal sin autenticación
function App() {
  return <DashboardApp />;
}

export default App;