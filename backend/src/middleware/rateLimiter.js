/**
 * Rate Limiter Middleware
 *
 * Implementa rate limiting por API Key usando Redis (si está disponible)
 * o memoria en caso contrario (fallback para desarrollo)
 */

const Redis = require('ioredis');

// Configurar Redis (opcional)
let redis = null;
const USE_REDIS = process.env.REDIS_URL || process.env.USE_REDIS === 'true';

if (USE_REDIS) {
  try {
    redis = new Redis(process.env.REDIS_URL || {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn('⚠️ Redis no disponible, usando fallback en memoria');
          redis = null;
          return null;
        }
        return Math.min(times * 100, 3000);
      }
    });

    redis.on('error', (err) => {
      console.error('Redis error:', err);
      redis = null;
    });

    redis.on('connect', () => {
      console.log('✅ Redis conectado para rate limiting');
    });
  } catch (error) {
    console.warn('⚠️ No se pudo conectar a Redis, usando fallback en memoria');
    redis = null;
  }
}

// Fallback en memoria (para desarrollo sin Redis)
const memoryStore = new Map();

// Límites por plan
const RATE_LIMITS = {
  FREE: {
    requestsPerMinute: 10,
    requestsPerHour: 100,
    requestsPerDay: 500
  },
  PRO: {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    requestsPerDay: 10000
  },
  ENTERPRISE: {
    requestsPerMinute: 300,
    requestsPerHour: 10000,
    requestsPerDay: 100000
  }
};

/**
 * Obtiene los límites según el plan del tenant
 */
function getLimits(planId) {
  const planMap = {
    'plan_free': 'FREE',
    'plan_pro': 'PRO',
    'plan_enterprise': 'ENTERPRISE'
  };

  const planType = planMap[planId] || 'FREE';
  return RATE_LIMITS[planType];
}

/**
 * Rate limiter con Redis
 */
async function checkRateLimitRedis(key, limit, windowSeconds) {
  const now = Date.now();
  const windowStart = now - (windowSeconds * 1000);

  // Usar Redis sorted set para tracking de requests
  const multi = redis.multi();

  // Agregar request actual
  multi.zadd(key, now, `${now}-${Math.random()}`);

  // Eliminar requests antiguos fuera de la ventana
  multi.zremrangebyscore(key, 0, windowStart);

  // Contar requests en la ventana
  multi.zcard(key);

  // Expirar la key después de la ventana
  multi.expire(key, windowSeconds);

  const results = await multi.exec();
  const count = results[2][1]; // Resultado del ZCARD

  return {
    count,
    limit,
    remaining: Math.max(0, limit - count),
    resetTime: Math.ceil((now + windowSeconds * 1000) / 1000),
    allowed: count <= limit
  };
}

/**
 * Rate limiter con memoria (fallback)
 */
function checkRateLimitMemory(key, limit, windowSeconds) {
  const now = Date.now();
  const windowStart = now - (windowSeconds * 1000);

  if (!memoryStore.has(key)) {
    memoryStore.set(key, []);
  }

  const requests = memoryStore.get(key);

  // Filtrar requests dentro de la ventana
  const validRequests = requests.filter(timestamp => timestamp > windowStart);

  // Agregar request actual
  validRequests.push(now);

  // Actualizar store
  memoryStore.set(key, validRequests);

  // Limpiar memoria periódicamente (cada 1000 checks)
  if (Math.random() < 0.001) {
    cleanupMemoryStore();
  }

  return {
    count: validRequests.length,
    limit,
    remaining: Math.max(0, limit - validRequests.length),
    resetTime: Math.ceil((now + windowSeconds * 1000) / 1000),
    allowed: validRequests.length <= limit
  };
}

/**
 * Limpia requests antiguos del memory store
 */
function cleanupMemoryStore() {
  const now = Date.now();
  const maxWindow = 24 * 60 * 60 * 1000; // 24 horas

  for (const [key, requests] of memoryStore.entries()) {
    const validRequests = requests.filter(timestamp => timestamp > now - maxWindow);
    if (validRequests.length === 0) {
      memoryStore.delete(key);
    } else {
      memoryStore.set(key, validRequests);
    }
  }
}

/**
 * Middleware de rate limiting
 */
const rateLimiter = async (req, res, next) => {
  try {
    // Solo aplicar a requests autenticados con API Key
    if (!req.apiKey && !req.syncClient) {
      return next();
    }

    const apiKeyId = req.apiKey?.id || req.syncClient?.id;
    const tenantId = req.apiKey?.tenantId || req.syncClient?.tenantId;
    const planId = req.apiKey?.tenant?.planId || req.syncClient?.tenant?.planId || 'plan_free';

    const limits = getLimits(planId);

    // Verificar 3 ventanas: minuto, hora, día
    const checks = [
      { window: 60, limit: limits.requestsPerMinute, name: 'minute' },
      { window: 3600, limit: limits.requestsPerHour, name: 'hour' },
      { window: 86400, limit: limits.requestsPerDay, name: 'day' }
    ];

    let firstFailure = null;

    for (const check of checks) {
      const key = `ratelimit:${tenantId}:${apiKeyId}:${check.name}`;

      const result = redis
        ? await checkRateLimitRedis(key, check.limit, check.window)
        : checkRateLimitMemory(key, check.limit, check.window);

      // Agregar headers de rate limit
      if (check.name === 'minute') {
        res.setHeader('X-RateLimit-Limit', result.limit);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Reset', result.resetTime);
      }

      if (!result.allowed) {
        if (!firstFailure) {
          firstFailure = {
            window: check.name,
            limit: result.limit,
            resetTime: result.resetTime
          };
        }
      }
    }

    // Si excedió algún límite, rechazar
    if (firstFailure) {
      const retryAfter = firstFailure.resetTime - Math.floor(Date.now() / 1000);

      res.setHeader('Retry-After', retryAfter);

      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: `Límite de ${firstFailure.limit} requests por ${firstFailure.window} excedido`,
        retryAfter: retryAfter,
        resetAt: new Date(firstFailure.resetTime * 1000).toISOString()
      });
    }

    next();

  } catch (error) {
    console.error('Error en rate limiter:', error);
    // En caso de error, permitir el request (fail open)
    next();
  }
};

/**
 * Obtiene estadísticas de rate limit para un API Key
 */
async function getRateLimitStats(apiKeyId, tenantId, planId) {
  const limits = getLimits(planId);

  const windows = [
    { name: 'minute', window: 60, limit: limits.requestsPerMinute },
    { name: 'hour', window: 3600, limit: limits.requestsPerHour },
    { name: 'day', window: 86400, limit: limits.requestsPerDay }
  ];

  const stats = {};

  for (const w of windows) {
    const key = `ratelimit:${tenantId}:${apiKeyId}:${w.name}`;

    const result = redis
      ? await checkRateLimitRedis(key, w.limit, w.window)
      : checkRateLimitMemory(key, w.limit, w.window);

    stats[w.name] = {
      limit: result.limit,
      used: result.count,
      remaining: result.remaining,
      resetAt: new Date(result.resetTime * 1000).toISOString()
    };
  }

  return stats;
}

module.exports = {
  rateLimiter,
  getRateLimitStats,
  RATE_LIMITS
};
