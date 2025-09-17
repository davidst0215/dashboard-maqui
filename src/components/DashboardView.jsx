// src/components/DashboardView.jsx
import { useState, useEffect } from 'react';
import { useDashboard } from '../hooks/useDashboard';
import * as XLSX from 'xlsx';
import { SSF } from 'xlsx';

import { KpiCards } from './dashboard/KpiCards';
import { DashboardFilters } from './dashboard/DashboardFilters';
import { SegmentPieChart } from './dashboard/SegmentPieChart';
import { DailyCallsChart } from './dashboard/DailyCallsChart';
import { TeamPerformance } from './dashboard/TeamPerformance';
import { DniReport } from './dashboard/DniReport';
import { ExportReport } from './dashboard/ExportReport';
import { SummaryTable } from './dashboard/SummaryTable';
import { useAuth } from '../components/auth/LoginComponent';

function DashboardView() {
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    period: '',
    segment: '',
    submanager: '',
    supervisor: '',
    advisor: '',
    dni: ''
  });

  const BACKEND_URL = 'https://dashboard-backend-919351372784.europe-west1.run.app';
  
  const fetchData = async () => {
  try {
    console.log('🔍 Iniciando carga desde BigQuery API...');

    // Obtener token de autenticación
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('❌ No hay token de autenticación');
      setLoading(false);
      return;
    }

    const response = await fetch(`${BACKEND_URL}/api/dashboard/data`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📊 Response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Respuesta API:', result);

    if (result.success && result.data) {
      console.log('✅ Datos BigQuery cargados:', result.data.length, 'filas');
      console.log('🔍 Primera fila:', result.data[0]);

      // Convertir formato BigQuery a formato esperado por el frontend
      const formattedData = result.data.map(item => ({
        DNI: item.dni,
        CATEGORÍA: item.categoria,
        CONFORMIDAD: item.conformidad,
        PUNTUACIÓN_TOTAL: item.puntuacion_total,
        PUNTUACIÓN_IDENTIFICACIÓN: item.puntuacion_identificacion,
        PUNTUACIÓN_VERIFICACIÓN: item.puntuacion_verificacion,
        PUNTUACIÓN_CONTEXTUALIZACIÓN: item.puntuacion_contextualizacion,
        PUNTUACIÓN_CONSULTA_DUDAS: item.puntuacion_consulta_dudas,
        PUNTUACIÓN_SENTIMIENTOS: item.puntuacion_sentimientos,

        // Datos enriquecidos de Validacion_Ventas
        NOMBRE: item.Nombre || 'No disponible',
        SUBGERENTE: item.Gestor || 'No asignado',
        SUPERVISOR: item.Supervisor || 'No asignado',
        VENDEDOR: item.Vendedor || 'No asignado',
        RESULTADO_VAL1: item.ResultadoVal1 || 'Sin validación',
        RESULTADO_VAL2: item.ResultadoVal2 || 'Sin validación',
        MONTO_CANCELADO: item.MontoCancelado || 0,
        FECHA_VALIDACION: item.fecha_validacion,

        FECHA_LLAMADA: item.fecha_llamada,
        AUDIO_URL: item.audio_url,
        COMENTARIOS: item.comentarios
      }));

      setAllData(formattedData);
    } else {
      console.error('❌ Error en respuesta API:', result);
    }
  } catch (error) {
    console.error("❌ Error al cargar los datos desde BigQuery:", error);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
  fetchData(); // Usa la función que ya tienes configurada correctamente
}, []);

  const handleFilterChange = (key, value) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value };
      if (key === 'submanager') {
        newFilters.supervisor = '';
        newFilters.advisor = '';
      }
      if (key === 'supervisor') {
        newFilters.advisor = '';
      }
      return newFilters;
    });
  };

  const {
    processedAllData, // <-- Necesitamos esta variable para la exportación
    filteredData,
    conformeCount,
    noConformeCount,
    segmentCounts,
    dailyData,
    teamPerformanceData,
    uniqueValues,
    dniResults
  } = useDashboard(allData, filters);

  const { user } = useAuth();

  const UserMenu = () => {
  const { logout, user } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="bg-slate-600/50 border border-slate-500/50 hover:bg-slate-600/70 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2"
      >
        <span>👤</span>
        <span className="hidden sm:inline">{user?.role}</span>
        <span className="text-xs">▼</span>
      </button>
      
      {showMenu && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-10 overflow-hidden">
          <div className="p-3 bg-gray-50 border-b">
            <p className="text-sm font-medium text-gray-900">{user?.email}</p>
            <p className="text-xs text-slate-600 font-medium">{user?.role}</p>
            {user?.name && (
              <p className="text-xs text-gray-500">{user.name}</p>
            )}
          </div>
          <div className="p-1">
            <button
              onClick={() => {
                setShowMenu(false);
                logout();
              }}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded flex items-center space-x-2 transition-colors"
            >
              <span>🚪</span>
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
  
  if (loading) {
    return <div className="flex items-center justify-center h-screen">Cargando datos...</div>;
  }
  
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 text-white shadow-lg">
  <div className="flex justify-between items-center max-w-7xl mx-auto px-4 h-16">
    
    {/* Logo y app */}
    <div className="flex items-center space-x-6">
      <div className="flex items-center space-x-3">
        
        <div className="flex items-center">
  <h1 className="text-teal-400 font-semibold text-2xl tracking-tight">maqui</h1>
  <span className="text-red-500 font-bold text-lg relative -top-1">+</span>
</div>
      </div>
      
      <div className="bg-slate-600/50 backdrop-blur-sm border border-slate-500/50 px-4 py-2 rounded-lg">
        <span className="text-slate-200 font-medium text-sm"> Calidad de venta</span>
      </div>
    </div>

    {/* Usuario integrado */}
    <div className="flex items-center space-x-4">
      {user && (
        <>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-slate-600/30 backdrop-blur-sm px-3 py-1.5 rounded-full border border-slate-500/30">
              <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
              <span className="text-slate-300 text-sm font-medium">
                {user?.name || user?.email}
              </span>
            </div>
            <span className="text-slate-400 text-sm">{user?.role}</span>
          </div>
          <UserMenu />
        </>
      )}
    </div>
  </div>
</div>
      
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        <DashboardFilters filters={filters} onFilterChange={handleFilterChange} uniqueValues={uniqueValues} />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <KpiCards conforme={conformeCount} noConforme={noConformeCount} />
          <SegmentPieChart data={segmentCounts} />
        </div>

        <DailyCallsChart data={dailyData} />
        <TeamPerformance data={teamPerformanceData} />
        <DniReport dni={filters.dni} onDniChange={(value) => handleFilterChange('dni', value)} results={dniResults} />
        
        {/* Pasamos los datos pre-procesados al componente de exportación */}
        <ExportReport processedAllData={processedAllData} uniqueValues={uniqueValues} />
        
        <SummaryTable data={filteredData} />
      </div>
    </div>
  );
}

export default DashboardView;