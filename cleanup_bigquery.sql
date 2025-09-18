-- Script para eliminar datos erróneos de análisis de calidad
-- Fecha: 2025-09-18
-- Motivo: Datos mal analizados que necesitan ser reprocesados

-- Eliminar análisis erróneos del 2025-09-18
DELETE FROM `peak-emitter-350713.Calidad_Llamadas.analisis_calidad`
WHERE DATE(fecha_llamada) = '2025-09-18'
   OR DATE(created_at) = '2025-09-18';

-- Verificar registros eliminados
SELECT
  'Records deleted' as operation,
  COUNT(*) as remaining_records_for_date
FROM `peak-emitter-350713.Calidad_Llamadas.analisis_calidad`
WHERE DATE(fecha_llamada) = '2025-09-18'
   OR DATE(created_at) = '2025-09-18';