// src/hooks/useDashboardCloud.js - Hook para datos desde Cloud API
import { useState, useEffect, useMemo } from 'react';
import { API_CONFIG, buildApiUrl } from '../config/api';

const categoryMap = {
  'MUY BUENA': 'Muy Buena',
  'BUENA': 'Buena', 
  'MEDIA': 'Media',
  'MALA': 'Mala',
  'PENDIENTE': 'Pendiente'
};

// Hook principal para cargar datos desde la API Cloud
export function useDashboardCloud() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [performance, setPerformance] = useState(null);

  // Cargar datos desde la nueva API
  useEffect(() => {
    console.log('🔥 USEEFFECT EJECUTÁNDOSE - useDashboardCloud');
    loadCloudData();
  }, []);

  const loadCloudData = async () => {
    try {
      console.log('🔄🔄🔄 INICIANDO loadCloudData...');
      console.log('⏰ Timestamp:', new Date().toISOString());
      setLoading(true);
      setError(null);

      // Obtener token de auth
      const token = localStorage.getItem('auth_token');
      console.log('🔑🔑🔑 Token encontrado:', token ? 'SÍ' : 'NO');
      console.log('🔑 Token length:', token?.length || 0);
      console.log('🔑 Token preview:', token?.substring(0, 20) + '...' || 'NULL');

      if (!token) {
        console.log('❌❌❌ NO HAY TOKEN - Abortando carga');
        throw new Error('No authenticated');
      }

      console.log('🌐🌐🌐 Haciendo fetch a BigQuery API...');
      const apiUrl = buildApiUrl(API_CONFIG.ENDPOINTS.DASHBOARD_DATA, { dias: 90 });
      console.log('🎯 URL:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡📡📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);
      console.log('📡 Response statusText:', response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌❌❌ Response error text:', errorText);
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      console.log('🔍🔍🔍 RESPUESTA COMPLETA DEL BACKEND:', result);
      console.log('🔍 result.success:', result.success);
      console.log('🔍 result.data type:', typeof result.data);
      console.log('🔍 result.data length:', result.data?.length || 'NULL');
      console.log('🔍 result.total:', result.total);
      console.log('🔍 Primer registro:', result.data?.[0] || 'NULL');
      
      if (!result.success) {
        console.log('❌❌❌ Backend reportó error:', result.error);
        throw new Error(result.error || 'Error desconocido');
      }

      console.log(`✅✅✅ Datos cargados exitosamente: ${result.total} registros`);
      console.log(`📊 Fuente: ${result.source}`);
      if (result.performance) {
        console.log(`📈 Performance: ${result.performance.processed_from_analysis} procesados, ${result.performance.pending_analysis} pendientes`);
      }
      
      console.log('💾💾💾 Guardando datos en state...');
      setData(result.data);
      setPerformance(result.performance);
      console.log('💾 State actualizado - data length:', result.data?.length);
      
    } catch (err) {
      console.error('❌ Error cargando datos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Función para refrescar datos manualmente
  const refreshData = () => {
    loadCloudData();
  };

  return {
    data,
    loading,
    error,
    performance,
    refreshData
  };
}

// Hook público para cargar datos sin autenticación
export function useDashboardPublic() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [performance, setPerformance] = useState(null);

  // Cargar datos desde la API pública
  useEffect(() => {
    console.log('🌍 USEEFFECT EJECUTÁNDOSE - useDashboardPublic (sin auth)');
    loadPublicData();
  }, []);

  const loadPublicData = async () => {
    try {
      console.log('🔄🔄🔄 INICIANDO loadPublicData (sin autenticación)...');
      console.log('⏰ Timestamp:', new Date().toISOString());
      setLoading(true);
      setError(null);

      console.log('🌐🌐🌐 Haciendo fetch a API pública...');
      const apiUrl = buildApiUrl('/api/dashboard/public', { dias: 90 });
      console.log('🎯 URL pública:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('📡📡📡 Response status (público):', response.status);
      console.log('📡 Response ok:', response.ok);
      console.log('📡 Response statusText:', response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌❌❌ Response error text:', errorText);
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      console.log('🔍🔍🔍 RESPUESTA COMPLETA DEL BACKEND PÚBLICO:', result);
      console.log('🔍 result.success:', result.success);
      console.log('🔍 result.data type:', typeof result.data);
      console.log('🔍 result.data length:', result.data?.length || 'NULL');
      console.log('🔍 result.total:', result.total);
      console.log('🔍 Primer registro:', result.data?.[0] || 'NULL');

      if (!result.success) {
        console.log('❌❌❌ Backend reportó error:', result.error);
        throw new Error(result.error || 'Error desconocido');
      }

      console.log(`✅✅✅ Datos cargados exitosamente (público): ${result.total} registros`);
      console.log(`📊 Fuente: ${result.source}`);
      if (result.performance) {
        console.log(`📈 Performance: ${result.performance.processed_from_analysis} procesados, ${result.performance.pending_analysis} pendientes`);
      }

      console.log('💾💾💾 Guardando datos en state...');
      setData(result.data);
      setPerformance(result.performance);
      console.log('💾 State actualizado - data length:', result.data?.length);

    } catch (err) {
      console.error('❌ Error cargando datos públicos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Función para refrescar datos manualmente
  const refreshData = () => {
    loadPublicData();
  };

  return {
    data,
    loading,
    error,
    performance,
    refreshData
  };
}

// Hook para procesar datos con filtros (compatible con el hook anterior)
export function useProcessedDashboard(cloudData, filters) {
  
  const processedAllData = useMemo(() => {
    if (!cloudData) return [];
    
    return cloudData.map(item => ({
      // Mapear campos del backend (ya con nomenclatura corregida) al formato UI
      DNI: item.dni,
      NOMBRE_CLIENTE: item.nombre_cliente,
      CATEGORÍA: item.categoria,  // Ya estandarizada en 4 niveles
      PUNTUACION_TOTAL: item.puntuacion_total,
      CONFORMIDAD: item.conformidad,  // Ya estandarizada: Conforme/No Conforme
      COMENTARIO: item.comentarios,  // Corregido: comentarios (plural)
      TRANSCRIPCION: item.transcripcion_texto || 'Transcripción no disponible',  // AGREGADO: Campo de transcripción
      
      // NOMENCLATURA REAL (datos desde tablas auxiliares)
      SUBGERENTE: item.subgerente || 'Sin Subgerente',
      SUPERVISOR: item.supervisor || 'Sin Supervisor',
      VENDEDOR: item.asesor_ventas || 'Sin Asesor',
      GERENCIA: item.gerencia || 'Sin Gerencia',
      RESULTADO_VALIDACION: item.resultado_validacion || 'Sin resultado',
      
      FECHA_LLAMADA: item.fecha_llamada,
      FECHA_LLAMADA_STR: formatearFecha(item.fecha_llamada),
      ID_AUDIO: item.audio_url,  // Backend ya envía como 'audio_url'
      
      // Campos de puntuación individual (ahora deberían tener valores reales)
      IDENTIFICACION_P: item.puntuacion_identificacion || 0,
      VERIFICACION_P: item.puntuacion_verificacion || 0,
      CONTEXTUALIZACION_P: item.puntuacion_contextualizacion || 0,
      SENTIMIENTOS_P: item.puntuacion_sentimientos || 0
    }));
  }, [cloudData]);

  const uniqueValues = useMemo(() => {
    if (!processedAllData || processedAllData.length === 0) {
      return { periods: [], segments: [], subgerentes: [], supervisores: [], vendedores: [], gerencias: [] };
    }
    
    const periodsSet = new Set();
    processedAllData.forEach(d => {
      if (d.FECHA_LLAMADA_STR) {
        const parts = d.FECHA_LLAMADA_STR.split('/');
        if (parts.length === 3) {
          const year = parts[2];
          const month = String(parts[1]).padStart(2, '0');
          periodsSet.add(`${year}-${month}`);
        }
      }
    });

    const periods = Array.from(periodsSet).sort((a,b) => b.localeCompare(a));
    const segments = Object.values(categoryMap);
    const subgerentes = [...new Set(processedAllData.map(d => d.SUBGERENTE).filter(Boolean))];

    let availableForSupervisors = processedAllData;
    if (filters.submanager) {
      availableForSupervisors = processedAllData.filter(d => d.SUBGERENTE === filters.submanager);
    }
    const supervisores = [...new Set(availableForSupervisors.map(d => d.SUPERVISOR).filter(Boolean))];

    let availableForVendedores = processedAllData;
    if (filters.submanager) {
      availableForVendedores = availableForVendedores.filter(d => d.SUBGERENTE === filters.submanager);
    }
    if (filters.supervisor) {
      availableForVendedores = availableForVendedores.filter(d => d.SUPERVISOR === filters.supervisor);
    }
    const vendedores = [...new Set(availableForVendedores.map(d => d.VENDEDOR).filter(Boolean))];
    
    // NUEVO: Obtener gerencias únicas
    const gerencias = [...new Set(processedAllData.map(d => d.GERENCIA).filter(Boolean))];
    
    return { periods, segments, subgerentes, supervisores, vendedores, gerencias };
  }, [processedAllData, filters.submanager, filters.supervisor]);

  const processedData = useMemo(() => {
    if (!processedAllData || processedAllData.length === 0) {
      return { filteredData: [], conformeCount: 0, noConformeCount: 0, segmentCounts: {}, dailyData: [], teamPerformanceData: {} };
    }

    const filteredData = processedAllData.filter(item => {
      if (!item.FECHA_LLAMADA_STR) return false;

      const itemDateParts = item.FECHA_LLAMADA_STR.split('/');
      const itemPeriod = `${itemDateParts[2]}-${String(itemDateParts[1]).padStart(2, '0')}`;
      
      const periodMatch = filters.period ? itemPeriod === filters.period : true;
      const segmentMatch = filters.segment ? (categoryMap[item.CATEGORÍA] === filters.segment) : true;
      const submanagerMatch = filters.submanager ? item.SUBGERENTE === filters.submanager : true;
      const supervisorMatch = filters.supervisor ? item.SUPERVISOR === filters.supervisor : true;
      const advisorMatch = filters.advisor ? item.VENDEDOR === filters.advisor : true;
      const gerenciaMatch = filters.gerencia ? item.GERENCIA === filters.gerencia : true;

      return periodMatch && segmentMatch && submanagerMatch && supervisorMatch && advisorMatch && gerenciaMatch;
    });

    const conformeCount = filteredData.filter(d => d.CONFORMIDAD === 'Conforme').length;
    const noConformeCount = filteredData.length - conformeCount;

    const segmentCounts = filteredData.reduce((acc, item) => {
      const segment = categoryMap[item.CATEGORÍA] || 'Sin categoría';
      acc[segment] = (acc[segment] || 0) + 1;
      return acc;
    }, {});
    
    const teamPerformanceData = filteredData.reduce((acc, item) => {
      const subgerente = item.SUBGERENTE || 'Sin subgerente';
      if (!acc[subgerente]) {
        acc[subgerente] = { total: 0, conforme: 0 };
      }
      acc[subgerente].total++;
      if (item.CONFORMIDAD === 'Conforme') {
        acc[subgerente].conforme++;
      }
      return acc;
    }, {});

    let dailyData = [];
    if (filters.period) {
      const daysInMonth = new Date(filters.period.split('-')[0], filters.period.split('-')[1], 0).getDate();
      dailyData = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, conforme: 0, noConforme: 0 }));

      filteredData.forEach(item => {
        if (item.FECHA_LLAMADA_STR) {
          const day = parseInt(item.FECHA_LLAMADA_STR.split('/')[0]);
          if(dailyData[day - 1]) {
            if (item.CONFORMIDAD === 'Conforme') dailyData[day - 1].conforme++;
            else dailyData[day - 1].noConforme++;
          }
        }
      });
    }

    return { filteredData, conformeCount, noConformeCount, segmentCounts, dailyData, teamPerformanceData };
  }, [processedAllData, filters]);
  
  const dniResults = useMemo(() => {
    if (!processedAllData || !filters.dni || filters.dni.length < 1) return [];
    return processedAllData.filter(item => String(item.DNI).includes(filters.dni));
  }, [processedAllData, filters.dni]);

  return { processedAllData, ...processedData, uniqueValues, dniResults };
}

// Función helper para formatear fechas
function formatearFecha(fechaStr) {
  if (!fechaStr) return null;
  
  try {
    const fecha = new Date(fechaStr);
    const day = String(fecha.getDate()).padStart(2, '0');
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const year = fecha.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.warn('Error formateando fecha:', fechaStr, error);
    return null;
  }
}