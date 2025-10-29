const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');


// Configuración del transportador de email
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Crear token JWT para acceso directo
const createAuthToken = (userId, expiresIn = '7d') => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

// Enviar notificación de rendición finalizada
const sendRendicionFinalizadaNotification = async (rendicionData, autorizanteUserId, tenantId) => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('Configuración SMTP no encontrada, email no enviado');
      return { success: false, message: 'Configuración SMTP no encontrada' };
    }

    const transporter = createTransporter();

    // Buscar autorizantes activos que tengan activadas las notificaciones por email
    const prisma = require('../lib/prisma');
    const autorizantes = await prisma.users.findMany({
      where: {
        tenantId,
        activo: true,
        emailVerified: true,
        recibeNotificacionesEmail: true,
        usuario_autorizantes_usuario_autorizantes_autorizanteIdTousers: {
          some: {
            activo: true
          }
        }
      },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true
      }
    });

    if (autorizantes.length === 0) {
      console.log('No se encontraron autorizantes con notificaciones activadas');
      return { success: false, message: 'No hay autorizantes para notificar' };
    }

    const recipients = autorizantes.map(a => a.email);

    // Crear token de acceso directo (usando un userId dummy por ahora, luego se puede obtener del autorizante real)
    const accessToken = createAuthToken(autorizanteUserId || 'cmf5xlbtk00015x8d7i1j718f'); // Usar tu userId como fallback
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const authorizationUrl = `${frontendUrl}/autorizaciones?token=${accessToken}`;


    const mailOptions = {
      from: process.env.SMTP_USER,
      to: recipients,
      subject: `Rendición finalizada pendiente de autorización - ${rendicionData.usuario}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">

          <h2 style="color: #2563eb;">Rendición Finalizada - Pendiente de Autorización</h2>

          <p>Se ha finalizado una rendición que requiere su autorización:</p>

          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Detalles de la Rendición</h3>
            <p><strong>Usuario:</strong> ${rendicionData.usuario}</p>
            <p><strong>Tarjeta:</strong> •••• •••• •••• ${rendicionData.numeroTarjeta.slice(-4)}</p>
            <p><strong>Período:</strong> ${rendicionData.periodo}</p>
            <p><strong>Estado:</strong> <span style="background-color: #f59e0b; color: white; padding: 2px 8px; border-radius: 4px;">ENAUT - Enviado para Autorización</span></p>
            <p><strong>Fecha de Finalización:</strong> ${new Date().toLocaleDateString('es-AR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${authorizationUrl}"
               style="display: inline-block; background-color: #1e3a8a; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;
                      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              Acceder a Autorizaciones
            </a>
          </div>

          <p style="text-align: center; color: #6b7280; font-size: 14px;">
            Haga clic en el botón para acceder directamente sin necesidad de iniciar sesión
          </p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
            <p>Este es un email automático del Sistema de Rendiciones. No responda a este mensaje.</p>
            <p style="text-align: center; margin-top: 15px; font-style: italic;">Powered by AxiomaCloud</p>
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email enviado exitosamente:', result.messageId);
    
    return { 
      success: true, 
      message: 'Email enviado exitosamente',
      messageId: result.messageId,
      recipients: recipients.length
    };

  } catch (error) {
    console.error('Error al enviar email:', error);
    return { 
      success: false, 
      message: 'Error al enviar email',
      error: error.message 
    };
  }
};

// Enviar email de verificación de cuenta
const sendEmailVerification = async (email, verificationToken, nombre) => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('Configuración SMTP no encontrada, email no enviado');
      return { success: false, message: 'Configuración SMTP no encontrada' };
    }

    const transporter = createTransporter();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verificationUrl = `${frontendUrl}/auth/verify-email?token=${verificationToken}`;


    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: 'Verificación de cuenta - Rendiciones App',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">

          <h2 style="color: #2563eb;">¡Bienvenido a Rendiciones App!</h2>

          <p>Hola ${nombre},</p>

          <p>Gracias por registrarte en nuestra aplicación. Para completar el proceso de registro,
          necesitamos verificar tu dirección de email.</p>

          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #374151;">
              <strong>Email registrado:</strong> ${email}
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}"
               style="display: inline-block; background-color: #1e3a8a; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;
                      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              Verificar mi Email
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px;">
            Si no puedes hacer clic en el botón, copia y pega el siguiente enlace en tu navegador:
          </p>
          <p style="word-break: break-all; color: #2563eb; font-size: 14px;">
            ${verificationUrl}
          </p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
            <p><strong>Importante:</strong> Este enlace expira en 24 horas.</p>
            <p>Si no solicitaste esta cuenta, puedes ignorar este email.</p>
            <p style="text-align: center; margin-top: 15px; font-style: italic;">Powered by AxiomaCloud</p>
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email de verificación enviado exitosamente:', result.messageId);

    return {
      success: true,
      message: 'Email de verificación enviado exitosamente',
      messageId: result.messageId
    };

  } catch (error) {
    console.error('Error al enviar email de verificación:', error);
    return {
      success: false,
      message: 'Error al enviar email de verificación',
      error: error.message
    };
  }
};

// Enviar notificación de DKT importado a usuarios con tarjetas
const sendDKTImportNotification = async (usuarios, loteInfo) => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('Configuración SMTP no encontrada, email no enviado');
      return { success: false, message: 'Configuración SMTP no encontrada' };
    }

    const transporter = createTransporter();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const loginUrl = `${frontendUrl}/auth/login`;


    // Preparar lista de destinatarios
    const recipients = usuarios.map(u => u.email);

    if (recipients.length === 0) {
      return { success: false, message: 'No hay destinatarios para notificar' };
    }

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: recipients,
      subject: `Resumen de tarjeta disponible - Período ${loteInfo.periodo}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">

          <h2 style="color: #2563eb;">Resumen de Tarjeta Disponible</h2>

          <p>Estimado usuario,</p>

          <p>Te informamos que se ha importado exitosamente el resumen de tarjeta correspondiente al período
          <strong>${loteInfo.periodo}</strong> de la tarjeta <strong>${loteInfo.codigoTarjeta}</strong>.</p>

          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Detalles del Resumen</h3>
            <p><strong>Período:</strong> ${loteInfo.periodo}</p>
            <p><strong>Tarjeta:</strong> ${loteInfo.codigoTarjeta}</p>
            <p><strong>Lote:</strong> ${loteInfo.loteId}</p>
            <p><strong>Total de transacciones:</strong> ${loteInfo.totalRegistros}</p>
            <p><strong>Fecha de importación:</strong> ${new Date().toLocaleDateString('es-AR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}"
               style="display: inline-block; background-color: #1e3a8a; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;
                      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              Acceder al Sistema
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px;">
            Inicia sesión para revisar y procesar las rendiciones de este período.
          </p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
            <p><strong>Importante:</strong> Este es un email automático del Sistema de Rendiciones.</p>
            <p>Si tienes alguna consulta, contacta al administrador del sistema.</p>
            <p style="text-align: center; margin-top: 15px; font-style: italic;">Powered by AxiomaCloud</p>
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email de notificación DKT enviado exitosamente:', result.messageId);

    return {
      success: true,
      message: 'Email de notificación DKT enviado exitosamente',
      messageId: result.messageId,
      recipients: recipients.length
    };

  } catch (error) {
    console.error('Error al enviar email de notificación DKT:', error);
    return {
      success: false,
      message: 'Error al enviar email de notificación DKT',
      error: error.message
    };
  }
};

module.exports = {
  sendRendicionFinalizadaNotification,
  sendEmailVerification,
  sendDKTImportNotification
};