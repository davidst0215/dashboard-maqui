// server.js - Backend proxy para servir archivos locales
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Ruta a tu carpeta de audios locales
const AUDIO_FOLDER = "C:\\Users\\siste\\OneDrive\\SAYA INVESTMENTS\\calidad de venta\\audios";

// ÍNDICE DE ARCHIVOS - Se carga al inicio
let audioIndex = {
  files: [],
  byDni: new Map(),
  byIdLlamada: new Map(),
  lastScan: null,
  totalFiles: 0
};

// Función para escanear y crear índice de archivos
function buildAudioIndex() {
  console.log('🔍 === CONSTRUYENDO ÍNDICE DE ARCHIVOS ===');
  
  try {
    if (!fs.existsSync(AUDIO_FOLDER)) {
      console.log('❌ Carpeta de audios no encontrada:', AUDIO_FOLDER);
      return false;
    }

    const startTime = Date.now();
    const files = fs.readdirSync(AUDIO_FOLDER).filter(f => f.endsWith('.wav'));
    
    // Reiniciar índice
    audioIndex = {
      files: [],
      byDni: new Map(),
      byIdLlamada: new Map(),
      lastScan: new Date().toISOString(),
      totalFiles: files.length
    };

    console.log(`📁 Procesando ${files.length} archivos...`);

    files.forEach((filename, index) => {
      const fileInfo = {
        filename: filename,
        path: path.join(AUDIO_FOLDER, filename),
        size: 0
      };

      // Obtener tamaño del archivo
      try {
        const stats = fs.statSync(fileInfo.path);
        fileInfo.size = stats.size;
      } catch (error) {
        console.warn(`⚠️ Error obteniendo stats de ${filename}:`, error.message);
      }

      // Extraer información del nombre del archivo
      const analysis = analyzeFilename(filename);
      fileInfo.analysis = analysis;

      // Agregar al índice principal
      audioIndex.files.push(fileInfo);

      // Indexar por DNI si se encuentra
      if (analysis.dnis && analysis.dnis.length > 0) {
        analysis.dnis.forEach(dni => {
          if (!audioIndex.byDni.has(dni)) {
            audioIndex.byDni.set(dni, []);
          }
          audioIndex.byDni.get(dni).push(fileInfo);
        });
      }

      // Indexar por ID_LLAMADA (nombre sin extensión)
      const idLlamada = filename.replace('.wav', '');
      audioIndex.byIdLlamada.set(idLlamada, fileInfo);

      // Log progreso cada 50 archivos
      if ((index + 1) % 50 === 0 || (index + 1) === files.length) {
        console.log(`📊 Procesados: ${index + 1}/${files.length}`);
      }
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log('✅ === ÍNDICE COMPLETADO ===');
    console.log(`⏱️ Tiempo de procesamiento: ${duration}ms`);
    console.log(`📁 Total archivos: ${audioIndex.totalFiles}`);
    console.log(`👥 DNIs únicos encontrados: ${audioIndex.byDni.size}`);
    console.log(`🆔 IDs de llamada: ${audioIndex.byIdLlamada.size}`);
    
    // Mostrar muestra de DNIs encontrados
    const sampleDnis = Array.from(audioIndex.byDni.keys()).slice(0, 5);
    console.log(`🔍 Muestra de DNIs: ${sampleDnis.join(', ')}`);
    console.log('=====================================');

    return true;

  } catch (error) {
    console.error('❌ Error construyendo índice:', error);
    return false;
  }
}

// Función para analizar el nombre del archivo y extraer información - CON DEBUG
function analyzeFilename(filename) {
  const analysis = {
    dnis: [],
    dates: [],
    uuids: [],
    timestamps: [],
    hasProspectosPrefix: filename.startsWith('prospectos_')
  };

  // DEBUG: Log de archivos específicos
  const debugFiles = ['prospectos_10327840', 'prospectos_43014977'];
  const shouldDebug = debugFiles.some(df => filename.includes(df));

  if (shouldDebug) {
    console.log('🐛 DEBUG archivo:', filename);
    console.log('🐛 hasProspectosPrefix:', analysis.hasProspectosPrefix);
  }

  // Extraer DNIs - LÓGICA CORREGIDA para el formato real
  if (analysis.hasProspectosPrefix) {
    // Para archivos con prefijo prospectos_: "prospectos_10327840_..."
    // Extraer el primer número después de "prospectos_"
    const match = filename.match(/^prospectos_(\d{7,11})_/);
    
    if (shouldDebug) {
      console.log('🐛 Regex match:', match);
    }
    
    if (match) {
      const dni = match[1];
      analysis.dnis.push(dni);
      
      if (shouldDebug) {
        console.log('🐛 DNI extraído:', dni);
      }
      
      // También agregar versión sin ceros al inicio si los tiene
      const withoutLeadingZeros = dni.replace(/^0+/, '');
      if (withoutLeadingZeros.length >= 6 && withoutLeadingZeros !== dni) {
        analysis.dnis.push(withoutLeadingZeros);
        
        if (shouldDebug) {
          console.log('🐛 DNI sin ceros:', withoutLeadingZeros);
        }
      }
    }
  } else {
    // Para archivos sin prefijo, buscar secuencias de dígitos normalmente
    const dniMatches = filename.match(/\b\d{6,11}\b/g);
    if (dniMatches) {
      const uniqueDnis = new Set();
      dniMatches.forEach(dni => {
        uniqueDnis.add(dni);
        const withoutLeadingZeros = dni.replace(/^0+/, '');
        if (withoutLeadingZeros.length >= 6) {
          uniqueDnis.add(withoutLeadingZeros);
        }
      });
      analysis.dnis = Array.from(uniqueDnis);
    }
  }

  if (shouldDebug) {
    console.log('🐛 DNIs finales:', analysis.dnis);
    console.log('🐛 ===============================');
  }

  // Extraer fechas (DDMMYYYY o YYYYMMDD)
  const dateMatches = filename.match(/\b\d{8}\b/g);
  if (dateMatches) {
    analysis.dates = dateMatches;
  }

  // Extraer UUIDs
  const uuidMatches = filename.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g);
  if (uuidMatches) {
    analysis.uuids = uuidMatches;
  }

  // Extraer timestamps (HH_MM_SS_milisegundos)
  const timestampMatches = filename.match(/\d{2}_\d{2}_\d{2}_\d+/g);
  if (timestampMatches) {
    analysis.timestamps = timestampMatches;
  }

  return analysis;
}

// Configurar CORS
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://localhost:5174',
    'http://127.0.0.1:5173'
  ],
  credentials: true
}));

app.use(express.json());

// Función para generar variaciones del DNI
function generateDniVariations(dni) {
  const variations = new Set();
  
  // DNI original
  variations.add(dni);
  
  // Generar versiones con ceros al inicio para diferentes longitudes
  for (let targetLength = 8; targetLength <= 10; targetLength++) {
    if (dni.length < targetLength) {
      variations.add(dni.padStart(targetLength, '0'));
    }
  }
  
  // Si el DNI comienza con ceros, también probar sin ellos
  if (dni.startsWith('0')) {
    const withoutLeadingZeros = dni.replace(/^0+/, '');
    if (withoutLeadingZeros.length > 0) {
      variations.add(withoutLeadingZeros);
    }
  }
  
  return Array.from(variations).filter(v => v.length > 0);
}

// Función SÚPER SIMPLE - búsqueda flexible por DNI
function findAudioFile(audioPath) {
  try {
    console.log('🔍 Buscando archivo:', audioPath);
    
    // Extraer DNI del path (la primera parte antes del /)
    let dni = audioPath.split('/')[0];
    if (!dni) {
      dni = audioPath.split('_')[0];
    }
    
    console.log('🔍 DNI a buscar:', dni);
    
    // Leer archivos
    const files = fs.readdirSync(AUDIO_FOLDER).filter(f => f.endsWith('.wav'));
    
    // BÚSQUEDA SÚPER SIMPLE: archivo que contenga el DNI
    const matches = files.filter(filename => filename.includes(dni));
    
    console.log('🔍 Archivos que contienen', dni + ':', matches.length);
    
    if (matches.length > 0) {
      const foundFile = matches[0];
      const fullPath = path.join(AUDIO_FOLDER, foundFile);
      console.log('✅ Archivo encontrado:', foundFile);
      return { found: true, path: fullPath, filename: foundFile };
    }
    
    console.log('❌ No se encontró archivo para DNI:', dni);
    return { found: false, path: null, filename: null };
    
  } catch (error) {
    console.error('❌ Error buscando archivo:', error);
    return { found: false, path: null, filename: null };
  }
}

// Middleware para logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Endpoint de salud con información del índice
app.get('/api/health', (req, res) => {
  const folderExists = fs.existsSync(AUDIO_FOLDER);
  
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    audioFolder: AUDIO_FOLDER,
    folderExists: folderExists,
    audioFileCount: audioIndex.totalFiles,
    indexLastScan: audioIndex.lastScan,
    indexedDnis: audioIndex.byDni.size,
    indexedIds: audioIndex.byIdLlamada.size,
    mode: 'local_files'
  });
});

// Endpoint para rebuilder el índice manualmente
app.post('/api/rebuild-index', (req, res) => {
  console.log('🔄 Rebuild del índice solicitado manualmente');
  
  const success = buildAudioIndex();
  
  if (success) {
    res.json({
      success: true,
      message: 'Índice reconstruido exitosamente',
      stats: {
        totalFiles: audioIndex.totalFiles,
        indexedDnis: audioIndex.byDni.size,
        indexedIds: audioIndex.byIdLlamada.size,
        lastScan: audioIndex.lastScan
      }
    });
  } else {
    res.status(500).json({
      success: false,
      error: 'Error reconstruyendo el índice'
    });
  }
});

// Endpoint para mostrar estadísticas del índice
app.get('/api/index-stats', (req, res) => {
  // Muestra de archivos por tamaño
  const filesBySize = audioIndex.files
    .sort((a, b) => b.size - a.size)
    .slice(0, 10)
    .map(f => ({
      filename: f.filename,
      sizeMB: (f.size / 1024 / 1024).toFixed(2),
      dnis: f.analysis.dnis
    }));

  // DNIs más frecuentes
  const dniFrequency = new Map();
  audioIndex.byDni.forEach((files, dni) => {
    dniFrequency.set(dni, files.length);
  });
  
  const topDnis = Array.from(dniFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  res.json({
    totalFiles: audioIndex.totalFiles,
    indexedDnis: audioIndex.byDni.size,
    indexedIds: audioIndex.byIdLlamada.size,
    lastScan: audioIndex.lastScan,
    largestFiles: filesBySize,
    topDnis: topDnis,
    sampleFilenames: audioIndex.files.slice(0, 5).map(f => f.filename)
  });
});

// Endpoint para verificar archivos locales
app.get('/api/test-local', (req, res) => {
  try {
    if (!fs.existsSync(AUDIO_FOLDER)) {
      return res.status(500).json({ 
        error: 'Carpeta de audios no encontrada',
        path: AUDIO_FOLDER
      });
    }

    const files = fs.readdirSync(AUDIO_FOLDER).filter(f => f.endsWith('.wav'));
    
    res.json({
      success: true,
      message: 'Carpeta de audios accesible',
      audioFolder: AUDIO_FOLDER,
      totalFiles: files.length,
      sampleFiles: files.slice(0, 5).map(f => f)
    });
  } catch (error) {
    console.error('❌ Error verificando carpeta local:', error);
    res.status(500).json({
      success: false,
      error: 'Error accediendo a la carpeta de audios',
      details: error.message
    });
  }
});

// Endpoint principal para servir audios locales
app.get('/api/audio/stream/:path(*)', async (req, res) => {
  try {
    const audioPath = req.params.path;
    console.log('📡 Solicitando audio local:', audioPath);

    // Buscar el archivo
    const result = findAudioFile(audioPath);
    
    if (!result.found) {
      console.log('❌ Archivo no encontrado:', audioPath);
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const filePath = result.path;
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    const contentType = 'audio/wav';

    console.log('✅ Sirviendo archivo local:', {
      filename: result.filename,
      size: `${(fileSize / 1024 / 1024).toFixed(2)} MB`,
      path: filePath,
      contentType: contentType
    });

    // Headers básicos para audio
    const headers = {
      'Content-Type': contentType,
      'Content-Length': fileSize,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache', // Cambiar para debugging
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS'
    };

    res.set(headers);

    const range = req.headers.range;
    if (range) {
      console.log('📊 Request con rango:', range);
      
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      console.log('📊 Rango calculado:', { start, end, chunksize });

      res.status(206); // Partial Content
      res.set({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunksize
      });

      // Verificar que el rango sea válido
      if (start >= fileSize || end >= fileSize || start > end) {
        console.error('❌ Rango inválido:', { start, end, fileSize });
        return res.status(416).json({ error: 'Rango solicitado no satisfacible' });
      }

      // Stream del rango específico
      const stream = fs.createReadStream(filePath, { start, end });
      stream.on('error', (error) => {
        console.error('❌ Error en stream de rango:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error streaming archivo' });
        }
      });
      stream.on('open', () => {
        console.log('✅ Stream de rango iniciado');
      });
      stream.pipe(res);
    } else {
      // Stream completo
      console.log('📡 Streaming archivo completo (sin rango)');
      
      // Verificar que el archivo existe antes de hacer stream
      if (!fs.existsSync(filePath)) {
        console.error('❌ Archivo no existe al momento del stream:', filePath);
        return res.status(404).json({ error: 'Archivo no encontrado' });
      }
      
      const stream = fs.createReadStream(filePath);
      
      stream.on('error', (error) => {
        console.error('❌ Error en stream completo:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error streaming archivo' });
        }
      });
      
      stream.on('open', () => {
        console.log('✅ Stream completo iniciado');
      });
      
      stream.on('end', () => {
        console.log('✅ Stream completo finalizado');
      });
      
      stream.pipe(res);
    }

  } catch (error) {
    console.error('❌ Error sirviendo audio local:', error);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Error interno del servidor',
        details: error.message 
      });
    }
  }
});

// Endpoint para generar URLs de proxy (local)
app.post('/api/audio/get-url', async (req, res) => {
  try {
    const { gsPath } = req.body;
    console.log('🔗 Generando URL proxy local para:', gsPath);
    
    if (!gsPath) {
      return res.status(400).json({
        success: false,
        error: 'gsPath es requerido'
      });
    }

    // Convertir gs:// path a path local
    let audioPath = gsPath.replace('gs://buckets_llamadas/', '');
    
    console.log('🔗 Path procesado:', audioPath);
    
    // Generar URL local que apunta a nuestro proxy
    const proxyUrl = `${req.protocol}://${req.get('host')}/api/audio/stream/${audioPath}`;
    
    console.log('✅ URL proxy local generada:', proxyUrl);
    
    res.json({
      success: true,
      audioUrl: proxyUrl,
      originalPath: gsPath,
      audioPath: audioPath,
      mode: 'local_files'
    });

  } catch (error) {
    console.error('❌ Error generando URL proxy local:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar URL del audio local',
      details: error.message
    });
  }
});

// Endpoint para buscar archivos (debug) - SIMPLIFICADO
app.get('/api/search/:query', (req, res) => {
  try {
    const query = req.params.query;
    console.log('🔍 Búsqueda manual:', query);
    
    const result = findAudioFile(query);
    
    // Búsqueda adicional: mostrar todos los archivos que contengan el DNI
    const files = fs.readdirSync(AUDIO_FOLDER).filter(f => f.endsWith('.wav'));
    const allMatches = files.filter(file => file.includes(query));
    
    res.json({
      query: query,
      found: result.found,
      filename: result.filename,
      path: result.path,
      allMatches: allMatches.slice(0, 5), // Mostrar hasta 5 coincidencias
      totalMatches: allMatches.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para descargar archivo directamente (debug)
app.get('/api/download/:query', (req, res) => {
  try {
    const query = req.params.query;
    console.log('⬇️ Descarga directa:', query);
    
    const result = findAudioFile(query);
    
    if (!result.found) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    // Forzar descarga
    res.download(result.path, result.filename, (err) => {
      if (err) {
        console.error('❌ Error en descarga:', err);
      } else {
        console.log('✅ Descarga completada:', result.filename);
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manejo de errores
app.use((error, req, res, next) => {
  console.error('❌ Error no manejado:', error);
  res.status(500).json({
    error: 'Error interno del servidor',
    details: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
  });
});

// Rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint no encontrado',
    availableEndpoints: [
      'GET /api/health',
      'GET /api/test-local',
      'GET /api/audio/stream/:path',
      'POST /api/audio/get-url',
      'GET /api/search/:query'
    ]
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log('');
  console.log('🚀 ===== SERVIDOR PROXY LOCAL INICIADO =====');
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🧪 Test Local: http://localhost:${PORT}/api/test-local`);
  console.log(`🎵 Audio Stream: http://localhost:${PORT}/api/audio/stream/`);
  console.log(`📁 Carpeta de audios: ${AUDIO_FOLDER}`);
  console.log('=========================================');
  
  // Construir índice de archivos al iniciar
  console.log('');
  const indexSuccess = buildAudioIndex();
  
  if (!indexSuccess) {
    console.log('⚠️ El servidor inició pero el índice no se pudo construir');
  }
  
  console.log('');
  console.log('🎯 ENDPOINTS DISPONIBLES:');
  console.log('   GET  /api/health          - Estado del servidor');
  console.log('   GET  /api/index-stats     - Estadísticas del índice');  
  console.log('   POST /api/rebuild-index   - Reconstruir índice');
  console.log('   GET  /api/search/:query   - Buscar archivos');
  console.log('   GET  /api/audio/stream/*  - Stream de audio');
  console.log('=========================================');
  console.log('');
});

module.exports = app;