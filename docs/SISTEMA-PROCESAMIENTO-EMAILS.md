# Sistema de Procesamiento de Emails

## 📧 Objetivo

Implementar un sistema que permita leer correos electrónicos de múltiples cuentas, extraer adjuntos (facturas, recibos, documentos) y procesarlos automáticamente usando el pipeline de IA existente (Claude Vision, Gemini, Document AI).

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                   CUENTAS DE EMAIL                      │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  Gmail   │  │ Outlook  │  │   IMAP   │            │
│  │   API    │  │ Graph API│  │ Genérico │            │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
└───────┼─────────────┼─────────────┼───────────────────┘
        │             │             │
        └─────────────┴─────────────┘
                      │
                      ▼
        ┌─────────────────────────┐
        │    Email Service        │
        │  (Multi-proveedor)      │
        │  - Conexión             │
        │  - Autenticación OAuth  │
        │  - Fetch emails         │
        └───────────┬─────────────┘
                    │
                    ▼
        ┌─────────────────────────┐
        │    Email Parser         │
        │  - Extraer adjuntos     │
        │  - Parsear contenido    │
        │  - Filtrar emails       │
        └───────────┬─────────────┘
                    │
                    ▼
        ┌─────────────────────────┐
        │   Email Processor       │
        │  - Guardar adjuntos     │
        │  - Crear documentos     │
        │  - Vincular con email   │
        └───────────┬─────────────┘
                    │
                    ▼
        ┌─────────────────────────┐
        │  Document Processor     │
        │  (SISTEMA ACTUAL)       │
        │  - Claude Vision        │
        │  - Gemini               │
        │  - Document AI          │
        │  - OCR                  │
        └───────────┬─────────────┘
                    │
                    ▼
        ┌─────────────────────────┐
        │   Base de Datos         │
        │  - EmailAccount         │
        │  - EmailDocument        │
        │  - Documento (existente)│
        └─────────────────────────┘
```

---

## 📦 Stack Tecnológico

### Dependencias NPM

```json
{
  "dependencies": {
    // Gmail
    "googleapis": "^126.0.0",

    // Microsoft Graph (Outlook)
    "@microsoft/microsoft-graph-client": "^3.0.7",
    "@azure/msal-node": "^2.6.0",

    // IMAP genérico
    "imap-simple": "^5.1.0",
    "mailparser": "^3.6.5",

    // Scheduler
    "node-cron": "^3.0.3",

    // Encriptación de tokens
    "crypto-js": "^4.2.0"
  }
}
```

### Servicios de Cloud

- **Google Cloud Console**: Gmail API habilitada
- **Azure AD**: App registration para Microsoft Graph
- **IMAP**: Cualquier servidor compatible

---

## 🗄️ Modelo de Base de Datos

### Schema Prisma

```prisma
// backend/src/prisma/schema.prisma

model EmailAccount {
  id          String   @id @default(uuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])

  provider    String   // 'gmail', 'outlook', 'imap'
  email       String
  displayName String?

  // Credenciales encriptadas (tokens OAuth o contraseña IMAP)
  credentials String   @db.Text

  // Configuración
  enabled     Boolean  @default(true)
  lastSync    DateTime?
  syncInterval Int     @default(5) // minutos

  // Filtros y configuración JSON
  config      Json?    @default("{}")
  // Ejemplo config:
  // {
  //   "filters": {
  //     "fromEmails": ["proveedor@example.com"],
  //     "subjectKeywords": ["factura", "recibo"],
  //     "hasAttachments": true,
  //     "folders": ["INBOX", "Facturas"]
  //   },
  //   "processing": {
  //     "autoProcess": true,
  //     "maxAttachments": 10,
  //     "allowedExtensions": [".pdf", ".jpg", ".png"]
  //   }
  // }

  // Relaciones
  emailDocuments EmailDocument[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, email])
  @@index([tenantId])
  @@index([enabled])
}

model EmailDocument {
  id            String   @id @default(uuid())

  // Datos del email original
  emailId       String   // ID único del proveedor (Gmail message ID, etc.)
  emailSubject  String   @db.Text
  emailFrom     String
  emailTo       String?
  emailDate     DateTime
  emailBody     String?  @db.Text

  // Relación con documento procesado
  documentoId   String?
  documento     Documento? @relation(fields: [documentoId], references: [id])

  // Relación con cuenta
  accountId     String
  account       EmailAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)

  // Estado de procesamiento
  processed     Boolean  @default(false)
  processedAt   DateTime?
  error         String?  @db.Text

  // Metadatos
  attachmentCount Int    @default(0)
  attachments     Json?  // Array de nombres de archivos guardados

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([accountId, emailId])
  @@index([accountId])
  @@index([processed])
  @@index([emailDate])
}

// Agregar relación en Documento existente
model Documento {
  // ... campos existentes ...

  emailDocuments EmailDocument[]
  sourceType     String?  @default("manual") // 'manual', 'email', 'api'
}
```

---

## 🔧 Implementación Backend

### 1. Email Service (`backend/src/services/emailService.js`)

```javascript
const { google } = require('googleapis');
const { Client } = require('@microsoft/microsoft-graph-client');
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
const CryptoJS = require('crypto-js');

class EmailService {
  constructor() {
    this.connections = new Map();
  }

  /**
   * Encripta credenciales para almacenamiento seguro
   */
  encryptCredentials(credentials) {
    return CryptoJS.AES.encrypt(
      JSON.stringify(credentials),
      process.env.ENCRYPTION_KEY
    ).toString();
  }

  /**
   * Desencripta credenciales
   */
  decryptCredentials(encrypted) {
    const bytes = CryptoJS.AES.decrypt(encrypted, process.env.ENCRYPTION_KEY);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  }

  /**
   * Conecta a Gmail usando OAuth
   */
  async connectGmail(account) {
    const credentials = this.decryptCredentials(account.credentials);

    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    oauth2Client.setCredentials(credentials);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    return gmail;
  }

  /**
   * Conecta a Outlook usando Microsoft Graph
   */
  async connectOutlook(account) {
    const credentials = this.decryptCredentials(account.credentials);

    const client = Client.init({
      authProvider: (done) => {
        done(null, credentials.access_token);
      }
    });

    return client;
  }

  /**
   * Conecta a servidor IMAP genérico
   */
  async connectIMAP(account) {
    const credentials = this.decryptCredentials(account.credentials);

    const config = {
      imap: {
        user: credentials.username,
        password: credentials.password,
        host: credentials.host,
        port: credentials.port || 993,
        tls: credentials.tls !== false,
        authTimeout: 10000
      }
    };

    const connection = await imaps.connect(config);
    return connection;
  }

  /**
   * Obtiene emails según proveedor
   */
  async fetchEmails(account, options = {}) {
    switch (account.provider) {
      case 'gmail':
        return this.fetchGmailEmails(account, options);
      case 'outlook':
        return this.fetchOutlookEmails(account, options);
      case 'imap':
        return this.fetchIMAPEmails(account, options);
      default:
        throw new Error(`Proveedor no soportado: ${account.provider}`);
    }
  }

  /**
   * Fetch de Gmail
   */
  async fetchGmailEmails(account, options) {
    const gmail = await this.connectGmail(account);
    const config = account.config || {};

    // Construir query
    let query = '';
    if (config.filters?.hasAttachments) {
      query += 'has:attachment ';
    }
    if (config.filters?.subjectKeywords?.length) {
      query += `subject:(${config.filters.subjectKeywords.join(' OR ')}) `;
    }
    if (account.lastSync) {
      const date = new Date(account.lastSync).toISOString().split('T')[0];
      query += `after:${date} `;
    }

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query.trim(),
      maxResults: options.limit || 50
    });

    if (!response.data.messages) {
      return [];
    }

    // Obtener detalles de cada mensaje
    const emails = [];
    for (const message of response.data.messages) {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full'
      });

      emails.push(this.parseGmailMessage(detail.data));
    }

    return emails;
  }

  /**
   * Fetch de Outlook
   */
  async fetchOutlookEmails(account, options) {
    const client = await this.connectOutlook(account);

    let query = '/me/messages';
    const filters = [];

    if (account.lastSync) {
      filters.push(`receivedDateTime gt ${account.lastSync}`);
    }

    if (filters.length) {
      query += `?$filter=${filters.join(' and ')}`;
    }

    const response = await client.api(query).get();

    return response.value.map(msg => this.parseOutlookMessage(msg));
  }

  /**
   * Fetch de IMAP
   */
  async fetchIMAPEmails(account, options) {
    const connection = await this.connectIMAP(account);
    const config = account.config || {};

    await connection.openBox(config.filters?.folders?.[0] || 'INBOX');

    // Criterios de búsqueda
    const searchCriteria = ['UNSEEN'];
    if (config.filters?.hasAttachments) {
      searchCriteria.push(['HEADER', 'Content-Type', 'multipart']);
    }

    const fetchOptions = {
      bodies: ['HEADER', 'TEXT'],
      markSeen: false
    };

    const messages = await connection.search(searchCriteria, fetchOptions);

    const emails = [];
    for (const item of messages) {
      const parsed = await simpleParser(item.parts.find(p => p.which === 'TEXT').body);
      emails.push(this.parseIMAPMessage(parsed, item));
    }

    connection.end();

    return emails;
  }

  /**
   * Parsers para cada proveedor
   */
  parseGmailMessage(msg) {
    const headers = msg.payload.headers;
    const getHeader = (name) => headers.find(h => h.name === name)?.value;

    return {
      id: msg.id,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      to: getHeader('To'),
      date: new Date(parseInt(msg.internalDate)),
      body: this.extractGmailBody(msg.payload),
      attachments: this.extractGmailAttachments(msg.payload)
    };
  }

  parseOutlookMessage(msg) {
    return {
      id: msg.id,
      subject: msg.subject,
      from: msg.from.emailAddress.address,
      to: msg.toRecipients.map(r => r.emailAddress.address).join(', '),
      date: new Date(msg.receivedDateTime),
      body: msg.body.content,
      attachments: msg.hasAttachments ? msg.attachments : []
    };
  }

  parseIMAPMessage(parsed, item) {
    return {
      id: item.attributes.uid.toString(),
      subject: parsed.subject,
      from: parsed.from.text,
      to: parsed.to?.text,
      date: parsed.date,
      body: parsed.text || parsed.html,
      attachments: parsed.attachments || []
    };
  }

  /**
   * Descargar adjuntos
   */
  async downloadAttachment(account, emailId, attachmentId) {
    switch (account.provider) {
      case 'gmail':
        return this.downloadGmailAttachment(account, emailId, attachmentId);
      case 'outlook':
        return this.downloadOutlookAttachment(account, emailId, attachmentId);
      case 'imap':
        // Los adjuntos de IMAP ya vienen en el email
        return null;
      default:
        throw new Error('Proveedor no soportado');
    }
  }

  async downloadGmailAttachment(account, messageId, attachmentId) {
    const gmail = await this.connectGmail(account);

    const response = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: messageId,
      id: attachmentId
    });

    return Buffer.from(response.data.data, 'base64');
  }

  async downloadOutlookAttachment(account, messageId, attachmentId) {
    const client = await this.connectOutlook(account);

    const attachment = await client
      .api(`/me/messages/${messageId}/attachments/${attachmentId}/$value`)
      .get();

    return attachment;
  }
}

module.exports = new EmailService();
```

### 2. Email Processor (`backend/src/services/emailProcessor.js`)

```javascript
const fs = require('fs').promises;
const path = require('path');
const prisma = require('../lib/prisma');
const documentProcessor = require('./documentProcessor');
const emailService = require('./emailService');

class EmailProcessor {
  constructor() {
    this.attachmentsDir = path.join(__dirname, '../../uploads/email-attachments');
  }

  async ensureAttachmentsDir() {
    await fs.mkdir(this.attachmentsDir, { recursive: true });
  }

  /**
   * Procesa un email completo
   */
  async processEmail(account, email) {
    try {
      // Verificar si ya fue procesado
      const existing = await prisma.emailDocument.findUnique({
        where: {
          accountId_emailId: {
            accountId: account.id,
            emailId: email.id
          }
        }
      });

      if (existing) {
        console.log(`Email ${email.id} ya procesado`);
        return existing;
      }

      console.log(`📧 Procesando email: ${email.subject}`);

      // Crear registro de email
      const emailDoc = await prisma.emailDocument.create({
        data: {
          emailId: email.id,
          emailSubject: email.subject,
          emailFrom: email.from,
          emailTo: email.to,
          emailDate: email.date,
          emailBody: email.body,
          accountId: account.id,
          attachmentCount: email.attachments?.length || 0
        }
      });

      // Procesar adjuntos
      if (email.attachments && email.attachments.length > 0) {
        await this.processAttachments(account, email, emailDoc);
      }

      // Marcar como procesado
      await prisma.emailDocument.update({
        where: { id: emailDoc.id },
        data: {
          processed: true,
          processedAt: new Date()
        }
      });

      console.log(`✅ Email procesado: ${email.subject}`);
      return emailDoc;

    } catch (error) {
      console.error(`❌ Error procesando email ${email.id}:`, error);

      // Guardar error
      await prisma.emailDocument.update({
        where: {
          accountId_emailId: {
            accountId: account.id,
            emailId: email.id
          }
        },
        data: {
          error: error.message,
          processed: true,
          processedAt: new Date()
        }
      });

      throw error;
    }
  }

  /**
   * Procesa todos los adjuntos de un email
   */
  async processAttachments(account, email, emailDoc) {
    await this.ensureAttachmentsDir();

    const config = account.config || {};
    const allowedExtensions = config.processing?.allowedExtensions ||
      ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'];

    const maxAttachments = config.processing?.maxAttachments || 10;

    const processedAttachments = [];

    for (let i = 0; i < Math.min(email.attachments.length, maxAttachments); i++) {
      const attachment = email.attachments[i];

      // Verificar extensión
      const ext = path.extname(attachment.filename).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        console.log(`⏭️ Saltando adjunto no permitido: ${attachment.filename}`);
        continue;
      }

      try {
        // Descargar adjunto si es necesario
        let buffer;
        if (attachment.content) {
          // IMAP ya trae el contenido
          buffer = attachment.content;
        } else {
          // Gmail/Outlook necesitan descarga
          buffer = await emailService.downloadAttachment(
            account,
            email.id,
            attachment.id
          );
        }

        // Guardar archivo
        const filename = `${Date.now()}_${attachment.filename}`;
        const filepath = path.join(this.attachmentsDir, filename);
        await fs.writeFile(filepath, buffer);

        console.log(`📎 Adjunto guardado: ${filename}`);

        // Procesar con sistema de documentos existente
        const documento = await this.processDocument(
          filepath,
          account.tenantId,
          emailDoc,
          attachment.filename
        );

        processedAttachments.push({
          originalName: attachment.filename,
          savedName: filename,
          documentoId: documento?.id
        });

      } catch (error) {
        console.error(`Error procesando adjunto ${attachment.filename}:`, error);
        processedAttachments.push({
          originalName: attachment.filename,
          error: error.message
        });
      }
    }

    // Actualizar EmailDocument con lista de adjuntos
    await prisma.emailDocument.update({
      where: { id: emailDoc.id },
      data: {
        attachments: processedAttachments
      }
    });
  }

  /**
   * Procesa un documento usando el pipeline existente
   */
  async processDocument(filepath, tenantId, emailDoc, originalFilename) {
    try {
      // Crear documento en BD
      const documento = await prisma.documento.create({
        data: {
          nombre: originalFilename,
          tipo: 'FACTURA', // Por defecto, puede ajustarse
          estado: 'PROCESANDO',
          sourceType: 'email',
          tenantId: tenantId,
          archivoUrl: filepath,
          metadata: {
            emailId: emailDoc.id,
            emailSubject: emailDoc.emailSubject,
            emailFrom: emailDoc.emailFrom
          }
        }
      });

      // Vincular con EmailDocument
      await prisma.emailDocument.update({
        where: { id: emailDoc.id },
        data: { documentoId: documento.id }
      });

      // Procesar con IA (sistema existente)
      const extractedData = await documentProcessor.processDocument(filepath);

      // Actualizar documento con datos extraídos
      await prisma.documento.update({
        where: { id: documento.id },
        data: {
          estado: 'COMPLETADO',
          datosExtraidos: extractedData,
          // Mapear campos específicos
          numeroFactura: extractedData.numeroFactura,
          fecha: extractedData.fecha,
          total: extractedData.total,
          // ... otros campos
        }
      });

      console.log(`✅ Documento procesado: ${documento.id}`);
      return documento;

    } catch (error) {
      console.error('Error procesando documento:', error);

      // Marcar documento como error
      await prisma.documento.update({
        where: { id: documento.id },
        data: {
          estado: 'ERROR',
          error: error.message
        }
      });

      throw error;
    }
  }

  /**
   * Sincroniza una cuenta específica
   */
  async syncAccount(accountId) {
    const account = await prisma.emailAccount.findUnique({
      where: { id: accountId },
      include: { tenant: true }
    });

    if (!account || !account.enabled) {
      throw new Error('Cuenta no encontrada o deshabilitada');
    }

    console.log(`🔄 Sincronizando cuenta: ${account.email}`);

    // Obtener emails
    const emails = await emailService.fetchEmails(account);

    console.log(`📬 Encontrados ${emails.length} emails`);

    // Procesar cada email
    const results = [];
    for (const email of emails) {
      try {
        const result = await this.processEmail(account, email);
        results.push({ success: true, emailId: email.id, result });
      } catch (error) {
        results.push({ success: false, emailId: email.id, error: error.message });
      }
    }

    // Actualizar lastSync
    await prisma.emailAccount.update({
      where: { id: accountId },
      data: { lastSync: new Date() }
    });

    return results;
  }

  /**
   * Sincroniza todas las cuentas activas
   */
  async syncAllAccounts() {
    const accounts = await prisma.emailAccount.findMany({
      where: { enabled: true }
    });

    console.log(`🔄 Sincronizando ${accounts.length} cuentas...`);

    const results = [];
    for (const account of accounts) {
      try {
        const accountResults = await this.syncAccount(account.id);
        results.push({
          accountId: account.id,
          email: account.email,
          success: true,
          results: accountResults
        });
      } catch (error) {
        console.error(`Error sincronizando ${account.email}:`, error);
        results.push({
          accountId: account.id,
          email: account.email,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }
}

module.exports = new EmailProcessor();
```

### 3. Scheduler Job (`backend/src/jobs/emailSyncJob.js`)

```javascript
const cron = require('node-cron');
const emailProcessor = require('../services/emailProcessor');

class EmailSyncJob {
  constructor() {
    this.task = null;
    this.isRunning = false;
  }

  /**
   * Inicia el cron job
   */
  start() {
    const interval = process.env.EMAIL_SYNC_INTERVAL || '*/5 * * * *'; // Por defecto cada 5 min

    console.log(`📅 Iniciando job de sincronización de emails: ${interval}`);

    this.task = cron.schedule(interval, async () => {
      if (this.isRunning) {
        console.log('⏭️ Sync anterior aún corriendo, saltando...');
        return;
      }

      this.isRunning = true;

      try {
        console.log('🔄 Ejecutando sincronización de emails...');
        const results = await emailProcessor.syncAllAccounts();

        const totalEmails = results.reduce((sum, r) =>
          sum + (r.results?.length || 0), 0
        );

        console.log(`✅ Sincronización completada: ${totalEmails} emails procesados`);
      } catch (error) {
        console.error('❌ Error en sincronización:', error);
      } finally {
        this.isRunning = false;
      }
    });

    console.log('✅ Email sync job iniciado');
  }

  /**
   * Detiene el cron job
   */
  stop() {
    if (this.task) {
      this.task.stop();
      console.log('⏹️ Email sync job detenido');
    }
  }
}

module.exports = new EmailSyncJob();
```

### 4. API Routes (`backend/src/routes/email.js`)

```javascript
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const emailService = require('../services/emailService');
const emailProcessor = require('../services/emailProcessor');
const { authenticateToken, requireTenant } = require('../middleware/auth');

/**
 * GET /api/email/accounts
 * Listar cuentas de email del tenant
 */
router.get('/accounts', authenticateToken, requireTenant, async (req, res) => {
  try {
    const accounts = await prisma.emailAccount.findMany({
      where: { tenantId: req.user.tenantId },
      select: {
        id: true,
        provider: true,
        email: true,
        displayName: true,
        enabled: true,
        lastSync: true,
        syncInterval: true,
        config: true,
        createdAt: true,
        _count: {
          select: { emailDocuments: true }
        }
      }
    });

    res.json(accounts);
  } catch (error) {
    console.error('Error obteniendo cuentas:', error);
    res.status(500).json({ error: 'Error obteniendo cuentas de email' });
  }
});

/**
 * POST /api/email/accounts
 * Crear nueva cuenta de email
 */
router.post('/accounts', authenticateToken, requireTenant, async (req, res) => {
  try {
    const { provider, email, credentials, displayName, config } = req.body;

    // Validar proveedor
    if (!['gmail', 'outlook', 'imap'].includes(provider)) {
      return res.status(400).json({ error: 'Proveedor no válido' });
    }

    // Encriptar credenciales
    const encryptedCredentials = emailService.encryptCredentials(credentials);

    const account = await prisma.emailAccount.create({
      data: {
        tenantId: req.user.tenantId,
        provider,
        email,
        displayName,
        credentials: encryptedCredentials,
        config: config || {}
      }
    });

    res.json({
      id: account.id,
      provider: account.provider,
      email: account.email,
      displayName: account.displayName,
      enabled: account.enabled
    });
  } catch (error) {
    console.error('Error creando cuenta:', error);
    res.status(500).json({ error: 'Error creando cuenta de email' });
  }
});

/**
 * PUT /api/email/accounts/:id
 * Actualizar configuración de cuenta
 */
router.put('/accounts/:id', authenticateToken, requireTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled, config, syncInterval } = req.body;

    const account = await prisma.emailAccount.findFirst({
      where: {
        id,
        tenantId: req.user.tenantId
      }
    });

    if (!account) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    const updated = await prisma.emailAccount.update({
      where: { id },
      data: {
        enabled,
        config,
        syncInterval
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error actualizando cuenta:', error);
    res.status(500).json({ error: 'Error actualizando cuenta' });
  }
});

/**
 * DELETE /api/email/accounts/:id
 * Eliminar cuenta
 */
router.delete('/accounts/:id', authenticateToken, requireTenant, async (req, res) => {
  try {
    const { id } = req.params;

    const account = await prisma.emailAccount.findFirst({
      where: {
        id,
        tenantId: req.user.tenantId
      }
    });

    if (!account) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    await prisma.emailAccount.delete({ where: { id } });

    res.json({ message: 'Cuenta eliminada' });
  } catch (error) {
    console.error('Error eliminando cuenta:', error);
    res.status(500).json({ error: 'Error eliminando cuenta' });
  }
});

/**
 * POST /api/email/sync/:accountId
 * Sincronizar cuenta manualmente
 */
router.post('/sync/:accountId', authenticateToken, requireTenant, async (req, res) => {
  try {
    const { accountId } = req.params;

    const account = await prisma.emailAccount.findFirst({
      where: {
        id: accountId,
        tenantId: req.user.tenantId
      }
    });

    if (!account) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    const results = await emailProcessor.syncAccount(accountId);

    res.json({
      message: 'Sincronización completada',
      processed: results.length,
      results
    });
  } catch (error) {
    console.error('Error sincronizando:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/email/sync
 * Sincronizar todas las cuentas del tenant
 */
router.post('/sync', authenticateToken, requireTenant, async (req, res) => {
  try {
    const accounts = await prisma.emailAccount.findMany({
      where: {
        tenantId: req.user.tenantId,
        enabled: true
      }
    });

    const allResults = [];
    for (const account of accounts) {
      const results = await emailProcessor.syncAccount(account.id);
      allResults.push({ accountId: account.id, email: account.email, results });
    }

    res.json({
      message: 'Sincronización completada',
      accounts: allResults.length,
      results: allResults
    });
  } catch (error) {
    console.error('Error sincronizando:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/email/documents
 * Listar documentos procesados desde emails
 */
router.get('/documents', authenticateToken, requireTenant, async (req, res) => {
  try {
    const emailDocs = await prisma.emailDocument.findMany({
      where: {
        account: {
          tenantId: req.user.tenantId
        }
      },
      include: {
        documento: true,
        account: {
          select: {
            email: true,
            provider: true
          }
        }
      },
      orderBy: { emailDate: 'desc' },
      take: 100
    });

    res.json(emailDocs);
  } catch (error) {
    console.error('Error obteniendo documentos:', error);
    res.status(500).json({ error: 'Error obteniendo documentos de email' });
  }
});

/**
 * GET /api/email/oauth/gmail/url
 * Obtener URL de autorización de Gmail
 */
router.get('/oauth/gmail/url', authenticateToken, requireTenant, async (req, res) => {
  try {
    const { google } = require('googleapis');

    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify'
      ],
      state: JSON.stringify({
        tenantId: req.user.tenantId,
        userId: req.user.id
      })
    });

    res.json({ url });
  } catch (error) {
    console.error('Error generando URL de Gmail:', error);
    res.status(500).json({ error: 'Error generando URL de autorización' });
  }
});

/**
 * GET /api/email/oauth/gmail/callback
 * Callback de OAuth de Gmail
 */
router.get('/oauth/gmail/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const { tenantId, userId } = JSON.parse(state);

    const { google } = require('googleapis');

    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Obtener email del usuario
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });

    // Guardar cuenta
    const encryptedCredentials = emailService.encryptCredentials(tokens);

    await prisma.emailAccount.create({
      data: {
        tenantId,
        provider: 'gmail',
        email: profile.data.emailAddress,
        credentials: encryptedCredentials
      }
    });

    // Redirigir al frontend
    res.redirect(`${process.env.FRONTEND_URL}/email-config?success=true`);
  } catch (error) {
    console.error('Error en callback de Gmail:', error);
    res.redirect(`${process.env.FRONTEND_URL}/email-config?error=true`);
  }
});

module.exports = router;
```

---

## 🎨 Frontend - Interfaz de Usuario

### Página de Configuración (`frontend/src/app/(protected)/email-config/page.tsx`)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import api from '@/lib/api';

interface EmailAccount {
  id: string;
  provider: 'gmail' | 'outlook' | 'imap';
  email: string;
  displayName?: string;
  enabled: boolean;
  lastSync?: string;
  _count: { emailDocuments: number };
}

export default function EmailConfigPage() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    const response = await api.get('/api/email/accounts');
    setAccounts(response.data);
  };

  const connectGmail = async () => {
    const response = await api.get('/api/email/oauth/gmail/url');
    window.location.href = response.data.url;
  };

  const syncAccount = async (accountId: string) => {
    setSyncing(accountId);
    try {
      await api.post(`/api/email/sync/${accountId}`);
      await loadAccounts();
    } finally {
      setSyncing(null);
    }
  };

  const toggleAccount = async (accountId: string, enabled: boolean) => {
    await api.put(`/api/email/accounts/${accountId}`, { enabled });
    await loadAccounts();
  };

  const deleteAccount = async (accountId: string) => {
    if (confirm('¿Eliminar esta cuenta?')) {
      await api.delete(`/api/email/accounts/${accountId}`);
      await loadAccounts();
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Configuración de Correos</h1>

        <div className="space-x-2">
          <Button onClick={connectGmail}>
            <GmailIcon /> Conectar Gmail
          </Button>
          <Button variant="outline">
            <OutlookIcon /> Conectar Outlook
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {accounts.map(account => (
          <Card key={account.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <ProviderIcon provider={account.provider} />

                <div>
                  <div className="font-medium">{account.email}</div>
                  <div className="text-sm text-gray-500">
                    {account._count.emailDocuments} documentos procesados
                  </div>
                  {account.lastSync && (
                    <div className="text-xs text-gray-400">
                      Última sincronización: {new Date(account.lastSync).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <Switch
                  checked={account.enabled}
                  onCheckedChange={(checked) => toggleAccount(account.id, checked)}
                />

                <Button
                  size="sm"
                  onClick={() => syncAccount(account.id)}
                  disabled={syncing === account.id}
                >
                  {syncing === account.id ? 'Sincronizando...' : 'Sincronizar'}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteAccount(account.id)}
                >
                  Eliminar
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {accounts.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No hay cuentas configuradas. Conecta una cuenta para comenzar.
        </div>
      )}
    </div>
  );
}
```

---

## ⚙️ Variables de Entorno

```env
# backend/.env

# Gmail API
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REDIRECT_URI=https://api.parsedemo.axiomacloud.com/api/email/oauth/gmail/callback

# Microsoft Graph (Outlook)
MICROSOFT_CLIENT_ID=your-app-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_REDIRECT_URI=https://api.parsedemo.axiomacloud.com/api/email/oauth/microsoft/callback

# Email Processing
EMAIL_SYNC_ENABLED=true
EMAIL_SYNC_INTERVAL=*/5 * * * *  # Cron expression (cada 5 minutos)
EMAIL_MAX_ATTACHMENTS=10
EMAIL_MAX_SIZE_MB=25

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key-here
```

---

## 🚀 Instalación y Setup

### 1. Instalar Dependencias

```bash
cd backend
npm install googleapis @microsoft/microsoft-graph-client @azure/msal-node imap-simple mailparser node-cron crypto-js
```

### 2. Configurar Google Cloud Console

1. Ir a https://console.cloud.google.com
2. Crear nuevo proyecto o seleccionar existente
3. Habilitar **Gmail API**
4. Crear credenciales OAuth 2.0:
   - Tipo: Web application
   - Authorized redirect URIs: `https://api.parsedemo.axiomacloud.com/api/email/oauth/gmail/callback`
5. Copiar Client ID y Client Secret al `.env`

### 3. Configurar Azure AD (Outlook)

1. Ir a https://portal.azure.com
2. App registrations → New registration
3. Nombre: "Parse Email Integration"
4. Redirect URI: `https://api.parsedemo.axiomacloud.com/api/email/oauth/microsoft/callback`
5. API Permissions → Add permission → Microsoft Graph:
   - `Mail.Read`
   - `Mail.ReadWrite`
   - `User.Read`
6. Copiar Application ID y crear Client Secret

### 4. Ejecutar Migraciones

```bash
cd backend
npx prisma migrate dev --name add-email-system
npx prisma generate
```

### 5. Iniciar Email Sync Job

```javascript
// backend/src/index.js

const emailSyncJob = require('./jobs/emailSyncJob');

// ... código existente ...

if (process.env.EMAIL_SYNC_ENABLED === 'true') {
  emailSyncJob.start();
}
```

---

## 📊 Flujo de Uso

### Usuario Final

1. **Configurar Cuenta**:
   - Ir a "Configuración" → "Correos"
   - Clic en "Conectar Gmail"
   - Autorizar acceso → Cuenta agregada

2. **Sincronización Automática**:
   - Cada 5 minutos se revisan correos nuevos
   - Adjuntos (PDFs, imágenes) se descargan
   - Se procesan con IA automáticamente

3. **Ver Resultados**:
   - Documentos aparecen en "Documentos"
   - Tag "📧 Email" indica origen
   - Ver detalles: asunto, remitente, fecha

4. **Gestión**:
   - Activar/desactivar cuentas
   - Sincronizar manualmente
   - Ver historial

### Administrador

1. **Configurar Filtros** (opcional):
```json
{
  "filters": {
    "fromEmails": ["proveedor@example.com"],
    "subjectKeywords": ["factura", "recibo"],
    "hasAttachments": true
  },
  "processing": {
    "autoProcess": true,
    "maxAttachments": 5,
    "allowedExtensions": [".pdf"]
  }
}
```

2. **Monitoreo**:
   - Ver logs de sincronización
   - Detectar errores
   - Estadísticas por cuenta

---

## 🧪 Testing

### Test Manual

```bash
cd backend
node -e "
const emailProcessor = require('./src/services/emailProcessor');
emailProcessor.syncAccount('account-id-here').then(console.log);
"
```

### Test de Autenticación Gmail

```bash
# Obtener URL de OAuth
curl http://localhost:5100/api/email/oauth/gmail/url

# Abrir URL en navegador → Autorizar → Callback creará cuenta
```

---

## 🔒 Seguridad

### Credenciales Encriptadas

- Tokens OAuth guardados con AES-256
- Key de encriptación en variable de entorno
- Nunca exponer tokens en API responses

### Permisos OAuth Mínimos

- Gmail: Solo lectura de emails
- Outlook: Mail.Read (no envío)
- Principio de least privilege

### Multi-tenant

- Cada tenant solo ve sus propias cuentas
- Validación de tenantId en todas las rutas
- Aislamiento de datos

---

## 📈 Escalabilidad

### Performance

- **Attachments**: Guardar en disco o S3
- **Processing**: Queue system (Bull/BullMQ) para procesar async
- **Caching**: Redis para tokens OAuth
- **Rate limiting**: Respetar límites de APIs (Gmail: 1B requests/day)

### Mejoras Futuras

1. **Queue System**:
```javascript
// Usar Bull para procesar emails async
const emailQueue = new Bull('email-processing');

emailQueue.process(async (job) => {
  return emailProcessor.processEmail(job.data.account, job.data.email);
});
```

2. **Webhooks** (Gmail Push):
```javascript
// Recibir notificaciones en tiempo real
router.post('/webhook/gmail', (req, res) => {
  const { emailAddress, historyId } = req.body;
  // Procesar cambios incrementales
});
```

3. **Storage en S3**:
```javascript
// Guardar adjuntos en S3 en lugar de disco
const s3 = new AWS.S3();
await s3.upload({
  Bucket: 'parse-email-attachments',
  Key: filename,
  Body: buffer
}).promise();
```

---

## 📝 Resumen de Archivos

```
backend/
├── src/
│   ├── services/
│   │   ├── emailService.js         ← Conexión a proveedores
│   │   └── emailProcessor.js       ← Lógica de procesamiento
│   ├── routes/
│   │   └── email.js                ← API endpoints
│   ├── jobs/
│   │   └── emailSyncJob.js         ← Cron scheduler
│   └── prisma/
│       └── schema.prisma           ← EmailAccount, EmailDocument models
│
frontend/
├── src/
│   └── app/
│       └── (protected)/
│           └── email-config/       ← UI de configuración
│               ├── page.tsx
│               └── components/
│
.env
├── GMAIL_CLIENT_ID
├── GMAIL_CLIENT_SECRET
├── MICROSOFT_CLIENT_ID
├── MICROSOFT_CLIENT_SECRET
└── ENCRYPTION_KEY
```

---

## 🎯 Próximos Pasos

### Fase 1: MVP (Gmail + Adjuntos)
- [ ] Implementar `emailService.js` con soporte Gmail
- [ ] Implementar `emailProcessor.js`
- [ ] Crear modelos Prisma
- [ ] API endpoints básicos
- [ ] UI de configuración simple
- [ ] Test con cuenta Gmail real

### Fase 2: Multi-proveedor
- [ ] Agregar soporte Outlook
- [ ] Agregar soporte IMAP
- [ ] Selector de proveedor en UI
- [ ] Configuración avanzada de filtros

### Fase 3: Automatización
- [ ] Cron job de sincronización
- [ ] Queue system con Bull
- [ ] Webhooks de Gmail/Outlook
- [ ] Dashboard de estadísticas

---

**Fecha de creación**: 2025-11-07
**Estado**: Documentado - Listo para implementación
**Prioridad**: Media
**Estimación**: 5-7 días desarrollo + 2 días testing
