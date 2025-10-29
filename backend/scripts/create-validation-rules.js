const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createValidationRules() {
  console.log('🔧 Creando reglas de validación para finalización de rendición...\n');

  try {
    // Campos obligatorios para RendicionTarjetaItem (excluyendo patente y km)
    const camposObligatoriosItems = [
      {
        campo: 'tipoComprobante',
        nombre: 'Tipo de Comprobante',
        mensaje: 'El tipo de comprobante es obligatorio'
      },
      {
        campo: 'numeroComprobante',
        nombre: 'Número de Comprobante',
        mensaje: 'El número de comprobante es obligatorio'
      },
      {
        campo: 'fechaComprobante',
        nombre: 'Fecha de Comprobante',
        mensaje: 'La fecha del comprobante es obligatoria'
      },
      {
        campo: 'proveedorId',
        nombre: 'Proveedor',
        mensaje: 'El proveedor es obligatorio'
      },
      {
        campo: 'netoGravado',
        nombre: 'Neto Gravado',
        mensaje: 'El neto gravado es obligatorio'
      },
      {
        campo: 'codigoDimension',
        nombre: 'Código Dimensión',
        mensaje: 'El código de dimensión es obligatorio'
      },
      {
        campo: 'subcuenta',
        nombre: 'Subcuenta',
        mensaje: 'La subcuenta es obligatoria'
      },
      {
        campo: 'cuentaContable',
        nombre: 'Cuenta Contable',
        mensaje: 'La cuenta contable es obligatoria'
      }
    ];

    const reglasCreadas = [];

    // Crear una regla por cada campo obligatorio
    for (let i = 0; i < camposObligatoriosItems.length; i++) {
      const campo = camposObligatoriosItems[i];
      const esUltima = (i === camposObligatoriosItems.length - 1); // La última regla cambia el estado

      const regla = {
        codigo: `VALIDAR_${campo.campo.toUpperCase()}_OBLIGATORIO`,
        nombre: `Validar ${campo.nombre} Obligatorio`,
        descripcion: `Valida que el campo ${campo.nombre} esté completo antes de finalizar la rendición`,
        tipo: 'VALIDACION',
        activa: true,
        prioridad: 100 + i, // Prioridades secuenciales
        version: 1,
        configuracion: {
          estadoEntrada: 'PENDIENTE',
          estadoSalida: esUltima ? 'ENAUT' : 'PENDIENTE', // Solo la última cambia el estado
          esUltima: esUltima,
          nivel: 'ERROR',
          mensaje: campo.mensaje,
          condiciones: [
            {
              campo: campo.campo,
              operador: 'IS_NOT_NULL',
              valor: null
            },
            {
              campo: campo.campo,
              operador: 'IS_NOT_EMPTY',
              valor: null
            }
          ]
        }
      };

      console.log(`📝 Creando regla: ${regla.codigo}${esUltima ? ' (ÚLTIMA - cambia estado)' : ''}`);

      const reglaCreada = await prisma.reglaNegocio.create({
        data: regla
      });

      reglasCreadas.push(reglaCreada);
    }

    console.log(`\n✅ Se crearon ${reglasCreadas.length} reglas de validación exitosamente\n`);

    console.log('📋 Resumen de reglas creadas:');
    reglasCreadas.forEach((regla, index) => {
      const config = regla.configuracion;
      console.log(`   ${index + 1}. ${regla.codigo}`);
      console.log(`      Estado: ${config.estadoEntrada} → ${config.estadoSalida}`);
      console.log(`      Es última: ${config.esUltima}`);
      console.log(`      Prioridad: ${regla.prioridad}`);
      console.log('');
    });

    console.log('🎯 Flujo de validación configurado:');
    console.log('   1. Estado inicial: PENDIENTE');
    console.log('   2. Se ejecutan 8 reglas de validación en secuencia');
    console.log('   3. Si TODAS las reglas pasan en TODOS los items:');
    console.log('   4. La última regla cambia el estado: PENDIENTE → ENAUT');
    console.log('\n   ⚠️  Si CUALQUIER regla falla en CUALQUIER item:');
    console.log('   → El estado NO cambia y se muestran los errores');

  } catch (error) {
    console.error('❌ Error creando reglas de validación:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la creación de reglas
createValidationRules();