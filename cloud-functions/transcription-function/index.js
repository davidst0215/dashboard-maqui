const { Storage } = require('@google-cloud/storage');
const { SpeechClient } = require('@google-cloud/speech');
const { BigQuery } = require('@google-cloud/bigquery');

const storage = new Storage();
const speechClient = new SpeechClient();
const bigquery = new BigQuery();

/**
 * Cloud Function que se activa cuando se sube un archivo de audio a Cloud Storage
 * Transcribe el audio y guarda el resultado en BigQuery
 * 
 * Para trigger de bucket (original):
 * exports.transcribeAudio = async (data, context) => {
 *   const file = data;
 *   const bucketName = file.bucket;
 *   const fileName = file.name;
 * 
 * Para trigger HTTP (alternativo):
 */
exports.transcribeAudio = async (req, res) => {
  // Trigger HTTP: recibe bucketName y fileName en el body
  if (req.method === 'POST') {
    const { bucketName, fileName } = req.body;
    if (!bucketName || !fileName) {
      res.status(400).json({ error: 'bucketName and fileName required' });
      return;
    }
    
    try {
      await processAudioFile(bucketName, fileName);
      res.status(200).json({ 
        success: true, 
        message: `Audio ${fileName} processed successfully` 
      });
    } catch (error) {
      console.error(`❌ Error processing ${fileName}:`, error);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};

/**
 * Función original adaptada para ser reutilizable
 */
async function processAudioFile(bucketName, fileName) {
  
  console.log(`🎤 Procesando audio: gs://${bucketName}/${fileName}`);
  
  // Solo procesar archivos de audio
  if (!fileName.match(/\.(wav|mp3|flac|m4a)$/i)) {
    console.log(`⏭️ Saltando archivo no-audio: ${fileName}`);
    return;
  }
  
  try {
    // Extraer DNI del nombre del archivo
    const dniMatch = fileName.match(/_(\d{7,9})_/);
    if (!dniMatch) {
      console.log(`❌ No se pudo extraer DNI del archivo: ${fileName}`);
      return;
    }
    const dni = dniMatch[1];
    
    // Configurar transcripción
    const request = {
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: 'es-PE',
        alternativeLanguageCodes: ['es-ES', 'es-MX'],
        enableAutomaticPunctuation: true,
        enableWordConfidence: true,
        model: 'latest_long',
      },
      audio: {
        uri: `gs://${bucketName}/${fileName}`,
      },
    };
    
    console.log(`🔄 Iniciando transcripción para DNI: ${dni}`);
    
    // Realizar transcripción
    const [operation] = await speechClient.longRunningRecognize(request);
    const [response] = await operation.promise();
    
    // Combinar todas las transcripciones
    const transcriptionText = response.results
      .map(result => result.alternatives[0].transcript)
      .join(' ');
    
    console.log(`✅ Transcripción completada (${transcriptionText.length} chars)`);
    
    // Guardar en BigQuery
    const dataset = bigquery.dataset('Calidad_Llamadas');
    const table = dataset.table('transcripciones');
    
    const row = {
      dni: dni,
      audio_url: `gs://${bucketName}/${fileName}`,
      transcripcion_texto: transcriptionText,
      fecha_llamada: extractDateFromFilename(fileName),
      confidence_promedio: calculateAverageConfidence(response.results),
      created_at: new Date().toISOString(),
      processed_at: new Date().toISOString()
    };
    
    await table.insert([row]);
    console.log(`💾 Transcripción guardada en BigQuery para DNI: ${dni}`);
    
    // Trigger análisis de calidad
    await triggerQualityAnalysis(dni, transcriptionText);
    
  } catch (error) {
    console.error(`❌ Error procesando ${fileName}:`, error);
    throw error;
  }
}

function extractDateFromFilename(filename) {
  // Extraer fecha del formato: DDMMYYYY-HH_MM_SS
  const dateMatch = filename.match(/(\d{2})(\d{2})(\d{4})-(\d{2})_(\d{2})_(\d{2})/);
  if (dateMatch) {
    const [, day, month, year, hour, minute, second] = dateMatch;
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`).toISOString();
  }
  return new Date().toISOString();
}

function calculateAverageConfidence(results) {
  let totalConfidence = 0;
  let wordCount = 0;
  
  results.forEach(result => {
    result.alternatives[0].words?.forEach(word => {
      totalConfidence += word.confidence || 0;
      wordCount++;
    });
  });
  
  return wordCount > 0 ? totalConfidence / wordCount : 0;
}

async function triggerQualityAnalysis(dni, transcriptionText) {
  // Aquí podrías trigger otra Cloud Function para análisis de calidad
  // o usar Pub/Sub para desacoplar el procesamiento
  console.log(`🔄 Triggering quality analysis for DNI: ${dni}`);
}