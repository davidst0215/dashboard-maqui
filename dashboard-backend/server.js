// server.js - Backend de autenticación y proxy de audios para despliegue
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Storage } = require('@google-cloud/storage');
const { BigQuery } = require('@google-cloud/bigquery');

const app = express();
const PORT = process.env.PORT || 3005;

// Configuración
const JWT_SECRET = process.env.JWT_SECRET || 'tu-clave-super-secreta-cambiar-en-produccion';
const GOOGLE_CLOUD_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'vernal-dispatch-457615-n9';

// Inicializar Google Cloud Storage
let storage;
try {
  // Opción 1: Usar variables de entorno para las credenciales
  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    storage = new Storage({
      projectId: GOOGLE_CLOUD_PROJECT_ID,
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
    });
    console.log('✅ Google Cloud Storage inicializado con variables de entorno');
  } 
  // Opción 2: Usar archivo de service account
  else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    storage = new Storage({
      projectId: GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
    console.log('✅ Google Cloud Storage inicializado con archivo de credenciales');
  }
  // Opción 3: Autenticación automática (en Google Cloud)
  else {
    storage = new Storage({ projectId: GOOGLE_CLOUD_PROJECT_ID });
    console.log('✅ Google Cloud Storage inicializado con autenticación automática');
  }
} catch (error) {
  console.error('❌ Error inicializando Google Cloud Storage:', error);
}

// Inicializar BigQuery
let bigquery;
try {
  // Usar las mismas credenciales que Storage
  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    bigquery = new BigQuery({
      projectId: 'peak-emitter-350713', // Tu proyecto específico de BigQuery
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
    });
    console.log('✅ BigQuery inicializado con variables de entorno');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    bigquery = new BigQuery({
      projectId: 'peak-emitter-350713',
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
    console.log('✅ BigQuery inicializado con archivo de credenciales');
  } else {
    bigquery = new BigQuery({ projectId: 'peak-emitter-350713' });
    console.log('✅ BigQuery inicializado con autenticación automática');
  }
} catch (error) {
  console.error('❌ Error inicializando BigQuery:', error);
}

// Base de datos de usuarios (temporal) - ACTUALIZADA CON GERENTES
const USUARIOS = {
  'admin@maquimas.pe': {
    password: 'password123',
    role: 'admin',
    name: 'Administrador',
    gerencia: null  // Admin ve todo
  },
  'david@maquimas.pe': { 
    password: 'password123', 
    role: 'manager',
    name: 'David',
    gerencia: null  // Manager superior ve todo
  },
  'analista1@maquimas.pe': { 
    password: 'password123', 
    role: 'analyst',
    name: 'Analista 1',
    gerencia: null
  },
  'supervisor@maquimas.pe': { 
    password: 'password123', 
    role: 'supervisor',
    name: 'Supervisor',
    gerencia: null
  },
  // NUEVOS USUARIOS GERENTES - Basados en BD_DOTACION
  'gerente1@maquimas.pe': { 
    password: 'password123', 
    role: 'gerente',
    name: 'Gerente 1',
    gerencia: 'GERENCIA_VENTAS'  // Solo ve datos de esta gerencia
  },
  'gerente2@maquimas.pe': { 
    password: 'password123', 
    role: 'gerente',
    name: 'Gerente 2',
    gerencia: 'GERENCIA_OPERACIONES'  // Solo ve datos de esta gerencia
  },
  // NUEVOS GERENTES SOLICITADOS
  'juan.cornejo@maquimas.pe': { 
    password: 'cornejo2024', 
    role: 'gerente',
    name: 'Juan Francisco Cornejo Vasquez',
    gerencia: 'CORNEJO VASQUEZ JUAN FRANCISCO'  // Exacto según BD_DOTACION
  },
  'armando.nunez@maquimas.pe': { 
    password: 'nunez2024', 
    role: 'gerente',
    name: 'Armando Moises Nuñez',
    gerencia: 'NUÑEZ MENESES ARMANDO MOISES'  // Exacto según BD_DOTACION
  },
  'roger.heredia@maquimas.pe': { 
    password: 'heredia2024', 
    role: 'gerente',
    name: 'Roger Eduardo Heredia Gomez',
    gerencia: 'HEREDIA GOMEZ ROGER EDUARDO'  // Exacto según BD_DOTACION
  },
  'sin.gerente@maquimas.pe': { 
    password: 'singerente2024', 
    role: 'gerente',
    name: 'Sin Gerente Asociado',
    gerencia: 'SIN GERENTE ASOCIADO'  // Exacto según BD_DOTACION
  }
};

// Middleware - CORS configurado para permitir Vercel y localhost
app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (mobile apps, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
      'http://localhost:5177',
      'http://localhost:5178',
      'http://localhost:5179',
      'http://localhost:5180',
      'http://localhost:5181',
      'http://localhost:3000',
      'https://maqui-dashboard-imiecr288-david-sayainvestmes-projects.vercel.app',
      'https://dashboard-maqui.vercel.app'
    ];

    // Permitir cualquier subdominio de vercel.app
    if (origin.includes('.vercel.app')) {
      return callback(null, true);
    }

    // Verificar origins específicos permitidos
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  },
  credentials: true
}));

app.use(express.json());

// Servir archivos estáticos del frontend
app.use(express.static('public'));

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Middleware para verificar JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Token inválido' });
  }
};

// Servir archivos estáticos (para el Excel)
app.use(express.static('.', {
  setHeaders: (res, path) => {
    if (path.endsWith('.xlsx')) {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }
  },
  // Excluir archivos .xlsx para que los maneje el endpoint específico
  dotfiles: 'ignore',
  index: false,
  // Filtro para excluir .xlsx
  extensions: false
}));

// Agregar middleware para excluir .xlsx
app.use((req, res, next) => {
  if (req.path.endsWith('.xlsx')) {
    return next();
  }
  express.static('.')(req, res, next);
});

// Endpoint específico para el Excel (alternativa)
app.get('/data.xlsx', async (req, res) => {
  console.log('📊 Sirviendo data.xlsx desde Cloud Storage');
  try {
    const bucket = storage.bucket('buckets_llamadas');
    const file = bucket.file('data.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    file.createReadStream().pipe(res);
  } catch (error) {
    console.error('❌ Error sirviendo Excel:', error);
    res.status(500).send('Error cargando archivo');
  }
});

// ========== ENDPOINTS DE AUTENTICACIÓN ==========

// Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 Intento de login:', email);
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos'
      });
    }

    const user = USUARIOS[email];
    
    if (!user || user.password !== password) {
      console.log('❌ Credenciales inválidas para:', email);
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Generar JWT con información de gerencia
    const token = jwt.sign(
      { 
        email: email, 
        role: user.role, 
        name: user.name,
        gerencia: user.gerencia  // NUEVO: Incluir gerencia en token
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    console.log('✅ Login exitoso para:', email, 'Role:', user.role);

    res.json({
      success: true,
      access_token: token,
      user: {
        email: email,
        role: user.role,
        name: user.name,
        gerencia: user.gerencia  // NUEVO: Incluir gerencia en respuesta
      }
    });

  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Verificar token
app.get('/api/auth/verify', verifyToken, (req, res) => {
  res.json({
    success: true,
    user: {
      email: req.user.email,
      role: req.user.role,
      name: req.user.name
    }
  });
});

// ========== ENDPOINTS DE AUDIO ==========

// Generar URL firmada para audio
app.post('/api/audio/signed-url', verifyToken, async (req, res) => {
  try {
    const { gsPath } = req.body;
    
    console.log('🎵 Solicitando URL firmada:', gsPath, 'Usuario:', req.user.email);
    
    if (!gsPath || !gsPath.startsWith('gs://')) {
      return res.status(400).json({
        success: false,
        error: 'gsPath inválido. Debe empezar con gs://'
      });
    }

    if (!storage) {
      return res.status(500).json({
        success: false,
        error: 'Google Cloud Storage no inicializado'
      });
    }

    // Extraer bucket y blob del path
    const parts = gsPath.replace('gs://', '').split('/');
    const bucketName = parts[0];
    const blobPath = parts.slice(1).join('/');

    console.log('📁 Bucket:', bucketName, 'Blob:', blobPath);

    // Verificar que el archivo existe
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(blobPath);
    
    const [exists] = await file.exists();
    
    if (!exists) {
      console.log('❌ Archivo no encontrado:', gsPath);
      return res.status(404).json({
        success: false,
        error: 'Archivo de audio no encontrado'
      });
    }

    // Generar URL firmada (válida por 1 hora)
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hora
    });

    console.log('✅ URL firmada generada exitosamente');

    res.json({
      success: true,
      signed_url: signedUrl,
      expires_in: '1 hora',
      user: req.user.email,
      file_path: gsPath
    });

  } catch (error) {
    console.error('❌ Error generando URL firmada:', error);
    res.status(500).json({
      success: false,
      error: 'Error generando URL del audio: ' + error.message
    });
  }
});

// Nuevo endpoint: WAV a MP3 conversion para mejor compatibilidad
app.get('/api/audio/mp3/*', async (req, res) => {
  try {
    const audioPath = req.params[0];
    console.log('🎵 Convirtiendo WAV a MP3 para:', audioPath);
    
    if (!storage) {
      return res.status(500).json({ error: 'Google Cloud Storage no inicializado' });
    }

    const bucket = storage.bucket('buckets_llamadas');
    const file = bucket.file(audioPath);
    
    // Verificar que existe
    const [exists] = await file.exists();
    if (!exists) {
      console.log('❌ Audio no encontrado:', audioPath);
      return res.status(404).json({ error: 'Audio no encontrado' });
    }

    // Headers para MP3
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Range');
    
    console.log('🔄 Iniciando conversión WAV → MP3...');
    
    // Usar ffmpeg para convertir WAV a MP3 on-the-fly
    const ffmpeg = require('fluent-ffmpeg');
    const inputStream = file.createReadStream();
    
    ffmpeg(inputStream)
      .inputFormat('wav')
      .audioCodec('libmp3lame')
      .audioBitrate(128)
      .format('mp3')
      .on('start', () => {
        console.log('▶️ FFmpeg conversion started');
      })
      .on('end', () => {
        console.log('✅ FFmpeg conversion completed');
      })
      .on('error', (err) => {
        console.error('❌ FFmpeg error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Conversion error: ' + err.message });
        }
      })
      .pipe(res);
      
  } catch (error) {
    console.error('❌ Error en endpoint mp3:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error interno: ' + error.message });
    }
  }
});

app.get('/api/audio/stream/*', async (req, res) => {
  try {
    const audioPath = req.params[0];
    console.log('🎵 Streaming audio WAV con Range support:', audioPath);
    
    if (!storage) {
      return res.status(500).json({ error: 'Google Cloud Storage no inicializado' });
    }

    const bucket = storage.bucket('buckets_llamadas');
    const file = bucket.file(audioPath);
    
    // Verificar que existe y obtener metadata
    const [exists] = await file.exists();
    if (!exists) {
      console.log('❌ Audio no encontrado:', audioPath);
      return res.status(404).json({ error: 'Audio no encontrado' });
    }

    const [metadata] = await file.getMetadata();
    const fileSize = metadata.size;
    
    // Obtener Range header
    const range = req.headers.range;
    
    if (range) {
      // Parsear Range request
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      
      const chunksize = (end - start) + 1;
      
      console.log(`📊 Range request: ${start}-${end}/${fileSize} (${chunksize} bytes)`);
      
      // Headers para Range response
      res.status(206); // Partial Content
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', chunksize);
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Range');
      
      // Stream del rango específico
      const stream = file.createReadStream({ start, end });
      
      stream.on('error', (error) => {
        console.error('❌ Error en range stream:', error);
        if (!res.headersSent) {
          res.status(500).end();
        }
      });
      
      stream.pipe(res);
      
    } else {
      // Request normal (archivo completo)
      console.log(`✅ Streaming archivo completo: ${fileSize} bytes`);
      
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Range');
      res.setHeader('Content-Transfer-Encoding', 'binary');
      
      const stream = file.createReadStream();
      
      stream.on('error', (error) => {
        console.error('❌ Error en stream:', error);
        if (!res.headersSent) {
          res.status(500).end();
        }
      });
      
      stream.on('end', () => {
        console.log('✅ Stream WAV completado');
      });
      
      stream.pipe(res);
    }
      
  } catch (error) {
    console.error('❌ Error en endpoint stream:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error interno: ' + error.message });
    }
  }
});

// ========== ENDPOINTS DE DASHBOARD ==========

// Endpoint para obtener datos del dashboard desde BigQuery
app.get('/api/dashboard/data', verifyToken, async (req, res) => {
  try {
    console.log('📊 Cargando datos del dashboard desde BigQuery para usuario:', req.user.email);

    if (!bigquery) {
      return res.status(500).json({
        success: false,
        error: 'BigQuery no inicializado'
      });
    }

    // Query mejorado con datos de Validacion_Ventas
    const query = `
      SELECT
        a.dni,
        a.categoria,
        a.conformidad,
        a.puntuacion_total,
        a.puntuacion_identificacion,
        a.puntuacion_verificacion,
        a.puntuacion_contextualizacion,
        a.puntuacion_consulta_dudas,
        a.puntuacion_sentimientos,
        a.comentarios,
        a.fecha_llamada,
        t.audio_url,

        -- Datos enriquecidos de Validacion_Ventas
        v.Nombre,
        v.Gestor,
        v.Vendedor,
        v.Supervisor,
        v.ResultadoVal1,
        v.ResultadoVal2,
        v.MontoCancelado,
        DATE(v.FechaHoraConfirmacion) as fecha_validacion

      FROM \`peak-emitter-350713.Calidad_Llamadas.analisis_calidad\` a
      LEFT JOIN \`peak-emitter-350713.Calidad_Llamadas.transcripciones\` t
        ON a.dni = t.dni AND DATE(a.fecha_llamada) = DATE(t.fecha_llamada)
      LEFT JOIN \`peak-emitter-350713.FR_Admision.Validacion_Ventas\` v
        ON LTRIM(v.NumeroDocumento, "0") = a.dni
      WHERE DATE(a.fecha_llamada) >= '2025-09-01'
        AND DATE(a.fecha_llamada) <= '2025-09-30'
      ORDER BY a.fecha_llamada DESC
    `;

    console.log('🔍 Ejecutando query BigQuery...');
    const [rows] = await bigquery.query({ query });

    console.log(`✅ BigQuery respondió con ${rows.length} filas`);

    if (rows.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'No se encontraron datos para el período consultado'
      });
    }

    // Procesar datos para el frontend
    const processedData = rows.map(row => ({
      dni: row.dni,
      categoria: row.categoria,
      conformidad: row.conformidad,
      puntuacion_total: row.puntuacion_total,
      puntuacion_identificacion: row.puntuacion_identificacion,
      puntuacion_verificacion: row.puntuacion_verificacion,
      puntuacion_contextualizacion: row.puntuacion_contextualizacion,
      puntuacion_consulta_dudas: row.puntuacion_consulta_dudas,
      puntuacion_sentimientos: row.puntuacion_sentimientos,
      comentarios: row.comentarios,
      fecha_llamada: row.fecha_llamada,
      audio_url: row.audio_url,

      // Datos enriquecidos
      Nombre: row.Nombre || 'No disponible',
      Gestor: row.Gestor || 'No asignado',
      Vendedor: row.Vendedor || 'No asignado',
      Supervisor: row.Supervisor || 'No asignado',
      ResultadoVal1: row.ResultadoVal1 || 'Sin validación',
      ResultadoVal2: row.ResultadoVal2 || 'Sin validación',
      MontoCancelado: row.MontoCancelado || 0,
      fecha_validacion: row.fecha_validacion
    }));

    console.log('✅ Datos procesados exitosamente');
    console.log(`📋 Primer registro de ejemplo:`, processedData[0]);

    res.json({
      success: true,
      data: processedData,
      total_records: processedData.length,
      query_time: new Date().toISOString(),
      user: req.user.email
    });

  } catch (error) {
    console.error('❌ Error cargando datos del dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Error cargando datos del dashboard',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ========== ENDPOINTS DE UTILIDAD ==========

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    service: 'Dashboard Auth & Audio Service',
    status: 'running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    google_cloud_configured: !!storage
  });
});

// Info del servidor
app.get('/api/info', (req, res) => {
  res.json({
    service: 'Dashboard Backend',
    endpoints: {
      auth: [
        'POST /api/auth/login',
        'GET /api/auth/verify'
      ],
      audio: [
        'POST /api/audio/signed-url'
      ],
      dashboard: [
        'GET /api/dashboard/data'
      ],
      utils: [
        'GET /api/health',
        'GET /api/info'
      ]
    },
    environment: process.env.NODE_ENV || 'development',
    project_id: GOOGLE_CLOUD_PROJECT_ID
  });
});

// ========== FUNCIONES DE INTEGRACIÓN DE DATOS ==========

// Nueva función optimizada para consultar SOLO desde BigQuery con filtro por gerencia
async function consultarDatosBigQueryCompletos(filtroFecha = null, gerenciaUsuario = null) {
  try {
    console.log('🔍 Consultando datos completos desde BigQuery...');
    
    if (!bigquery) {
      throw new Error('BigQuery no inicializado');
    }
    
    // Construir WHERE clause con filtros
    let whereConditions = [];
    
    if (filtroFecha) {
      whereConditions.push(`DATE(a.created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL ${filtroFecha} DAY)`);
    }
    
    // Filtro por gerencia - REACTIVADO
    if (gerenciaUsuario && gerenciaUsuario !== 'Todas') {
      whereConditions.push(`bd.Gerencia = '${gerenciaUsuario}'`);
      console.log(`🔒 Aplicando filtro de gerencia: ${gerenciaUsuario}`);
    }
    
    // Query DEFINITIVO: Solo UN registro por DNI de cada tabla (evitar duplicados)
    const query = `
      WITH analisis_unico AS (
        SELECT 
          dni,
          categoria,
          puntuacion_total,
          puntuacion_identificacion,
          puntuacion_verificacion,
          puntuacion_contextualizacion,
          puntuacion_sentimientos,
          conformidad,
          comentarios,
          fecha_llamada,
          created_at,
          ROW_NUMBER() OVER (PARTITION BY dni ORDER BY created_at DESC) as rn
        FROM \`peak-emitter-350713.Calidad_Llamadas.analisis_calidad\`
        WHERE dni IS NOT NULL
      ),
      transcripciones_unico AS (
        SELECT 
          dni,
          audio_url,
          transcripcion_texto,
          ROW_NUMBER() OVER (PARTITION BY dni ORDER BY created_at DESC) as rn
        FROM \`peak-emitter-350713.Calidad_Llamadas.transcripciones\`
        WHERE dni IS NOT NULL
      ),
      validacion_unico AS (
        SELECT
          NumeroDocumento,
          Nombre,
          Gestor,
          Supervisor,
          Vendedor,
          FechaHoraVal2,
          ResultadoVal2,
          ROW_NUMBER() OVER (PARTITION BY TRIM(NumeroDocumento) ORDER BY FechaHoraVal2 DESC) as rn
        FROM \`peak-emitter-350713.FR_Admision.Validacion_Ventas\`
        WHERE NumeroDocumento IS NOT NULL AND TRIM(NumeroDocumento) != ''
      )
      
      SELECT 
        -- Datos de análisis (tabla principal - 1 registro por DNI)
        a.dni,
        a.categoria,
        a.puntuacion_total,
        a.puntuacion_identificacion,
        a.puntuacion_verificacion,
        a.puntuacion_contextualizacion,
        a.puntuacion_sentimientos,
        a.conformidad,
        a.comentarios,
        a.fecha_llamada,
        a.created_at as fecha_creacion_analisis,
        
        -- Datos de transcripción (1 registro por DNI)
        t.audio_url as gsutil_url,
        t.transcripcion_texto,
        
        -- Datos de validación (INFO REAL)
        v.Nombre as nombre_cliente,
        v.Gestor as subgerente,
        v.Supervisor as supervisor,
        v.Vendedor as asesor_ventas,
        v.FechaHoraVal2 as fecha_validacion,
        v.ResultadoVal2 as resultado_validacion,
        
        -- Datos de gerencia (INFO REAL desde BD_DOTACION)
        bd.Gerencia as gerencia
        
      FROM analisis_unico a
      LEFT JOIN transcripciones_unico t ON a.dni = t.dni AND t.rn = 1
      LEFT JOIN validacion_unico v ON LTRIM(CAST(a.dni AS STRING), '0') = LTRIM(TRIM(v.NumeroDocumento), '0') AND v.rn = 1
      LEFT JOIN \`peak-emitter-350713.EP_Operaciones.BD_DOTACION\` bd ON v.Gestor = bd.SubGerencia_Jefatura
      WHERE a.rn = 1
      ${whereConditions.length > 0 ? ` AND ${whereConditions.join(' AND ')}` : ''}
      GROUP BY 
        a.dni, a.categoria, a.puntuacion_total, a.puntuacion_identificacion,
        a.puntuacion_verificacion, a.puntuacion_contextualizacion, a.puntuacion_sentimientos,
        a.conformidad, a.comentarios, a.fecha_llamada, a.created_at,
        t.audio_url, t.transcripcion_texto, v.Nombre, v.Gestor,
        v.Supervisor, v.Vendedor, v.FechaHoraVal2, v.ResultadoVal2, bd.Gerencia
      ORDER BY a.created_at DESC
    `;
    
    console.log('📝 Ejecutando query BigQuery completa...');
    const [rows] = await bigquery.query(query);
    console.log(`✅ Datos BigQuery completos obtenidos: ${rows.length} registros`);
    
    // Función para estandarizar categorías basadas en puntuación
    const estandarizarCategoria = (categoria, puntuacion) => {
      // Si ya viene una categoría estándar de BigQuery, usarla
      const categoriaOriginal = categoria?.toUpperCase();
      if (['MALA', 'MEDIA', 'BUENA', 'MUY BUENA'].includes(categoriaOriginal)) {
        return categoriaOriginal;
      }
      
      // Si no, categorizar automáticamente por score
      if (!puntuacion || puntuacion === 0) return 'PENDIENTE';
      if (puntuacion < 40) return 'MALA';
      if (puntuacion < 65) return 'MEDIA'; 
      if (puntuacion < 85) return 'BUENA';
      return 'MUY BUENA';
    };

    // Procesar datos para el frontend (ESTRUCTURA SIMPLIFICADA)
    const processedData = rows.map(row => ({
      dni: row.dni,
      fecha_llamada: row.fecha_llamada?.value || row.fecha_llamada,
      audio_url: row.gsutil_url,
      transcripcion_texto: row.transcripcion_texto || 'Transcripción no disponible',
      
      // DATOS DEL CLIENTE Y EQUIPO (desde validación - puede ser NULL)
      nombre_cliente: row.nombre_cliente || 'Sin datos',
      subgerente: row.subgerente || 'Sin asignar',
      supervisor: row.supervisor || 'Sin asignar', 
      asesor_ventas: row.asesor_ventas || 'Sin asignar',
      gerencia: row.gerencia || 'Sin gerencia',
      fecha_validacion: row.fecha_validacion,
      resultado_validacion: row.resultado_validacion || 'Sin resultado',
      
      // CALIDAD (datos principales)
      categoria: estandarizarCategoria(row.categoria, row.puntuacion_total),
      puntuacion_total: row.puntuacion_total || 0,
      puntuacion_identificacion: row.puntuacion_identificacion || 0,
      puntuacion_verificacion: row.puntuacion_verificacion || 0,
      puntuacion_contextualizacion: row.puntuacion_contextualizacion || 0,
      puntuacion_sentimientos: row.puntuacion_sentimientos || 0,
      
      // CONFORMIDAD
      conformidad: (row.conformidad === 'Conforme' || row.conformidad === 'CONFORME') ? 'Conforme' : 'No Conforme',
      comentarios: row.comentarios || 'Análisis pendiente'
    }));
    
    return processedData;
    
  } catch (error) {
    console.error('❌ Error consultando BigQuery completo:', error);
    throw error;
  }
}

// FUNCIÓN LEGACY: Función para leer CSV de registro de llamadas desde Cloud Storage
async function leerRegistroLlamadas() {
  try {
    console.log('📊 Leyendo registro de llamadas desde Cloud Storage...');
    
    if (!storage) {
      throw new Error('Google Cloud Storage no inicializado');
    }

    const bucket = storage.bucket('buckets_llamadas');
    const file = bucket.file('0000000000000000/registro_llamadas.csv');
    
    // Verificar si el archivo existe
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error('Archivo registro_llamadas.csv no encontrado');
    }
    
    // Descargar el contenido
    const [content] = await file.download();
    const csvContent = content.toString('utf-8');
    
    // Parse simple del CSV (sin librería externa)
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const values = line.split(',');
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index]?.trim() || null;
        });
        data.push(row);
      }
    }
    
    console.log(`✅ Registro CSV cargado: ${data.length} registros`);
    return data;
    
  } catch (error) {
    console.error('❌ Error leyendo registro de llamadas:', error);
    throw error;
  }
}

// Función para consultar análisis de calidad desde BigQueryasync function consultarAnalisisCalidad(filtroFecha = null) {  try {    console.log('🔍 Consultando análisis de calidad desde BigQuery...');        if (!bigquery) {      throw new Error('BigQuery no inicializado');    }        let whereClause = '';    if (filtroFecha) {      whereClause = `WHERE DATE(created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL ${filtroFecha} DAY)`;    }        const query = `      SELECT         dni,        fecha_llamada,        categoria,        puntuacion_total,        conformidad,        comentarios      FROM `peak-emitter-350713.Calidad_Llamadas.analisis_calidad`      ${whereClause}      ORDER BY created_at DESC    `;        console.log('📝 Ejecutando query análisis de calidad...');    const [rows] = await bigquery.query(query);    console.log(`✅ Datos análisis de calidad obtenidos: ${rows.length} registros`);        return rows;      } catch (error) {    console.error('❌ Error consultando análisis de calidad:', error);    throw error;  }}
// Función para consultar datos de negocio desde BigQuery
async function consultarValidacionVentas(filtroFecha = null) {
  try {
    console.log('🔍 Consultando datos de validación desde BigQuery...');
    
    if (!bigquery) {
      throw new Error('BigQuery no inicializado');
    }
    
    let whereClause = '';
    if (filtroFecha) {
      whereClause = `WHERE DATE(FechaHoraVal2) >= DATE_SUB(CURRENT_DATE(), INTERVAL ${filtroFecha} DAY)`;
    }
    
    const query = `
      SELECT 
        NumeroDocumento,
        Nombre,
        Gestor,
        Supervisor, 
        Vendedor,
        FechaHoraVal2
      FROM \`peak-emitter-350713.FR_Admision.Validacion_Ventas\`
      ${whereClause}
      ORDER BY FechaHoraVal2 DESC
    `;
    
    console.log('📝 Ejecutando query BigQuery...');
    const [rows] = await bigquery.query(query);
    
    console.log(`✅ Datos BigQuery obtenidos: ${rows.length} registros`);
    return rows;
    
  } catch (error) {
    console.error('❌ Error consultando BigQuery:', error);
    throw error;
  }
}

// Función para combinar datos de ambas fuentes
async function combinarDatos(csvData, bigqueryData) {
  try {
    console.log('🔗 Combinando datos de CSV y BigQuery...');
    
    // Crear un mapa de datos de negocio por DNI
    const datosNegocioMap = {};
    bigqueryData.forEach(row => {
      const dni = row.NumeroDocumento?.toString().trim();
      if (dni) {
        datosNegocioMap[dni] = row;
      }
    });
    
    // Combinar datos
    const datosUnificados = csvData.map(registro => {
      // Extraer DNI del registro CSV
      let dni = null;
      if (registro.gsutil_url) {
        const match = registro.gsutil_url.match(/\/(\d{8,})[\/_]/);
        if (match) {
          dni = match[1];
        }
      }
      
      // Buscar datos de negocio correspondientes
      const datosNegocio = dni ? datosNegocioMap[dni] : null;
      
      return {
        // Datos del CSV
        dni: dni,
        fecha_llamada: registro.Fecha_Llamada,
        gsutil_url: registro.gsutil_url,
        
        // Datos de BigQuery
        nombre_cliente: datosNegocio?.Nombre || 'No encontrado',
        gestor: datosNegocio?.Gestor || 'No encontrado',
        supervisor: datosNegocio?.Supervisor || 'No encontrado', 
        vendedor: datosNegocio?.Vendedor || 'No encontrado',
        fecha_validacion: datosNegocio?.FechaHoraVal2 || null,
        
        // Datos por defecto para calidad (hasta implementar análisis)
        categoria: 'PENDIENTE',
        puntuacion_total: 0,
        conformidad: 'PENDIENTE',
        comentario: 'Análisis pendiente'
      };
    });
    
    console.log(`✅ Datos combinados: ${datosUnificados.length} registros`);
    return datosUnificados;
    
  } catch (error) {
    console.error('❌ Error combinando datos:', error);
    throw error;
  }
}

// ========== NUEVO ENDPOINT UNIFICADO ==========

// Endpoint principal para obtener datos del dashboard sin Excel
// Endpoint optimizado que lee SOLO desde BigQuery
// ENDPOINT TEMPORAL - Revisar tablas principales
// Endpoint para obtener gerencias disponibles
app.get('/api/debug/gerencias', verifyToken, async (req, res) => {
  try {
    console.log('🏢 Obteniendo gerencias disponibles...');
    
    if (!bigquery) {
      return res.status(500).json({ error: 'BigQuery no inicializado' });
    }

    const queryGerencias = `
      SELECT DISTINCT bd.Gerencia
      FROM \`peak-emitter-350713.EP_Operaciones.BD_DOTACION\` bd
      WHERE bd.Gerencia IS NOT NULL
      ORDER BY bd.Gerencia
    `;
    
    const [rows] = await bigquery.query(queryGerencias);
    
    const gerencias = rows.map(row => row.Gerencia);
    
    console.log('🏢 Gerencias encontradas:', gerencias);

    res.json({
      success: true,
      gerencias: gerencias
    });

  } catch (error) {
    console.error('❌ Error obteniendo gerencias:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/debug/tables', verifyToken, async (req, res) => {
  try {
    console.log('🔍 DEBUGGEANDO TABLAS PRINCIPALES...');
    
    if (!bigquery) {
      return res.status(500).json({ error: 'BigQuery no inicializado' });
    }

    // Consulta 1: Contar registros en analisis_calidad
    const queryAnalisis = `
      SELECT 
        COUNT(*) as total_analisis,
        COUNT(DISTINCT dni) as dnis_unicos_analisis
      FROM \`peak-emitter-350713.Calidad_Llamadas.analisis_calidad\`
    `;
    
    // Consulta 2: Contar registros en transcripciones
    const queryTranscripciones = `
      SELECT 
        COUNT(*) as total_transcripciones,
        COUNT(DISTINCT dni) as dnis_unicos_transcripciones
      FROM \`peak-emitter-350713.Calidad_Llamadas.transcripciones\`
    `;

    // Consulta 3: Ver algunos registros de análisis
    const querySampleAnalisis = `
      SELECT dni, categoria, puntuacion_total, created_at, fecha_llamada
      FROM \`peak-emitter-350713.Calidad_Llamadas.analisis_calidad\`
      ORDER BY created_at DESC
      LIMIT 15
    `;

    // Consulta 4: Ver algunos registros de transcripciones
    const querySampleTranscripciones = `
      SELECT dni, audio_url, created_at, fecha_llamada
      FROM \`peak-emitter-350713.Calidad_Llamadas.transcripciones\`
      ORDER BY created_at DESC
      LIMIT 15
    `;

    console.log('📊 Ejecutando consultas de debug...');
    
    const [rowsAnalisis] = await bigquery.query(queryAnalisis);
    const [rowsTranscripciones] = await bigquery.query(queryTranscripciones);
    const [sampleAnalisis] = await bigquery.query(querySampleAnalisis);
    const [sampleTranscripciones] = await bigquery.query(querySampleTranscripciones);

    const debug_info = {
      analisis_calidad: {
        total_registros: rowsAnalisis[0].total_analisis,
        dnis_unicos: rowsAnalisis[0].dnis_unicos_analisis,
        sample_data: sampleAnalisis
      },
      transcripciones: {
        total_registros: rowsTranscripciones[0].total_transcripciones,
        dnis_unicos: rowsTranscripciones[0].dnis_unicos_transcripciones,
        sample_data: sampleTranscripciones
      }
    };

    console.log('🔍 RESULTADOS DEBUG:');
    console.log('📊 Análisis_calidad:', rowsAnalisis[0].total_analisis, 'registros,', rowsAnalisis[0].dnis_unicos_analisis, 'DNIs únicos');
    console.log('📊 Transcripciones:', rowsTranscripciones[0].total_transcripciones, 'registros,', rowsTranscripciones[0].dnis_unicos_transcripciones, 'DNIs únicos');

    res.json({
      success: true,
      debug_info
    });

  } catch (error) {
    console.error('❌ Error en debug de tablas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/dashboard/data', verifyToken, async (req, res) => {
  try {
    console.log('🎯 Iniciando consulta optimizada desde BigQuery...');
    console.log(`👤 Usuario: ${req.user.email}, Rol: ${req.user.role}, Gerencia: ${req.user.gerencia || 'Todas'}`);
    
    // Parámetros de filtrado
    const { dias = 30 } = req.query;
    
    // NUEVO: Control de acceso por gerencia
    const gerenciaFiltro = req.user.gerencia; // Solo aplicar filtro si el usuario tiene gerencia específica
    
    // Consultar datos completos desde BigQuery con filtro de gerencia
    const datosCompletos = await consultarDatosBigQueryCompletos(parseInt(dias), gerenciaFiltro);
    
    // Filtrar solo registros con DNI válido
    const datosValidos = datosCompletos.filter(item => item.dni);
    
    console.log(`✅ Consulta BigQuery optimizada completada: ${datosValidos.length} registros`);
    
    res.json({
      success: true,
      data: datosValidos,
      total: datosValidos.length,
      timestamp: new Date().toISOString(),
      source: 'BigQuery Only (Optimizado)',
      performance: {
        processed_from_analysis: datosCompletos.filter(item => item.categoria !== 'PENDIENTE').length,
        pending_analysis: datosCompletos.filter(item => item.categoria === 'PENDIENTE').length
      }
    });
    
  } catch (error) {
    console.error('❌ Error en endpoint optimizado:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo datos desde BigQuery',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ========== ENDPOINT DE DATOS DE PRUEBA ==========

// Endpoint temporal con datos de prueba mientras resolvemos las credenciales
app.get('/api/dashboard/demo', verifyToken, (req, res) => {
  console.log('🎯 Sirviendo datos de prueba...');
  
  // Generar datos de prueba realistas
  const datosDemo = [];
  const categorias = ['MUY BUENA', 'BUENA', 'MEDIA', 'MALA'];
  const conformidad = ['Conforme', 'No Conforme'];
  const gestores = ['Juan Pérez', 'María García', 'Carlos López'];
  const supervisores = ['Ana Ruiz', 'Pedro Sánchez'];
  const vendedores = ['Luis Torres', 'Carmen Silva', 'Roberto Cruz', 'Elena Vargas'];
  
  // Generar 50 registros de prueba
  for (let i = 0; i < 50; i++) {
    const fechaRandom = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    datosDemo.push({
      dni: `1234567${String(i).padStart(2, '0')}`,
      nombre_cliente: `Cliente de Prueba ${i + 1}`,
      categoria: categorias[Math.floor(Math.random() * categorias.length)],
      puntuacion_total: Math.floor(Math.random() * 100),
      conformidad: conformidad[Math.floor(Math.random() * conformidad.length)],
      comentario: `Comentario de prueba para el cliente ${i + 1}`,
      gestor: gestores[Math.floor(Math.random() * gestores.length)],
      supervisor: supervisores[Math.floor(Math.random() * supervisores.length)],
      vendedor: vendedores[Math.floor(Math.random() * vendedores.length)],
      fecha_llamada: fechaRandom.toISOString(),
      gsutil_url: `gs://bucket-demo/audio_${i + 1}.mp3`
    });
  }
  
  console.log(`✅ Datos de prueba generados: ${datosDemo.length} registros`);
  
  res.json({
    success: true,
    data: datosDemo,
    total: datosDemo.length,
    timestamp: new Date().toISOString(),
    source: 'Demo Data - Para pruebas mientras configuramos Google Cloud'
  });
});

// Manejo de errores
app.use((error, req, res, next) => {
  console.error('❌ Error no manejado:', error);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint no encontrado',
    path: req.path,
    method: req.method
  });
});

// Ruta para servir el frontend React (SPA routing)
app.get('*', (req, res) => {
  // Solo servir el frontend si no es una ruta de API
  if (!req.path.startsWith('/api/')) {
    res.sendFile(__dirname + '/public/index.html');
  } else {
    res.status(404).json({
      success: false,
      error: 'Endpoint no encontrado',
      path: req.path,
      method: req.method
    });
  }
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('🚀 ===== DASHBOARD BACKEND INICIADO =====');
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/api/health`);
  console.log(`ℹ️  Info: http://localhost:${PORT}/api/info`);
  console.log(`🔐 Proyecto GCP: ${GOOGLE_CLOUD_PROJECT_ID}`);
  console.log(`👥 Usuarios configurados: ${Object.keys(USUARIOS).length}`);
  console.log('=======================================');
  
  // Test inicial de Google Cloud
  if (storage) {
    console.log('✅ Google Cloud Storage está listo');
  } else {
    console.log('⚠️ Google Cloud Storage no configurado');
  }
  console.log('');
});

module.exports = app;