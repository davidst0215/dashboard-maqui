// server.js - Backend de autenticación y proxy de audios para despliegue
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Storage } = require('@google-cloud/storage');
const { BigQuery } = require('@google-cloud/bigquery');

const app = express();
const PORT = process.env.PORT || 3001;

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

// Base de datos de usuarios (temporal)
const USUARIOS = {
  'admin@sayainvestments.co': { 
    password: 'password123', 
    role: 'admin',
    name: 'Administrador' 
  },
  'analista1@sayainvestments.co': { 
    password: 'password123', 
    role: 'analyst',
    name: 'Analista 1' 
  },
  'supervisor@sayainvestments.co': { 
    password: 'password123', 
    role: 'supervisor',
    name: 'Supervisor' 
  },
  'david@sayainvestments.co': { 
    password: 'password123', 
    role: 'manager',
    name: 'David' 
  }
};

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:3000', 
    'https://dashboard-maqui.vercel.app',
    'https://dashboard-maqui-david-sayainvestmes-projects.vercel.app',
  
    'https://*.vercel.app'
  ],
  credentials: true
}));

app.use(express.json());

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
  }
}));

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

    // Generar JWT
    const token = jwt.sign(
      { 
        email: email, 
        role: user.role, 
        name: user.name 
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
        name: user.name
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

// Función para leer CSV de registro de llamadas desde Cloud Storage
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
app.get('/api/dashboard/data', verifyToken, async (req, res) => {
  try {
    console.log('🎯 Iniciando consulta unificada de datos...');
    
    // Parámetros de filtrado
    const { dias = 30 } = req.query;
    
    // 1. Leer metadatos de audios desde CSV
    const csvData = await leerRegistroLlamadas();
    
    // 2. Consultar datos de negocio desde BigQuery  
    const bigqueryData = await consultarValidacionVentas(parseInt(dias));
    
    // 3. Combinar ambas fuentes
    const datosUnificados = await combinarDatos(csvData, bigqueryData);
    
    // 4. Filtrar solo registros con DNI válido
    const datosValidos = datosUnificados.filter(item => item.dni);
    
    console.log(`✅ Consulta completada: ${datosValidos.length} registros válidos`);
    
    res.json({
      success: true,
      data: datosValidos,
      total: datosValidos.length,
      timestamp: new Date().toISOString(),
      source: 'Cloud Storage + BigQuery'
    });
    
  } catch (error) {
    console.error('❌ Error en endpoint unificado:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo datos unificados',
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