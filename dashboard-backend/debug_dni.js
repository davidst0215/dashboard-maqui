// debug_dni.js - Investigate DNI format in Validacion_Ventas
const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'peak-emitter-350713',
  keyFilename: './peak-emitter-350713-credentials.json'
});

async function investigateDniFormat() {
  console.log('🔍 Investigando formato DNI en tabla Validacion_Ventas...');
  
  const query = `
    SELECT 
      NumeroDocumento,
      TRIM(NumeroDocumento) as documento_trimmed,
      Nombre,
      Gestor,
      Supervisor,
      Vendedor
    FROM \`peak-emitter-350713.FR_Admision.Validacion_Ventas\` 
    WHERE TRIM(NumeroDocumento) = '729143' 
       OR TRIM(NumeroDocumento) = '000729143'
       OR TRIM(NumeroDocumento) LIKE '%729143%'
    LIMIT 10
  `;

  try {
    const [rows] = await bigquery.query(query);
    console.log('📊 Resultados encontrados:', rows.length);
    
    if (rows.length === 0) {
      console.log('❌ No se encontraron registros con DNI 729143');
      
      // Try broader search
      const broadQuery = `
        SELECT DISTINCT
          NumeroDocumento,
          LENGTH(CAST(NumeroDocumento AS STRING)) as documento_length,
          CAST(NumeroDocumento AS STRING) as documento_string,
          Nombre
        FROM \`peak-emitter-350713.FR_Admision.Validacion_Ventas\` 
        LIMIT 10
      `;
      
      console.log('🔍 Buscando primeros 10 registros para ver formato...');
      const [broadRows] = await bigquery.query(broadQuery);
      console.table(broadRows);
    } else {
      console.table(rows);
    }
    
  } catch (error) {
    console.error('❌ Error ejecutando query:', error);
  }
}

investigateDniFormat();