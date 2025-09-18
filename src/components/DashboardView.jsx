// src/components/DashboardView.jsx - Con datos Cloud
import { useState } from 'react';
import { useProcessedDashboard } from '../hooks/useDashboardCloud';
import { useAuth } from './auth/LoginComponent';

import { KpiCards } from './dashboard/KpiCards';
import { DashboardFilters } from './dashboard/DashboardFilters';
import { SegmentPieChart } from './dashboard/SegmentPieChart';
import { DailyCallsChart } from './dashboard/DailyCallsChart';
import { TeamPerformance } from './dashboard/TeamPerformance';
import { DniReport } from './dashboard/DniReport';
import { ExportReport } from './dashboard/ExportReport';
import { SummaryTable } from './dashboard/SummaryTable';

function DashboardView({ cloudData, refreshData }) {

  const [filters, setFilters] = useState({
    period: '',
    segment: '',
    submanager: '',
    supervisor: '',
    advisor: '',
    gerencia: '',
    dni: ''
  });

  // YA NO NECESITAMOS fetchData ni Excel - los datos vienen desde cloudData prop

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

  // Usar el nuevo hook que procesa datos Cloud
  const {
    processedAllData,
    filteredData,
    conformeCount,
    noConformeCount,
    segmentCounts,
    dailyData,
    teamPerformanceData,
    uniqueValues,
    dniResults
  } = useProcessedDashboard(cloudData, filters);

  const { user, logout } = useAuth();

  console.log('📊 Datos Cloud recibidos:', cloudData?.length || 0, 'registros');

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 text-white shadow-lg">
        <div className="flex justify-between items-center max-w-7xl mx-auto px-4 h-16">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <div className="flex items-center">
                <h1 className="text-teal-400 font-semibold text-2xl tracking-tight">maqui</h1>
                <span className="text-red-500 font-bold text-lg relative -top-1">+</span>
              </div>
            </div>
            <div className="bg-slate-600/50 backdrop-blur-sm border border-slate-500/50 px-4 py-2 rounded-lg">
              <span className="text-slate-200 font-medium text-sm">Calidad de venta</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 bg-slate-600/30 backdrop-blur-sm px-3 py-1.5 rounded-full border border-slate-500/30">
                <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                <span className="text-slate-300 text-sm font-medium">{user?.name || user?.email}</span>
              </div>
              <span className="text-slate-400 text-sm">{user?.role}</span>
              <button
                onClick={logout}
                className="bg-red-600/80 hover:bg-red-600 text-white text-sm px-3 py-1.5 rounded-lg transition-colors duration-200 flex items-center space-x-1"
                title="Cerrar Sesión"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Salir</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        <DashboardFilters filters={filters} onFilterChange={handleFilterChange} uniqueValues={uniqueValues} />
        
        {processedAllData && processedAllData.length > 0 ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <KpiCards conforme={conformeCount} noConforme={noConformeCount} />
              <SegmentPieChart data={segmentCounts} />
            </div>

            <DailyCallsChart data={dailyData} />
            <TeamPerformance data={teamPerformanceData} />
            <DniReport dni={filters.dni} onDniChange={(value) => handleFilterChange('dni', value)} results={dniResults} />
            
            <ExportReport processedAllData={processedAllData} uniqueValues={uniqueValues} />
            
            <SummaryTable data={filteredData} />
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="mb-6">
              <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No hay datos disponibles</h3>
            <p className="text-gray-600 mb-4">
              No se encontraron registros de análisis de calidad para su perfil de usuario.
            </p>
            <p className="text-sm text-gray-500">
              {user?.role === 'gerente' 
                ? `Datos filtrados para la gerencia: ${user?.gerencia}` 
                : 'Verifica los filtros o contacta al administrador si esperabas ver datos aquí.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardView;