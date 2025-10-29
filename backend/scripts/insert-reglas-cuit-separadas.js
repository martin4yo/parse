const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function insertarReglasCuit() {
  try {
    console.log('🚀 Insertando 3 reglas de mapeo CUIT separadas...\n');

    // Eliminar regla anterior unificada si existe
    await prisma.reglaNegocio.deleteMany({
      where: { codigo: 'MAPEO_CUIT_PROVEEDOR' }
    });

    // REGLA 1: CUIT normal - buscar en proveedores
    const regla1 = {
      codigo: 'CUIT_BUSCAR_PROVEEDOR',
      nombre: '1. CUIT - Buscar Proveedor',
      descripcion: 'Si el CUIT es distinto de 00000000000, busca el proveedor y asigna su código',
      tipo: 'IMPORTACION_DKT',
      prioridad: 100,
      activa: true,
      configuracion: {
        descripcion: 'Busca el CUIT en los proveedores y asigna el código correspondiente',
        condiciones: [
          {
            campo: 'resumen.cuit',
            operador: 'IS_NOT_NULL',
            valor: null
          },
          {
            campo: 'resumen.cuit',
            operador: 'NOT_EQUALS',
            valor: '00000000000'
          }
        ],
        logicOperator: 'AND',
        acciones: [
          {
            operacion: 'LOOKUP_JSON',
            campo: 'proveedorId',
            tipoCampo: 'proveedor',
            campoJSON: 'cuit',
            valorConsulta: '{resumen.cuit}',
            campoResultado: 'codigo',
            valorDefecto: null
          }
        ],
        stopOnMatch: true
      }
    };

    // REGLA 2: CUIT 00000000000 y moneda ARP
    const regla2 = {
      codigo: 'CUIT_CEROS_ARP',
      nombre: '2. CUIT Ceros - Moneda ARP',
      descripcion: 'Si el CUIT es 00000000000 y la moneda es ARP/ARS, asigna código 9994',
      tipo: 'IMPORTACION_DKT',
      prioridad: 101,
      activa: true,
      configuracion: {
        descripcion: 'Para CUIT 00000000000 con moneda ARP/ARS asigna código 9994',
        condiciones: [
          {
            campo: 'resumen.cuit',
            operador: 'EQUALS',
            valor: '00000000000'
          },
          {
            campo: 'resumen.moneda',
            operador: 'IN',
            valor: 'ARP,ARS'
          }
        ],
        logicOperator: 'AND',
        acciones: [
          {
            operacion: 'SET',
            campo: 'proveedorId',
            valor: '9994'
          }
        ],
        stopOnMatch: true
      }
    };

    // REGLA 3: CUIT 00000000000 y moneda USD
    const regla3 = {
      codigo: 'CUIT_CEROS_USD',
      nombre: '3. CUIT Ceros - Moneda USD',
      descripcion: 'Si el CUIT es 00000000000 y la moneda es USD, asigna código 9995',
      tipo: 'IMPORTACION_DKT',
      prioridad: 102,
      activa: true,
      configuracion: {
        descripcion: 'Para CUIT 00000000000 con moneda USD asigna código 9995',
        condiciones: [
          {
            campo: 'resumen.cuit',
            operador: 'EQUALS',
            valor: '00000000000'
          },
          {
            campo: 'resumen.moneda',
            operador: 'EQUALS',
            valor: 'USD'
          }
        ],
        logicOperator: 'AND',
        acciones: [
          {
            operacion: 'SET',
            campo: 'proveedorId',
            valor: '9995'
          }
        ],
        stopOnMatch: true
      }
    };

    // Insertar las tres reglas
    const reglas = [regla1, regla2, regla3];
    
    for (const regla of reglas) {
      const created = await prisma.reglaNegocio.create({
        data: {
          codigo: regla.codigo,
          nombre: regla.nombre,
          descripcion: regla.descripcion,
          tipo: regla.tipo,
          prioridad: regla.prioridad,
          activa: regla.activa,
          configuracion: regla.configuracion
        }
      });
      
      console.log(`✅ Regla creada: ${created.nombre}`);
      console.log(`   Código: ${created.codigo}`);
      console.log(`   Prioridad: ${created.prioridad}`);
      console.log(`   Condiciones: ${regla.configuracion.condiciones.length}`);
      console.log(`   Acciones: ${regla.configuracion.acciones.length}`);
      console.log('');
    }

    // Verificar que las reglas se insertaron correctamente
    const reglasInsertadas = await prisma.reglaNegocio.findMany({
      where: {
        codigo: {
          in: ['CUIT_BUSCAR_PROVEEDOR', 'CUIT_CEROS_ARP', 'CUIT_CEROS_USD']
        }
      },
      orderBy: { prioridad: 'asc' }
    });

    console.log('📊 Resumen final:');
    console.log(`   Total de reglas insertadas: ${reglasInsertadas.length}`);
    console.log('\n🔍 Reglas activas en orden de prioridad:');
    reglasInsertadas.forEach(r => {
      console.log(`   ${r.prioridad}. ${r.nombre} (${r.codigo})`);
    });

  } catch (error) {
    console.error('❌ Error al insertar las reglas:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
insertarReglasCuit()
  .then(() => {
    console.log('\n✨ Las 3 reglas se insertaron correctamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });