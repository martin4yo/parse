#!/usr/bin/env node

/**
 * Servidor webhook para deployment automático desde GitHub
 * Escucha push events y actualiza automáticamente el código
 *
 * Setup:
 * 1. npm install express crypto child_process
 * 2. Configurar webhook en GitHub: http://tu-servidor:3001/webhook
 * 3. Ejecutar: node webhook-deploy.js
 * 4. O usar PM2: pm2 start webhook-deploy.js --name webhook
 */

const express = require('express');
const crypto = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');

const app = express();
const PORT = process.env.WEBHOOK_PORT || 3001;
const SECRET = process.env.WEBHOOK_SECRET || 'tu-secreto-webhook';
const PROJECT_DIR = process.env.PROJECT_DIR || '/var/www/Rendiciones';

// Middleware para parsear JSON
app.use(express.json());

// Función para verificar firma de GitHub
function verifySignature(payload, signature) {
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// Función para ejecutar comando y logging
function execCommand(command, description) {
  console.log(`🔄 ${description}...`);
  try {
    const output = execSync(command, {
      cwd: PROJECT_DIR,
      encoding: 'utf8',
      timeout: 300000 // 5 minutos timeout
    });
    console.log(`✅ ${description} completado`);
    return output;
  } catch (error) {
    console.error(`❌ Error en ${description}:`, error.message);
    throw error;
  }
}

// Endpoint del webhook
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const payload = JSON.stringify(req.body);

  // Verificar firma de seguridad
  if (!verifySignature(payload, signature)) {
    console.log('❌ Firma inválida');
    return res.status(401).send('Firma inválida');
  }

  const event = req.headers['x-github-event'];
  const body = req.body;

  // Solo procesar push events a master/main
  if (event !== 'push') {
    console.log(`ℹ️ Evento ignorado: ${event}`);
    return res.status(200).send('Evento ignorado');
  }

  const branch = body.ref.replace('refs/heads/', '');
  if (!['master', 'main'].includes(branch)) {
    console.log(`ℹ️ Branch ignorado: ${branch}`);
    return res.status(200).send('Branch ignorado');
  }

  console.log(`🚀 Iniciando deployment para ${branch}...`);
  console.log(`📝 Commits: ${body.commits.length}`);

  try {
    // 1. Pull cambios
    execCommand('git pull origin ' + branch, 'Descargando cambios');

    // 2. Backend - instalar dependencias
    execCommand('cd backend && npm install --production', 'Instalando dependencias backend');

    // 3. Migraciones
    try {
      execCommand('cd backend && npx prisma migrate deploy', 'Ejecutando migraciones');
      execCommand('cd backend && npx prisma generate', 'Generando cliente Prisma');
    } catch (error) {
      console.log('⚠️ Migraciones fallaron o no hay cambios');
    }

    // 4. Frontend (si existe)
    if (fs.existsSync(`${PROJECT_DIR}/packages/web/package.json`)) {
      execCommand('cd packages/web && npm install --production', 'Instalando dependencias frontend');
      execCommand('cd packages/web && npm run build', 'Compilando frontend');
    }

    // 5. Reiniciar servicios
    try {
      execCommand('pm2 restart app', 'Reiniciando con PM2');
    } catch (error) {
      try {
        execCommand('sudo systemctl restart rendiciones', 'Reiniciando con systemctl');
      } catch (error2) {
        console.log('⚠️ No se pudo reiniciar automáticamente');
      }
    }

    console.log('🎉 Deployment completado exitosamente');
    res.status(200).send('Deployment exitoso');

  } catch (error) {
    console.error('❌ Deployment falló:', error.message);
    res.status(500).send('Deployment falló: ' + error.message);
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    project: PROJECT_DIR
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🎣 Webhook server escuchando en puerto ${PORT}`);
  console.log(`📁 Directorio del proyecto: ${PROJECT_DIR}`);
  console.log(`🔗 URL del webhook: http://tu-servidor:${PORT}/webhook`);
  console.log('🔐 Configura este URL en GitHub Settings > Webhooks');
});

// Manejo de errores
process.on('uncaughtException', (error) => {
  console.error('💥 Error no capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Promise rechazada:', reason);
});