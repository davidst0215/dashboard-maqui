// src/hooks/useDashboard.js
import { useMemo } from 'react';
import { SSF } from 'xlsx';

const categoryMap = {
  'MUY BUENA': 'Excelente',
  'BUENA': 'Alto',
  'MEDIA': 'Medio',
  'MALA': 'Bajo',
  'MUY MALA': 'Muy bajo'
};

function excelDateToString(serial) {
  if (typeof serial !== 'number') return null;
  return SSF.format('dd/mm/yyyy', serial);
}

export function useDashboard(allData, filters) {

  const processedAllData = useMemo(() => {
    if (!allData) return [];
    return allData.map(item => ({
      ...item,
      CATEGORÍA: typeof item.CATEGORÍA === 'string' ? item.CATEGORÍA.trim() : item.CATEGORÍA,
      CONFORMIDAD: typeof item.CONFORMIDAD === 'string' ? item.CONFORMIDAD.trim() : item.CONFORMIDAD,
      FECHA_LLAMADA_STR: excelDateToString(item.FECHA_LLAMADA)
    }));
  }, [allData]);

  const uniqueValues = useMemo(() => {
    if (!processedAllData || processedAllData.length === 0) {
      return { periods: [], segments: [], subgerentes: [], supervisores: [], vendedores: [] };
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
    
    return { periods, segments, subgerentes, supervisores, vendedores };
  }, [processedAllData, filters.submanager, filters.supervisor]);

  const processedData = useMemo(() => {
    if (!processedAllData || processedAllData.length === 0) {
      return { filteredData: [], conformeCount: 0, noConformeCount: 0, segmentCounts: {}, dailyData: [], teamPerformanceData: {} };
    }

    const filteredData = processedAllData.filter(item => {
      // Si no hay fecha, la fila no debería ser parte de los cálculos principales
      if (!item.FECHA_LLAMADA_STR) return false;

      const itemDateParts = item.FECHA_LLAMADA_STR.split('/');
      const itemPeriod = `${itemDateParts[2]}-${String(itemDateParts[1]).padStart(2, '0')}`;
      
      const periodMatch = filters.period ? itemPeriod === filters.period : true;
      const segmentMatch = filters.segment ? (categoryMap[item.CATEGORÍA] === filters.segment) : true;
      const submanagerMatch = filters.submanager ? item.SUBGERENTE === filters.submanager : true;
      const supervisorMatch = filters.supervisor ? item.SUPERVISOR === filters.supervisor : true;
      const advisorMatch = filters.advisor ? item.VENDEDOR === filters.advisor : true;

      return periodMatch && segmentMatch && submanagerMatch && supervisorMatch && advisorMatch;
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

    // Lógica condicional para el gráfico de seguimiento diario
    let dailyData = [];
    if (filters.period) { // Solo se calcula si se ha seleccionado un período específico
      const daysInMonth = new Date(filters.period.split('-')[0], filters.period.split('-')[1], 0).getDate();
      dailyData = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, conforme: 0, noConforme: 0 }));

      filteredData.forEach(item => {
        // Asegurarnos de que el item pertenece al mes que estamos graficando
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
    if (!allData || !filters.dni || filters.dni.length < 1) return [];
    return allData.filter(item => String(item.DNI).includes(filters.dni));
  }, [allData, filters.dni]);

  return { processedAllData, ...processedData, uniqueValues, dniResults };
}