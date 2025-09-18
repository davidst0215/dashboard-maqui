# 🚀 Guía de Despliegue - Dashboard Maqui

## 📋 Arquitectura de Producción

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   VERCEL        │    │   CLOUD RUN      │    │ CLOUD FUNCTIONS │
│   (Frontend)    │───▶│   (Backend API)  │◀───│ (AI Processing) │
│   React + Vite  │    │   Node.js + JWT  │    │ Transcription + │
│   Global CDN    │    │   Auto-scaling   │    │ Quality Analysis│
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────────────────────────┐
                       │         GOOGLE CLOUD STORAGE        │
                       │      + BIGQUERY DATABASE            │
                       │   Audios + Transcripciones + Data   │
                       └─────────────────────────────────────┘
```

## 🎯 Ventajas de esta Arquitectura

- ✅ **100% Serverless**: No gestión de servidores
- ✅ **Auto-escalado**: Maneja desde 1 hasta millones de usuarios
- ✅ **Costo-eficiente**: Pagas solo por uso real
- ✅ **Alta disponibilidad**: 99.95% uptime garantizado
- ✅ **Global**: Frontend distribuido mundialmente
- ✅ **CI/CD**: Deploy automático desde Git
- ✅ **Seguro**: IAM + HTTPS + JWT integrado

## 🚀 Despliegue Rápido (10 minutos)

### Prerequisitos
- Google Cloud SDK instalado y configurado
- Cuenta de Vercel
- Repositorio GitHub del proyecto

### Paso 1: Clonar y Preparar
```bash
git clone [tu-repo]
cd dashboard-maqui
chmod +x deploy.sh
```

### Paso 2: Ejecutar Script de Despliegue
```bash
./deploy.sh
```

El script automáticamente:
1. 🏗️ Despliega el backend en Cloud Run
2. ☁️ Despliega las Cloud Functions 
3. ⏰ Configura el scheduler automático
4. 🔧 Configura todas las variables necesarias

### Paso 3: Desplegar Frontend en Vercel

1. **Conectar Repositorio**:
   - Ve a [vercel.com](https://vercel.com)
   - Conecta tu repositorio GitHub
   - Vercel detectará automáticamente React

2. **Configurar Variables de Entorno**:
   ```
   VITE_API_BASE_URL = [URL del backend de Cloud Run]
   NODE_ENV = production
   ```

3. **Deploy Automático**:
   - Vercel desplegará automáticamente
   - Cada push a main → deploy automático

## 🔧 Configuración Manual (Alternativa)

### Backend (Cloud Run)
```bash
cd dashboard-backend
gcloud builds submit --config cloudbuild.yaml
```

### Cloud Functions
```bash
# Transcripción
cd cloud-functions/transcription-function
gcloud functions deploy transcribeAudio --trigger-bucket=buckets_llamadas --runtime=nodejs18

# Análisis de Calidad
cd ../quality-analysis-function
gcloud functions deploy analyzeQuality --trigger-http --runtime=nodejs18 --allow-unauthenticated
```

## 📊 Monitoreo y Logs

### Ver Logs del Backend
```bash
gcloud logs tail --service=maqui-dashboard-backend
```

### Ver Logs de Cloud Functions
```bash
gcloud functions logs read transcribeAudio --limit=50
gcloud functions logs read analyzeQuality --limit=50
```

### Métricas en Cloud Console
- **Cloud Run**: CPU, memoria, requests/segundo
- **Cloud Functions**: Ejecuciones, errores, latencia
- **BigQuery**: Consultas, costos, performance

## 🔒 Seguridad

### Autenticación
- JWT tokens con expiración
- Roles: admin, gerente, analyst
- Filtrado automático por gerencia

### CORS y HTTPS
- CORS configurado para Vercel domain
- HTTPS automático en todas las URLs
- Headers de seguridad configurados

### Variables de Entorno
```bash
# Producción - nunca commits estas
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
JWT_SECRET=your-super-secret-key
NODE_ENV=production
```

## 💰 Costos Estimados

Para 1000 audios/mes típicos:

| Servicio | Costo Mensual | Descripción |
|----------|---------------|-------------|
| Cloud Run (Backend) | ~$5-15 | Solo cuando hay requests |
| Cloud Functions | ~$10-30 | Por procesamiento de audio |
| Cloud Storage | ~$1-5 | Por almacenar audios |
| BigQuery | ~$2-10 | Por consultas y storage |
| Speech-to-Text | ~$20-60 | Por minutos de audio |
| Vertex AI (Análisis) | ~$5-15 | Por análisis IA |
| Vercel | $0 | Plan gratuito para proyectos pequeños |
| **TOTAL** | **~$43-140** | **Escalado por uso real** |

## 🚨 Troubleshooting

### Error: "Permission denied"
```bash
gcloud auth login
gcloud config set project peak-emitter-350713
```

### Error: "API not enabled"
```bash
gcloud services enable cloudbuild.googleapis.com run.googleapis.com
```

### Error de CORS en Frontend
- Verificar que BACKEND_URL esté correctamente configurado
- Verificar configuración CORS en server.js

### Cloud Function no se activa
```bash
# Verificar bucket trigger
gsutil ls gs://buckets_llamadas
gcloud functions describe transcribeAudio
```

## 📈 Escalabilidad

### Límites por Defecto
- **Cloud Run**: 100 instancias concurrentes
- **Cloud Functions**: 1000 ejecuciones concurrentes  
- **BigQuery**: 100 consultas concurrentes

### Para Escalar Más
```bash
# Aumentar límites de Cloud Run
gcloud run services update maqui-dashboard-backend --max-instances=500

# Optimizar Cloud Functions
gcloud functions deploy transcribeAudio --memory=2GB --timeout=540s
```

## 🔄 CI/CD y Updates

### Deploy Automático
1. **Frontend**: Push a main → Deploy automático en Vercel
2. **Backend**: Push a main → Trigger Cloud Build → Deploy automático
3. **Functions**: Deploy manual con `./deploy.sh`

### Rollback Rápido
```bash
# Backend
gcloud run revisions list --service=maqui-dashboard-backend
gcloud run services update-traffic maqui-dashboard-backend --to-revisions=[REVISION-ID]=100

# Frontend (Vercel)
# Usar Vercel Dashboard para rollback instantáneo
```

## 📞 Soporte

### Logs y Debugging
- **Cloud Console**: console.cloud.google.com
- **Vercel Dashboard**: vercel.com/dashboard
- **Error Reporting**: Automático en Cloud Console

### Contacto
- Documentación técnica en este README
- Logs automáticos en Cloud Console
- Alertas configurables por email/Slack

---

## ✅ Checklist de Despliegue

- [ ] Google Cloud SDK configurado
- [ ] APIs habilitadas en GCP
- [ ] Service Account con permisos
- [ ] Repositorio en GitHub
- [ ] Cuenta de Vercel configurada
- [ ] Script `./deploy.sh` ejecutado exitosamente
- [ ] Frontend desplegado en Vercel
- [ ] URLs funcionando correctamente
- [ ] Test completo: subir audio → transcripción → análisis → dashboard

**🎉 ¡Tu sistema ya es completamente independiente y escalable!**