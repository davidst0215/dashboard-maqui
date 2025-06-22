// server.js - Backend de autenticación y proxy de audios para despliegue
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Storage } = require('@google-cloud/storage');

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
      utils: [
        'GET /api/health',
        'GET /api/info'
      ]
    },
    environment: process.env.NODE_ENV || 'development',
    project_id: GOOGLE_CLOUD_PROJECT_ID
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