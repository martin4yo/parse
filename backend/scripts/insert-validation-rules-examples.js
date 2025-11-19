/**
 * Script para insertar reglas de validación de ejemplo
 *
 * Uso:
 *   node scripts/insert-validation-rules-examples.js
 *
 * Requiere:
 *   - Variable TENANT_ID en .env o pasar como argumento
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Obtener tenantId del argumento o variable de entorno
const TENANT_ID = process.argv[2] || process.env.DEFAULT_TENANT_ID;

if (!TENANT_ID) {
  console.error('❌ Error: Debe proporcionar un TENANT_ID');
  console.error('Uso: node scripts/insert-validation-rules-examples.js <TENANT_ID>');
  console.error('O definir DEFAULT_TENANT_ID en .env');
  process.exit(1);
}

const validationRules = [
  {
    codigo: 'VAL_CUIT_OBLIGATORIO',
    nombre: 'Validar CUIT no vacío',
    tipo: 'VALIDACION',
    activa: true,
    prioridad: 10,
    configuracion: {
      aplicaA: 'DOCUMENTO',
      condiciones: [
        {
          campo: 'cuitExtraido',
          operador: 'IS_NOT_EMPTY'
        }
      ],
      mensajeError: 'El CUIT del proveedor es obligatorio para exportar el documento',
      severidad: 'BLOQUEANTE',
      stopOnMatch: true
    }
  },
  {
    codigo: 'VAL_IMPORTE_POSITIVO',
    nombre: 'Validar importe mayor a cero',
    tipo: 'VALIDACION',
    activa: true,
    prioridad: 20,
    configuracion: {
      aplicaA: 'DOCUMENTO',
      condiciones: [
        {
          campo: 'importeExtraido',
          operador: 'GREATER_THAN',
          valor: 0
        }
      ],
      mensajeError: 'El importe total debe ser mayor a $0',
      severidad: 'ERROR',
      stopOnMatch: false
    }
  },
  {
    codigo: 'VAL_FECHA_NO_FUTURA',
    nombre: 'Validar fecha no futura',
    tipo: 'VALIDACION',
    activa: true,
    prioridad: 30,
    configuracion: {
      aplicaA: 'DOCUMENTO',
      condiciones: [
        {
          campo: 'fechaExtraida',
          operador: 'LESS_OR_EQUAL',
          valor: new Date().toISOString().split('T')[0] // Fecha de hoy
        }
      ],
      mensajeError: 'La fecha del comprobante no puede ser futura',
      severidad: 'ERROR',
      stopOnMatch: false
    }
  },
  {
    codigo: 'VAL_FORMATO_COMPROBANTE',
    nombre: 'Validar formato número comprobante',
    tipo: 'VALIDACION',
    activa: true,
    prioridad: 40,
    configuracion: {
      aplicaA: 'DOCUMENTO',
      condiciones: [
        {
          campo: 'numeroComprobanteExtraido',
          operador: 'REGEX',
          valor: '^\\d{5}-\\d{8}$'
        }
      ],
      mensajeError: 'El número de comprobante no tiene el formato esperado (00000-00000000). Se recomienda corregirlo.',
      severidad: 'WARNING',
      stopOnMatch: false
    }
  },
  {
    codigo: 'VAL_RAZON_SOCIAL_PRESENTE',
    nombre: 'Validar razón social presente',
    tipo: 'VALIDACION',
    activa: true,
    prioridad: 50,
    configuracion: {
      aplicaA: 'DOCUMENTO',
      condiciones: [
        {
          campo: 'razonSocialExtraida',
          operador: 'IS_NOT_EMPTY'
        }
      ],
      mensajeError: 'Se recomienda completar la razón social del proveedor',
      severidad: 'WARNING',
      stopOnMatch: false
    }
  },
  {
    codigo: 'VAL_TIPO_COMPROBANTE_VALIDO',
    nombre: 'Validar tipo de comprobante válido',
    tipo: 'VALIDACION',
    activa: true,
    prioridad: 60,
    configuracion: {
      aplicaA: 'DOCUMENTO',
      condiciones: [
        {
          campo: 'tipoComprobanteExtraido',
          operador: 'IN',
          valor: ['FACTURA A', 'FACTURA B', 'FACTURA C', 'TICKET', 'NOTA DE CREDITO', 'NOTA DE DEBITO', 'RECIBO']
        }
      ],
      mensajeError: 'El tipo de comprobante debe ser uno de los valores permitidos',
      severidad: 'ERROR',
      stopOnMatch: false
    }
  },
  {
    codigo: 'VAL_CAE_FORMATO',
    nombre: 'Validar formato CAE',
    tipo: 'VALIDACION',
    activa: true,
    prioridad: 70,
    configuracion: {
      aplicaA: 'DOCUMENTO',
      condiciones: [
        {
          campo: 'caeExtraido',
          operador: 'IS_NOT_EMPTY'
        },
        {
          campo: 'caeExtraido',
          operador: 'REGEX',
          valor: '^\\d{14}$'
        }
      ],
      mensajeError: 'El CAE debe tener 14 dígitos',
      severidad: 'WARNING',
      stopOnMatch: false
    }
  },
  {
    codigo: 'VAL_LINEA_DESCRIPCION',
    nombre: 'Validar descripción en líneas',
    tipo: 'VALIDACION',
    activa: true,
    prioridad: 80,
    configuracion: {
      aplicaA: 'LINEAS',
      condiciones: [
        {
          campo: 'descripcion',
          operador: 'IS_NOT_EMPTY'
        }
      ],
      mensajeError: 'Cada línea debe tener una descripción',
      severidad: 'ERROR',
      stopOnMatch: false
    }
  },
  {
    codigo: 'VAL_LINEA_CANTIDAD_POSITIVA',
    nombre: 'Validar cantidad positiva en líneas',
    tipo: 'VALIDACION',
    activa: true,
    prioridad: 85,
    configuracion: {
      aplicaA: 'LINEAS',
      condiciones: [
        {
          campo: 'cantidad',
          operador: 'GREATER_THAN',
          valor: 0
        }
      ],
      mensajeError: 'La cantidad debe ser mayor a 0',
      severidad: 'ERROR',
      stopOnMatch: false
    }
  },
  {
    codigo: 'VAL_IMPUESTO_ALICUOTA',
    nombre: 'Validar alícuota de impuesto',
    tipo: 'VALIDACION',
    activa: true,
    prioridad: 90,
    configuracion: {
      aplicaA: 'IMPUESTOS',
      condiciones: [
        {
          campo: 'alicuota',
          operador: 'IN',
          valor: ['0', '10.5', '21', '27']
        }
      ],
      mensajeError: 'La alícuota debe ser 0%, 10.5%, 21% o 27%',
      severidad: 'ERROR',
      stopOnMatch: false
    }
  }
];

async function insertValidationRules() {
  console.log('🚀 Insertando reglas de validación de ejemplo...\n');
  console.log(`📋 Tenant ID: ${TENANT_ID}`);
  console.log(`📝 Reglas a insertar: ${validationRules.length}\n`);

  let insertadas = 0;
  let omitidas = 0;

  for (const rule of validationRules) {
    try {
      // Verificar si ya existe
      const existente = await prisma.reglas_negocio.findFirst({
        where: {
          codigo: rule.codigo,
          tenantId: TENANT_ID
        }
      });

      if (existente) {
        console.log(`⏭️  ${rule.codigo} - Ya existe, omitiendo`);
        omitidas++;
        continue;
      }

      // Insertar regla
      await prisma.reglas_negocio.create({
        data: {
          codigo: rule.codigo,
          nombre: rule.nombre,
          tipo: rule.tipo,
          activa: rule.activa,
          prioridad: rule.prioridad,
          tenantId: TENANT_ID,
          configuracion: rule.configuracion
        }
      });

      console.log(`✅ ${rule.codigo} - Insertada`);
      insertadas++;

    } catch (error) {
      console.error(`❌ Error insertando ${rule.codigo}:`, error.message);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Reglas insertadas: ${insertadas}`);
  console.log(`⏭️  Reglas omitidas: ${omitidas}`);
  console.log(`❌ Reglas con error: ${validationRules.length - insertadas - omitidas}`);
  console.log('='.repeat(50));
}

// Ejecutar
insertValidationRules()
  .then(() => {
    console.log('\n🎉 Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
