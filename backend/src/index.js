const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

// Cargar variables de entorno con ruta explícita
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Validar variables críticas al iniciar
if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET no está definido en .env');
  console.error('   Asegúrate de que backend/.env existe y tiene JWT_SECRET sin comillas');
  console.error('   Ejemplo: JWT_SECRET=tu-secreto-largo');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('❌ FATAL: DATABASE_URL no está definido en .env');
  console.error('   Asegúrate de que backend/.env existe y tiene DATABASE_URL sin comillas');
  process.exit(1);
}

console.log('✅ Variables de entorno cargadas correctamente');
console.log(`   JWT_SECRET: ${process.env.JWT_SECRET.substring(0, 20)}... (${process.env.JWT_SECRET.length} chars)`);
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL.substring(0, 30)}...`);

// Configurar passport
require('./config/passport');

// ============================================
// RUTAS DE PARSE - Solo funcionalidades core
// ============================================
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const tenantsRoutes = require('./routes/tenants');
const documentosRoutes = require('./routes/documentos');
const promptsRoutes = require('./routes/prompts');
const reglasRoutes = require('./routes/reglas');
const sugerenciasIARoutes = require('./routes/sugerencias-ia');
const parametrosRoutes = require('./routes/parametros');
const atributosRoutes = require('./routes/atributos');
const aiConfigsRoutes = require('./routes/ai-configs');
const aiModelsRoutes = require('./routes/ai-models');
const aiRulesRoutes = require('./routes/ai-rules');
const patronesAprendidosRoutes = require('./routes/patrones-aprendidos');
const documentDetectionConfigRoutes = require('./routes/document-detection-config');
const syncRoutes = require('./routes/sync');
const { router: syncApiKeysRoutes } = require('./routes/syncApiKeys');
const apiConnectorsRoutes = require('./routes/api-connectors');
const webhooksRoutes = require('./routes/webhooks');
const metricsRoutes = require('./routes/metrics');
const jobsRoutes = require('./routes/jobs');
const planesRoutes = require('./routes/planes');
const menuRoutes = require('./routes/menu');
const chatRoutes = require('./routes/chat');

// Parse API - Endpoints públicos para aplicaciones externas
const parseApiRoutes = require('./routes/parseApi');

// OAuth 2.0 API Pública - Sprint 4
const authApiRoutes = require('./routes/authApi');        // /api/v1/auth/*
const publicApiRoutes = require('./routes/publicApi');    // /api/v1/documents/*
const oauthClientsRoutes = require('./routes/oauthClients'); // /api/oauth-clients (admin UI)

// Webhooks OAuth - Sprint 6
const oauthWebhooksRoutes = require('./routes/oauthWebhooks'); // /api/v1/webhooks
const oauthClientWebhooksRoutes = require('./routes/oauthClientWebhooks'); // /api/oauth-clients/:id/webhooks (admin proxy)

const app = express();
const PORT = process.env.PORT || 5100;

// Configurar trust proxy para producción
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Rate limiting - configuración ajustable por variables de entorno
const rateLimitConfig = {
  windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES) || 15) * 60 * 1000,
  max: process.env.NODE_ENV === 'development'
    ? (parseInt(process.env.RATE_LIMIT_DEV) || 1000)
    : (parseInt(process.env.RATE_LIMIT_PROD) || 2000),
  message: {
    error: 'Rate limit exceeded',
    message: 'Demasiadas peticiones desde esta IP. Por favor, espera unos minutos antes de intentar nuevamente.',
    retryAfter: (parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES) || 15) * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Omitir rate limiting para health check
    return req.path === '/api/health';
  },
  handler: (req, res) => {
    const windowMinutes = (parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES) || 15);
    console.error(`❌ [RATE LIMIT BLOCKED] IP ${req.ip} bloqueada por exceder límite`);
    console.error(`❌ [RATE LIMIT BLOCKED] Endpoint: ${req.method} ${req.originalUrl}`);

    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Demasiadas peticiones desde esta IP. Por favor, espera unos minutos antes de intentar nuevamente.',
      retryAfter: windowMinutes * 60,
      limit: rateLimitConfig.max,
      windowMinutes: windowMinutes
    });
  }
};

const limiter = rateLimit(rateLimitConfig);

// Log de configuración al iniciar
console.log(`🛡️  [RATE LIMIT CONFIG] Límite: ${rateLimitConfig.max} requests por ${(parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES) || 15)} minutos`);
console.log(`🛡️  [RATE LIMIT CONFIG] Ambiente: ${process.env.NODE_ENV}`);

// Middleware
const apiResponse = require('./middleware/apiResponse');
app.use(helmet());
app.use(limiter);
app.use(apiResponse); // Agregar helper methods a res
app.use(cors({
  origin: process.env.NODE_ENV === 'development'
    ? true // Permite todos los orígenes en desarrollo
    : [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'https://parsedemo.axiomacloud.com',
        'http://localhost:3001',
        'http://localhost:8084',
        'http://149.50.148.198:8084'
      ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Connection status middleware
app.use((req, res, next) => {
  res.on('close', () => {
    if (!res.finished) {
      console.warn(`Connection closed prematurely for ${req.method} ${req.originalUrl}`);
    }
  });
  next();
});

// ============================================
// RUTAS DE PARSE
// ============================================

// Autenticación y usuarios
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/tenants', tenantsRoutes);

// Core Parse - Procesamiento de documentos
app.use('/api/documentos', documentosRoutes);
app.use('/api/prompts', promptsRoutes);
app.use('/api/reglas', reglasRoutes);
app.use('/api/sugerencias-ia', sugerenciasIARoutes);
app.use('/api/parametros', parametrosRoutes);
app.use('/api/atributos', atributosRoutes);
app.use('/api/ai-configs', aiConfigsRoutes);
app.use('/api/ai-models', aiModelsRoutes);
app.use('/api/ai-rules', aiRulesRoutes);
app.use('/api/patrones-aprendidos', patronesAprendidosRoutes);
app.use('/api/document-detection-config', documentDetectionConfigRoutes);

// Sincronización SQL
app.use('/api/sync', syncRoutes);
app.use('/api/sync/api-keys', syncApiKeysRoutes);

// API Connectors - Sincronización via APIs REST
app.use('/api/api-connectors', apiConnectorsRoutes);

// Webhooks - Notificaciones de eventos
app.use('/api/webhooks', webhooksRoutes);

// Métricas y monitoreo
app.use('/api/metrics', metricsRoutes);

// Parse API Pública - Endpoints para aplicaciones externas (autenticación con API Key)
app.use('/api/v1/parse', parseApiRoutes);

// OAuth 2.0 API Pública - Sprint 4 (autenticación con OAuth Bearer tokens)
app.use('/api/v1/auth', authApiRoutes);           // Autenticación OAuth (token, refresh, revoke)
app.use('/api/v1/documents', publicApiRoutes);    // API pública de consulta de documentos
app.use('/api/v1/webhooks', oauthWebhooksRoutes); // Webhooks OAuth (Sprint 6)
app.use('/api/oauth-clients', oauthClientsRoutes); // CRUD de OAuth clients (admin UI)
app.use('/api/oauth-clients', oauthClientWebhooksRoutes); // Webhooks OAuth (admin proxy - Sprint 6.5)

// Documentación OpenAPI/Swagger
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Parse API - Documentación',
  customfavIcon: '/favicon.ico'
}));

// JSON de la especificación OpenAPI
app.get('/api/v1/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Sistema
app.use('/api/jobs', jobsRoutes);
app.use('/api/planes', planesRoutes);
app.use('/api/menu', menuRoutes);

// Chat - Asistente Axio
app.use('/api/chat', chatRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    app: 'Parse - Document Extraction System'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Parse Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 CORS enabled for: ${process.env.FRONTEND_URL}`);
  console.log(`📄 Parse - Document Extraction & Transformation System`);
});
