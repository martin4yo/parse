/**
 * Script para crear regla de negocio que valida CUITs extraídos
 * contra la lista de cuit_propio del tenant
 *
 * Lógica:
 * - Si cuitExtraido está en cuit_propio → intercambiar (es el destinatario, no el emisor)
 * - Si cuitDestinatario NO está en cuit_propio pero cuitExtraido SÍ → intercambiar
 * - Esto corrige cuando la IA confunde emisor con destinatario
 *
 * Ejecutar: node src/scripts/crear-regla-validar-cuits.js
 */

const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();

async function crearReglaValidarCuits() {
  console.log('🔧 Creando regla de validación de CUITs...\n');

  try {
    // Obtener el tenant
    const tenant = await prisma.tenants.findFirst({
      where: { activo: true }
    });

    if (!tenant) {
      console.log('❌ No se encontró ningún tenant activo');
      return;
    }

    console.log(`📋 Usando tenant: ${tenant.nombre} (${tenant.id})\n`);

    // Verificar si ya existe la regla
    const reglaExistente = await prisma.reglas_negocio.findFirst({
      where: {
        nombre: 'Validar y corregir CUITs emisor/destinatario',
        tenantId: tenant.id
      }
    });

    if (reglaExistente) {
      console.log('ℹ️ La regla ya existe, actualizando...');

      await prisma.reglas_negocio.update({
        where: { id: reglaExistente.id },
        data: {
          descripcion: 'Verifica si el CUIT extraído como emisor es en realidad del destinatario (empresa propia) y los intercambia si es necesario',
          condiciones: [
            {
              campo: 'cuitExtraido',
              operador: 'IS_NOT_NULL'
            }
          ],
          acciones: [
            {
              tipo: 'VALIDAR_CUITS_PROPIOS',
              descripcion: 'Verificar CUITs contra lista de cuit_propio y corregir si están invertidos',
              parametros: {
                tipoCampoValidacion: 'cuit_propio',
                campoEmisor: 'cuitExtraido',
                campoDestinatario: 'cuitDestinatario',
                campoCuitsExtraidos: 'cuitsExtraidos',
                intercambiarSiNecesario: true
              }
            }
          ],
          prioridad: 5, // Alta prioridad para ejecutarse temprano
          activo: true,
          updatedAt: new Date()
        }
      });

      console.log('✅ Regla actualizada');
    } else {
      // Crear la regla
      await prisma.reglas_negocio.create({
        data: {
          id: uuidv4(),
          tenantId: tenant.id,
          codigo: 'VALIDAR_CUITS_PROPIOS',
          nombre: 'Validar y corregir CUITs emisor/destinatario',
          descripcion: 'Verifica si el CUIT extraído como emisor es en realidad del destinatario (empresa propia) y los intercambia si es necesario',
          tipo: 'DOCUMENTO',
          prioridad: 5,
          activa: true,
          configuracion: {
            tipoEntidad: 'documento',
            evento: 'POST_EXTRACCION',
            condiciones: [
              {
                campo: 'cuitExtraido',
                operador: 'IS_NOT_NULL'
              }
            ],
            acciones: [
              {
                operacion: 'VALIDAR_CUITS_PROPIOS',
                descripcion: 'Verificar CUITs contra lista de cuit_propio y corregir si están invertidos',
                tipoCampoValidacion: 'cuit_propio',
                campoEmisor: 'cuitExtraido',
                campoDestinatario: 'cuitDestinatario',
                campoCuitsExtraidos: 'cuitsExtraidos',
                intercambiarSiNecesario: true
              }
            ]
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      console.log('✅ Regla creada exitosamente');
    }

    console.log('\n📌 La regla funcionará así:');
    console.log('   1. Después de extraer datos de una factura');
    console.log('   2. Busca cuitExtraido en parametros_maestros (tipo_campo=cuit_propio)');
    console.log('   3. Si lo encuentra → significa que es del destinatario, no del emisor');
    console.log('   4. Intercambia cuitExtraido ↔ cuitDestinatario');
    console.log('\n⚠️ IMPORTANTE: Necesitas implementar la acción VALIDAR_CUITS_PROPIOS en businessRulesEngine.js');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

crearReglaValidarCuits();
