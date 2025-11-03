const prisma = require('../lib/prisma');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class JobProcessor {
  constructor() {
    this.processingJobs = new Map();
  }

  async createJob(type, userId, parameters) {
    try {
      const job = await prisma.processing_jobs.create({
        data: {
          id: uuidv4(),
          type,
          userId,
          parameters,
          status: 'QUEUED',
          progress: 0,
          updatedAt: new Date()
        }
      });

      console.log(`Job creado: ${job.id} - Tipo: ${type}`);
      return job;
    } catch (error) {
      console.error('Error creando job:', error);
      throw error;
    }
  }

  async updateJobStatus(jobId, status, progress = null, message = null, result = null, error = null) {
    try {
      const updateData = {
        status,
        updatedAt: new Date()
      };

      if (progress !== null) updateData.progress = progress;
      if (message !== null) updateData.message = message;
      if (result !== null) updateData.result = result;
      if (error !== null) updateData.error = error;

      if (status === 'PROCESSING' && !updateData.startedAt) {
        updateData.startedAt = new Date();
      }

      if (status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') {
        updateData.completedAt = new Date();
      }

      const job = await prisma.processing_jobs.update({
        where: { id: jobId },
        data: updateData
      });

      return job;
    } catch (error) {
      console.error(`Error actualizando job ${jobId}:`, error);
      throw error;
    }
  }

  async processJob(jobId) {
    if (this.processingJobs.has(jobId)) {
      console.log(`Job ${jobId} ya está siendo procesado`);
      return;
    }

    this.processingJobs.set(jobId, true);

    try {
      const job = await prisma.processing_jobs.findUnique({
        where: { id: jobId }
      });

      if (!job) {
        throw new Error(`Job ${jobId} no encontrado`);
      }

      if (job.status !== 'QUEUED') {
        console.log(`Job ${jobId} no está en estado QUEUED (${job.status})`);
        return;
      }

      await this.updateJobStatus(jobId, 'PROCESSING', 0, 'Iniciando procesamiento...');

      switch (job.type) {
        case 'DKT_IMPORT':
          await this.processDktImport(jobId, job.parameters);
          break;
        default:
          throw new Error(`Tipo de job no soportado: ${job.type}`);
      }

    } catch (error) {
      console.error(`Error procesando job ${jobId}:`, error);
      await this.updateJobStatus(jobId, 'FAILED', null, null, null, error.message);
    } finally {
      this.processingJobs.delete(jobId);
    }
  }

  async processDktImport(jobId, parameters) {
    const { filePath, loteId, codigoTarjeta, bancoTipoTarjetaId, userEmail, tenantId } = parameters;
    const BusinessRulesEngine = require('./businessRulesEngine');

    try {
      await this.updateJobStatus(jobId, 'PROCESSING', 5, 'Validando archivo...');

      if (!fs.existsSync(filePath)) {
        throw new Error('Archivo no encontrado');
      }

      await this.updateJobStatus(jobId, 'PROCESSING', 10, 'Procesando archivo DKT...');

      // Usar las funciones existentes del archivo DKT
      const { procesarArchivoDKT } = require('../routes/dkt');
      const { registros, totalLineas } = await procesarArchivoDKT(filePath, codigoTarjeta, bancoTipoTarjetaId);

      if (registros.length === 0) {
        throw new Error('No se encontraron registros válidos en el archivo');
      }

      await this.updateJobStatus(jobId, 'PROCESSING', 30, 'Guardando datos en base de datos...');

      // Usar transacción para consistencia
      const resumenesCreados = await prisma.$transaction(async (tx) => {
        // 1. Crear registros en ResumenTarjeta
        await tx.resumen_tarjeta.createMany({
          data: registros.map(registro => ({
            id: uuidv4(),
            ...registro,
            usuarioImportacion: userEmail,
            tenantId: tenantId
          })),
          skipDuplicates: true
        });

        console.log(`📊 [DKT IMPORT] Creando ${registros.length} registros de resumen_tarjeta`);
        
        // Obtener los resumenes creados
        const resumenes = await tx.resumen_tarjeta.findMany({
          where: { loteId },
          orderBy: { id: 'asc' }
        });
        
        await this.updateJobStatus(jobId, 'PROCESSING', 40, 'Creando estructura de cabeceras...');
        
        // 2. Agrupar por lote, número de tarjeta y período para crear cabeceras
        const gruposCabecera = {};
        for (const resumen of resumenes) {
          const key = `${resumen.loteId}_${resumen.numeroTarjeta}_${resumen.periodo}`;
          if (!gruposCabecera[key]) {
            gruposCabecera[key] = {
              loteId: resumen.loteId,
              numeroTarjeta: resumen.numeroTarjeta,
              periodo: resumen.periodo,
              resumenes: []
            };
          }
          gruposCabecera[key].resumenes.push(resumen);
        }
        
        // 3. Crear estado por defecto si no existe
        await tx.estados.upsert({
          where: { codigo: 'PENDIENTE' },
          update: { updatedAt: new Date() },
          create: {
            id: uuidv4(),
            codigo: 'PENDIENTE',
            descripcion: 'Pendiente de rendición',
            updatedAt: new Date()
          }
        });
        
        // 4. Crear registros de cabecera
        const cabecerasData = Object.values(gruposCabecera).map(grupo => ({
          id: uuidv4(),
          loteId: grupo.loteId,
          numeroTarjeta: grupo.numeroTarjeta,
          periodo: grupo.periodo,
          estadoCodigo: 'PENDIENTE',
          tenantId: tenantId,
          updatedAt: new Date()
        }));
        
        await tx.rendicion_tarjeta_cabecera.createMany({
          data: cabecerasData,
          skipDuplicates: true
        });

        console.log(`📊 [DKT IMPORT] Intentando crear ${cabecerasData.length} cabeceras de rendición`);
        
        // 5. Obtener las cabeceras creadas
        const cabeceras = await tx.rendicion_tarjeta_cabecera.findMany({
          where: { loteId },
          orderBy: { id: 'asc' }
        });
        
        await this.updateJobStatus(jobId, 'PROCESSING', 50, 'Aplicando reglas de negocio...');

        // 6. Crear items y aplicar reglas de negocio
        const itemsData = [];
        let cabeceraIndex = 0;

        // Inicializar motor de reglas
        const rulesEngine = new BusinessRulesEngine(tenantId);
        await rulesEngine.loadRules('IMPORTACION_DKT', false, tx);
        
        // Calcular total de items para el progreso
        const totalItems = Object.values(gruposCabecera).reduce((total, grupo) => 
          total + grupo.resumenes.length, 0
        );
        
        let itemsProcessed = 0;
        let rulesAppliedCount = 0;
        
        for (const grupo of Object.values(gruposCabecera)) {
          const cabecera = cabeceras[cabeceraIndex++];
          
          for (const resumen of grupo.resumenes) {
            // Datos base del item
            const baseItemData = {
              id: uuidv4(),
              rendicionCabeceraId: cabecera.id,
              resumenTarjetaId: resumen.id,
              tipoComprobante: null,
              numeroComprobante: null,
              fechaComprobante: (resumen.fechaTransaccion && resumen.fechaTransaccion.trim() !== '') 
                ? (() => {
                    try {
                      // Parsear formato DDMMYY (ej: "251224" = 25/12/2024)
                      const fechaStr = resumen.fechaTransaccion.trim();
                      if (fechaStr.length === 6) {
                        const dia = parseInt(fechaStr.substring(0, 2));
                        const mes = parseInt(fechaStr.substring(2, 4));
                        const anio = parseInt(fechaStr.substring(4, 6));
                        
                        // Convertir año de 2 dígitos a 4 dígitos (asumiendo 2000-2099)
                        const anioCompleto = 2000 + anio;
                        
                        // Crear fecha (mes-1 porque Date usa 0-11 para meses)
                        const fecha = new Date(anioCompleto, mes - 1, dia);
                        
                        // Verificar que la fecha sea válida y coincida con los valores ingresados
                        if (!isNaN(fecha.getTime()) && 
                            fecha.getFullYear() === anioCompleto &&
                            fecha.getMonth() === mes - 1 &&
                            fecha.getDate() === dia) {
                          return fecha;
                        }
                      }
                      
                      console.warn(`Formato de fecha inválido en fechaTransaccion: "${fechaStr}" (esperado: DDMMYY)`);
                      return null;
                    } catch (error) {
                      console.warn(`Error parseando fechaTransaccion: "${resumen.fechaTransaccion}" - ${error.message}`);
                      return null;
                    }
                  })() 
                : null,
              proveedorId: null,
              cuitProveedor: resumen.cuit,
              tipoProducto: null,
              codigoProducto: null,
              netoGravado: null,
              exento: null,
              moneda: resumen.moneda,
              codigoDimension: null,
              subcuenta: null,
              observaciones: null,
              cuentaContable: null,
              cargaManual: false,
              rechazo: false,
              motivoRechazo: null,
              patente: null,
              km: null,
              tipoOrdenCompra: null,
              ordenCompra: null,
              tenantId: tenantId,
              updatedAt: new Date()
            };

            try {
              // Verificar si el job fue cancelado
              if (this.processingJobs.get(jobId) === 'CANCELLED') {
                throw new Error('Job cancelado por el usuario');
              }

              // Aplicar reglas de negocio
              const ruleResult = await rulesEngine.applyRules(
                baseItemData,
                resumen,
                {
                  logExecution: false,
                  contexto: 'DKT_IMPORT'
                }
              );

              itemsData.push(ruleResult.data);
              itemsProcessed++;
              rulesAppliedCount += ruleResult.rulesApplied;

              // Actualizar progreso cada 100 items o cada 5%
              const progressInterval = Math.min(100, Math.ceil(totalItems / 20));
              if (itemsProcessed % progressInterval === 0 || itemsProcessed === totalItems) {
                const progress = 50 + Math.floor((itemsProcessed / totalItems) * 40); // 50-90%
                await this.updateJobStatus(jobId, 'PROCESSING', progress, 
                  `Aplicadas reglas: ${itemsProcessed}/${totalItems} items (${rulesAppliedCount} reglas ejecutadas)`);
              }
            } catch (error) {
              console.error(`Error aplicando reglas al item ${resumen.id}:`, error);
              // En caso de error, usar datos base
              itemsData.push(baseItemData);
              itemsProcessed++;
            }
          }
        }
        
        await this.updateJobStatus(jobId, 'PROCESSING', 90, 'Guardando items en base de datos...');
        
        await tx.rendicion_tarjeta_items.createMany({
          data: itemsData
        });

        return resumenes;
      }, {
        timeout: 600000 // 10 minutos
      });

      await this.updateJobStatus(jobId, 'PROCESSING', 95, 'Limpiando archivos temporales...');
      
      // Limpiar archivo temporal
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Enviar notificaciones por email a usuarios con tarjetas en el DKT
      await this.updateJobStatus(jobId, 'PROCESSING', 95, 'Enviando notificaciones por email...');
      try {
        const { sendDKTImportNotification } = require('./emailService');

        // Necesitamos obtener usuarios con tarjetas
        const numerosTarjeta = await prisma.resumen_tarjeta.findMany({
          where: {
            loteId,
            tenantId
          },
          select: {
            numeroTarjeta: true
          },
          distinct: ['numeroTarjeta']
        });

        if (numerosTarjeta.length > 0) {
          const tarjetasNumeros = numerosTarjeta
            .map(t => t.numeroTarjeta)
            .filter(num => num && num.length > 0);

          console.log(`📱 [JOB-${jobId}] Números de tarjeta en DKT:`, tarjetasNumeros);

          // Normalizar números de tarjeta (sin espacios) para la búsqueda
          const tarjetasNormalizadas = tarjetasNumeros.map(num => num.replace(/\s/g, ''));
          console.log(`📱 [JOB-${jobId}] Números normalizados (sin espacios):`, tarjetasNormalizadas);

          // Buscar tarjetas con diferentes formatos
          const tarjetasConEspacios = await prisma.user_tarjetas_credito.findMany({
            where: {
              numeroTarjeta: {
                in: tarjetasNumeros
              },
              activo: true,
              tenantId
            },
            select: {
              numeroTarjeta: true,
              userId: true
            }
          });

          const tarjetasSinEspacios = await prisma.user_tarjetas_credito.findMany({
            where: {
              numeroTarjeta: {
                in: tarjetasNormalizadas
              },
              activo: true,
              tenantId
            },
            select: {
              numeroTarjeta: true,
              userId: true
            }
          });

          // Combinar resultados y eliminar duplicados
          const todasLasTarjetas = [...tarjetasConEspacios, ...tarjetasSinEspacios];
          const tarjetasUsuarios = todasLasTarjetas.filter((tarjeta, index, arr) =>
            arr.findIndex(t => t.userId === tarjeta.userId && t.numeroTarjeta === tarjeta.numeroTarjeta) === index
          );

          console.log(`💳 [JOB-${jobId}] Tarjetas de usuario encontradas:`, tarjetasUsuarios.length);
          tarjetasUsuarios.forEach(t => {
            console.log(`💳 [JOB-${jobId}] - Usuario ${t.userId}: ${t.numeroTarjeta}`);
          });

          // Obtener IDs de usuarios que tienen las tarjetas
          const userIds = [...new Set(tarjetasUsuarios.map(t => t.userId))];
          console.log(`👥 [JOB-${jobId}] IDs de usuarios con tarjetas:`, userIds);

          if (userIds.length === 0) {
            console.log(`❌ [JOB-${jobId}] No se encontraron usuarios con las tarjetas del DKT`);
          }

          const usuariosConTarjetas = await prisma.users.findMany({
            where: {
              id: {
                in: userIds
              },
              tenantId,
              activo: true,
              emailVerified: true,
              recibeNotificacionesEmail: true
            },
            select: {
              id: true,
              email: true,
              nombre: true,
              apellido: true,
              activo: true,
              emailVerified: true,
              recibeNotificacionesEmail: true
            }
          });

          console.log(`🔍 [JOB-${jobId}] Usuarios después del filtro de notificaciones:`, usuariosConTarjetas.length);

          // Log detallado de cada usuario
          for (const userId of userIds) {
            const usuario = await prisma.users.findUnique({
              where: { id: userId },
              select: {
                id: true,
                email: true,
                nombre: true,
                apellido: true,
                activo: true,
                emailVerified: true,
                recibeNotificacionesEmail: true,
                tenantId: true
              }
            });

            if (usuario) {
              console.log(`👤 [JOB-${jobId}] Usuario ${userId}:`, {
                email: usuario.email,
                activo: usuario.activo,
                emailVerified: usuario.emailVerified,
                recibeNotificacionesEmail: usuario.recibeNotificacionesEmail,
                tenantId: usuario.tenantId,
                tenantMatch: usuario.tenantId === tenantId
              });
            }
          }

          if (usuariosConTarjetas.length > 0) {
            const loteInfo = {
              loteId,
              periodo: parameters.periodo,
              codigoTarjeta,
              totalRegistros: resumenesCreados.length
            };

            const emailResult = await sendDKTImportNotification(usuariosConTarjetas, loteInfo);

            if (emailResult.success) {
              console.log(`✅ [JOB-${jobId}] Emails enviados a ${emailResult.recipients} usuarios`);
            } else {
              console.error(`❌ [JOB-${jobId}] Error al enviar emails:`, emailResult.message);
            }
          } else {
            console.log(`ℹ️ [JOB-${jobId}] No se encontraron usuarios para notificar`);
          }
        }
      } catch (emailError) {
        console.error(`❌ [JOB-${jobId}] Error en proceso de notificación:`, emailError);
        // No fallar el job por errores de email
      }

      const result = {
        totalProcessed: resumenesCreados.length,
        loteId: loteId,
        totalLineas: totalLineas,
        message: `Importación DKT completada exitosamente. Procesados ${resumenesCreados.length} registros de ${totalLineas} líneas del archivo.`
      };

      await this.updateJobStatus(jobId, 'COMPLETED', 100, 'Importación completada', result);

    } catch (error) {
      console.error(`Error en procesamiento DKT para job ${jobId}:`, error);
      throw error;
    }
  }

  async getJobStatus(jobId) {
    try {
      const job = await prisma.processing_jobs.findUnique({
        where: { id: jobId }
      });
      return job;
    } catch (error) {
      console.error(`Error obteniendo status del job ${jobId}:`, error);
      throw error;
    }
  }

  async getUserJobs(userId, limit = 50) {
    try {
      const jobs = await prisma.processing_jobs.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit
      });
      return jobs;
    } catch (error) {
      console.error(`Error obteniendo jobs del usuario ${userId}:`, error);
      throw error;
    }
  }

  async cancelJob(jobId) {
    try {
      const job = await prisma.processing_jobs.findUnique({
        where: { id: jobId }
      });

      if (!job) {
        throw new Error('Job no encontrado');
      }

      if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
        throw new Error('No se puede cancelar un job que ya terminó');
      }

      await this.updateJobStatus(jobId, 'CANCELLED', null, 'Job cancelado por el usuario');
      
      // Si está siendo procesado, marcarlo para cancelación
      if (this.processingJobs.has(jobId)) {
        this.processingJobs.set(jobId, 'CANCELLED');
      }

      return { message: 'Job cancelado exitosamente' };
    } catch (error) {
      console.error(`Error cancelando job ${jobId}:`, error);
      throw error;
    }
  }
}

module.exports = JobProcessor;