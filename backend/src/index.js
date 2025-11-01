const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
require('dotenv').config();

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
const parametrosRoutes = require('./routes/parametros');
const atributosRoutes = require('./routes/atributos');
const aiConfigsRoutes = require('./routes/ai-configs');
const aiRulesRoutes = require('./routes/ai-rules');
const syncRoutes = require('./routes/sync');
const { router: syncApiKeysRoutes } = require('./routes/syncApiKeys');
const jobsRoutes = require('./routes/jobs');
const planesRoutes = require('./routes/planes');
const menuRoutes = require('./routes/menu');

const app = express();
const PORT = process.env.PORT || 5050;

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
app.use(helmet());
app.use(limiter);
app.use(cors({
  origin: process.env.NODE_ENV === 'development'
    ? true // Permite todos los orígenes en desarrollo
    : [
        process.env.FRONTEND_URL || 'http://localhost:3000',
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
app.use('/api/parametros', parametrosRoutes);
app.use('/api/atributos', atributosRoutes);
app.use('/api/ai-configs', aiConfigsRoutes);
app.use('/api/ai-rules', aiRulesRoutes);

// Sincronización SQL
app.use('/api/sync', syncRoutes);
app.use('/api/sync/api-keys', syncApiKeysRoutes);

// Sistema
app.use('/api/jobs', jobsRoutes);
app.use('/api/planes', planesRoutes);
app.use('/api/menu', menuRoutes);

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
