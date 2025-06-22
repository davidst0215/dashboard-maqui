// test-connection.js - Script para probar la conexión con Google Cloud
require('dotenv').config();
const { Storage } = require('@google-cloud/storage');

const GOOGLE_CLOUD_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;
const BUCKET_NAME = 'buckets_llamadas'; // Tu bucket de audios

async function testGoogleCloudConnection() {
  console.log('🧪 ===== PRUEBA DE CONEXIÓN GOOGLE CLOUD =====');
  console.log('📁 Proyecto:', GOOGLE_CLOUD_PROJECT_ID);
  console.log('🪣 Bucket:', BUCKET_NAME);
  console.log('');

  try {
    // Inicializar cliente
    let storage;
    
    if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      console.log('🔑 Usando credenciales de variables de entorno...');
      storage = new Storage({
        projectId: GOOGLE_CLOUD_PROJECT_ID,
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('🔑 Usando archivo de credenciales...');
      storage = new Storage({
        projectId: GOOGLE_CLOUD_PROJECT_ID,
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      });
    } else {
      console.log('🔑 Usando autenticación automática...');
      storage = new Storage({ projectId: GOOGLE_CLOUD_PROJECT_ID });
    }

    // Test 1: Listar buckets
    console.log('1️⃣ Probando acceso a buckets...');
    const [buckets] = await storage.getBuckets();
    console.log(`✅ Buckets encontrados: ${buckets.length}`);
    
    const bucketNames = buckets.map(b => b.name);
    console.log('📋 Lista de buckets:', bucketNames.slice(0, 5));
    
    // Verificar si existe nuestro bucket
    const targetBucket = buckets.find(b => b.name === BUCKET_NAME);
    if (targetBucket) {
      console.log(`✅ Bucket objetivo encontrado: ${BUCKET_NAME}`);
    } else {
      console.log(`❌ Bucket objetivo NO encontrado: ${BUCKET_NAME}`);
      console.log('💡 Buckets disponibles:', bucketNames);
    }

    // Test 2: Listar archivos en el bucket (si existe)
    if (targetBucket) {
      console.log('');
      console.log('2️⃣ Probando acceso a archivos...');
      
      const bucket = storage.bucket(BUCKET_NAME);
      const [files] = await bucket.getFiles({ maxResults: 10 });
      
      console.log(`✅ Archivos encontrados: ${files.length}`);
      
      if (files.length > 0) {
        console.log('📄 Muestra de archivos:');
        files.slice(0, 5).forEach((file, index) => {
          console.log(`   ${index + 1}. ${file.name}`);
        });
        
        // Test 3: Generar URL firmada para el primer archivo
        console.log('');
        console.log('3️⃣ Probando generación de URL firmada...');
        
        const firstFile = files[0];
        try {
          const [signedUrl] = await firstFile.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000, // 15 minutos
          });
          
          console.log(`✅ URL firmada generada para: ${firstFile.name}`);
          console.log(`🔗 URL: ${signedUrl.substring(0, 100)}...`);
          
        } catch (urlError) {
          console.log(`❌ Error generando URL firmada: ${urlError.message}`);
        }
      } else {
        console.log('⚠️ No hay archivos en el bucket');
      }
    }

    console.log('');
    console.log('✅ ===== PRUEBA COMPLETADA EXITOSAMENTE =====');
    
  } catch (error) {
    console.log('');
    console.log('❌ ===== ERROR EN LA PRUEBA =====');
    console.error('Error:', error.message);
    
    if (error.code === 'ENOENT') {
      console.log('💡 El archivo de credenciales no se encontró');
      console.log('💡 Verifica la variable GOOGLE_APPLICATION_CREDENTIALS');
    } else if (error.code === 401) {
      console.log('💡 Error de autenticación');
      console.log('💡 Verifica que las credenciales sean correctas');
    } else if (error.code === 403) {
      console.log('💡 Error de permisos');
      console.log('💡 Verifica que la cuenta de servicio tenga los permisos necesarios');
    }
    
    console.log('');
    console.log('🛠️ Pasos para solucionar:');
    console.log('1. Verifica que el proyecto ID sea correcto');
    console.log('2. Asegúrate de que las credenciales estén configuradas');
    console.log('3. Verifica los permisos de la cuenta de servicio');
    console.log('4. Revisa que el bucket existe y es accesible');
  }
}

// Función para verificar variables de entorno
function checkEnvironmentVariables() {
  console.log('🔍 ===== VERIFICACIÓN DE VARIABLES =====');
  
  const requiredVars = ['GOOGLE_CLOUD_PROJECT_ID'];
  const optionalVars = ['GOOGLE_CLIENT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_APPLICATION_CREDENTIALS'];
  
  requiredVars.forEach(varName => {
    if (process.env[varName]) {
      console.log(`✅ ${varName}: ${process.env[varName]}`);
    } else {
      console.log(`❌ ${varName}: NO CONFIGURADA`);
    }
  });
  
  optionalVars.forEach(varName => {
    if (process.env[varName]) {
      const value = varName === 'GOOGLE_PRIVATE_KEY' 
        ? `${process.env[varName].substring(0, 50)}...` 
        : process.env[varName];
      console.log(`✅ ${varName}: ${value}`);
    } else {
      console.log(`⚪ ${varName}: no configurada`);
    }
  });
  
  console.log('');
}

// Ejecutar pruebas
async function runTests() {
  checkEnvironmentVariables();
  await testGoogleCloudConnection();
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  runTests()
    .then(() => {
      console.log('🏁 Pruebas completadas');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { testGoogleCloudConnection, checkEnvironmentVariables };