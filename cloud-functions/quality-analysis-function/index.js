const { BigQuery } = require('@google-cloud/bigquery');
const { VertexAI } = require('@google-cloud/vertexai');

const bigquery = new BigQuery();
const vertex_ai = new VertexAI({
  project: 'peak-emitter-350713',
  location: 'us-central1'
});

const model = vertex_ai.preview.getGenerativeModel({
  model: 'gemini-1.5-pro-001',
  generation_config: {
    max_output_tokens: 2048,
    temperature: 0.1,
    top_p: 0.8,
  },
});

/**
 * Cloud Function que analiza la calidad de las transcripciones
 * Se puede activar por Pub/Sub, HTTP, o trigger de BigQuery
 */
exports.analyzeQuality = async (req, res) => {
  try {
    // Obtener transcripciones pendientes de análisis
    const pendingTranscriptions = await getPendingTranscriptions();
    
    console.log(`📊 Analizando ${pendingTranscriptions.length} transcripciones`);
    
    for (const transcription of pendingTranscriptions) {
      await analyzeTranscription(transcription);
    }
    
    res.status(200).json({
      success: true,
      processed: pendingTranscriptions.length,
      message: 'Análisis de calidad completado'
    });
    
  } catch (error) {
    console.error('❌ Error en análisis de calidad:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

async function getPendingTranscriptions() {
  const query = `
    SELECT 
      t.dni,
      t.transcripcion_texto,
      t.audio_url,
      t.fecha_llamada,
      t.created_at
    FROM \`peak-emitter-350713.Calidad_Llamadas.transcripciones\` t
    LEFT JOIN \`peak-emitter-350713.Calidad_Llamadas.analisis_calidad\` a
      ON t.dni = a.dni
    WHERE a.dni IS NULL
      AND t.transcripcion_texto IS NOT NULL
      AND LENGTH(t.transcripcion_texto) > 50
    ORDER BY t.created_at DESC
    LIMIT 10
  `;
  
  const [rows] = await bigquery.query(query);
  return rows;
}

async function analyzeTranscription(transcription) {
  const { dni, transcripcion_texto, audio_url, fecha_llamada } = transcription;
  
  console.log(`🔍 Analizando DNI: ${dni}`);
  
  const prompt = `
Eres un experto en calidad de atención al cliente para una empresa financiera peruana.
Analiza esta transcripción de llamada y evalúa la calidad según estos criterios:

CRITERIOS DE EVALUACIÓN:
1. IDENTIFICACIÓN (0-10 puntos): El agente se presenta correctamente con nombre y empresa
2. VERIFICACIÓN (0-10 puntos): Verifica la identidad del cliente apropiadamente  
3. CONTEXTUALIZACIÓN (0-10 puntos): Explica claramente el motivo de la llamada y los productos
4. SENTIMIENTOS (0-10 puntos): Mantiene un tono cordial, empático y profesional

TRANSCRIPCIÓN:
"${transcripcion_texto}"

RESPONDE EN FORMATO JSON:
{
  "puntuacion_identificacion": [0-10],
  "puntuacion_verificacion": [0-10], 
  "puntuacion_contextualizacion": [0-10],
  "puntuacion_sentimientos": [0-10],
  "puntuacion_total": [suma total],
  "categoria": ["MALA", "MEDIA", "BUENA", "MUY BUENA"],
  "conformidad": ["Conforme", "No Conforme"],
  "comentarios": "Explicación detallada del análisis"
}

CRITERIOS:
- MALA: 0-39 puntos
- MEDIA: 40-64 puntos  
- BUENA: 65-84 puntos
- MUY BUENA: 85-100 puntos
- Conforme: >= 65 puntos
- No Conforme: < 65 puntos
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const analysisText = response.text();
    
    // Extraer JSON de la respuesta
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No se pudo extraer JSON de la respuesta de IA');
    }
    
    const analysis = JSON.parse(jsonMatch[0]);
    
    // Guardar análisis en BigQuery
    await saveAnalysis(dni, analysis, audio_url, fecha_llamada);
    
    console.log(`✅ Análisis completado para DNI: ${dni} - ${analysis.categoria}`);
    
  } catch (error) {
    console.error(`❌ Error analizando DNI ${dni}:`, error);
    
    // Guardar registro de error
    await saveAnalysis(dni, {
      puntuacion_identificacion: 0,
      puntuacion_verificacion: 0,
      puntuacion_contextualizacion: 0,
      puntuacion_sentimientos: 0,
      puntuacion_total: 0,
      categoria: 'PENDIENTE',
      conformidad: 'Pendiente',
      comentarios: `Error en análisis: ${error.message}`
    }, audio_url, fecha_llamada);
  }
}

async function saveAnalysis(dni, analysis, audio_url, fecha_llamada) {
  const dataset = bigquery.dataset('Calidad_Llamadas');
  const table = dataset.table('analisis_calidad');
  
  const row = {
    dni: dni,
    categoria: analysis.categoria,
    puntuacion_total: analysis.puntuacion_total,
    puntuacion_identificacion: analysis.puntuacion_identificacion,
    puntuacion_verificacion: analysis.puntuacion_verificacion,
    puntuacion_contextualizacion: analysis.puntuacion_contextualizacion,
    puntuacion_sentimientos: analysis.puntuacion_sentimientos,
    conformidad: analysis.conformidad,
    comentarios: analysis.comentarios,
    fecha_llamada: fecha_llamada,
    audio_url: audio_url,
    created_at: new Date().toISOString(),
    processed_at: new Date().toISOString()
  };
  
  await table.insert([row]);
}