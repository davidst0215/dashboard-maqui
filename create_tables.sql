-- Tabla para almacenar transcripciones de Deepgram
CREATE TABLE `peak-emitter-350713.Calidad_Llamadas.transcripciones` (
  dni STRING NOT NULL,
  fecha_llamada TIMESTAMP NOT NULL,
  audio_url STRING NOT NULL,
  transcripcion_texto STRING,
  transcripcion_json JSON,
  duracion_segundos INTEGER,
  confianza_promedio FLOAT64,
  proveedor STRING DEFAULT 'deepgram',
  estado STRING DEFAULT 'pendiente', -- pendiente, procesado, error
  error_mensaje STRING,
  tokens_deepgram INTEGER,
  costo_deepgram_usd FLOAT64,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- Tabla para almacenar análisis de calidad de OpenAI
CREATE TABLE `peak-emitter-350713.Calidad_Llamadas.analisis_calidad` (
  dni STRING NOT NULL,
  fecha_llamada TIMESTAMP NOT NULL,
  transcripcion_id STRING, -- referencia a transcripciones
  categoria STRING, -- MUY BUENA, BUENA, MEDIA, MALA
  puntuacion_total INTEGER,
  puntuacion_identificacion FLOAT64,
  puntuacion_verificacion FLOAT64,
  puntuacion_contextualizacion FLOAT64,
  puntuacion_sentimientos FLOAT64,
  conformidad STRING, -- Conforme, No Conforme
  comentarios STRING,
  analisis_detallado JSON, -- respuesta completa de OpenAI
  prompt_usado STRING,
  modelo_openai STRING DEFAULT 'gpt-4o-mini',
  tokens_prompt INTEGER,
  tokens_completion INTEGER,
  costo_openai_usd FLOAT64,
  tiempo_procesamiento_segundos FLOAT64,
  estado STRING DEFAULT 'pendiente', -- pendiente, completado, error
  error_mensaje STRING,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- Tabla para métricas y monitoreo del pipeline
CREATE TABLE `peak-emitter-350713.Calidad_Llamadas.metricas_pipeline` (
  fecha DATE NOT NULL,
  audios_procesados INTEGER DEFAULT 0,
  transcripciones_exitosas INTEGER DEFAULT 0,
  analisis_completados INTEGER DEFAULT 0,
  tiempo_promedio_transcripcion FLOAT64,
  tiempo_promedio_analisis FLOAT64,
  costo_total_deepgram FLOAT64 DEFAULT 0.0,
  costo_total_openai FLOAT64 DEFAULT 0.0,
  errores_transcripcion INTEGER DEFAULT 0,
  errores_analisis INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- Índices para optimizar consultas
CREATE INDEX idx_transcripciones_dni_fecha ON `peak-emitter-350713.Calidad_Llamadas.transcripciones`(dni, fecha_llamada);
CREATE INDEX idx_analisis_dni_fecha ON `peak-emitter-350713.Calidad_Llamadas.analisis_calidad`(dni, fecha_llamada);
CREATE INDEX idx_transcripciones_estado ON `peak-emitter-350713.Calidad_Llamadas.transcripciones`(estado);
CREATE INDEX idx_analisis_estado ON `peak-emitter-350713.Calidad_Llamadas.analisis_calidad`(estado);