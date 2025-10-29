const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function crearReglaAutoCompleteProducto() {
  try {
    console.log('Creando regla de auto-complete para productos en grilla...\n');
    
    // Primero verificar si ya existe
    const existingRule = await prisma.reglaNegocio.findFirst({
      where: {
        codigo: 'GRID_AUTO_PRODUCTO_CUENTA'
      }
    });
    
    if (existingRule) {
      console.log('⚠️  La regla ya existe, actualizando...');
    }
    
    // Crear o actualizar la regla
    const configuracionCompleta = {
      condiciones: [
        {
          campo: 'codigoProducto',
          operador: 'NOT_EMPTY',
          valor: ''
        }
      ],
      acciones: [
        {
          tipo: 'LOOKUP_JSON',
          campo_origen: 'codigoProducto',
          tabla: 'parametros_maestros',
          condiciones: [
            {
              campo: 'tipo_campo',
              valor: 'codigo_producto'
            },
            {
              campo: 'codigo',
              valor: '{campo_origen}'
            }
          ],
          campo_busqueda: 'parametros_json',
          campo_busqueda_json: 'cuenta_contable',
          campo_destino: 'cuentaContable',
          valor_por_defecto: null
        }
      ],
      detenerEnCoincidencia: false
    };
    
    const regla = await prisma.reglaNegocio.upsert({
      where: {
        codigo: 'GRID_AUTO_PRODUCTO_CUENTA'
      },
      update: {
        nombre: 'Auto-completar Cuenta Contable desde Producto',
        descripcion: 'Cuando se selecciona un código de producto en la grilla, busca la cuenta contable en el campo JSON y la completa automáticamente',
        tipo: 'GRID_AUTOCOMPLETE',
        configuracion: configuracionCompleta,
        prioridad: 10,
        activa: true
      },
      create: {
        codigo: 'GRID_AUTO_PRODUCTO_CUENTA',
        nombre: 'Auto-completar Cuenta Contable desde Producto',
        descripcion: 'Cuando se selecciona un código de producto en la grilla, busca la cuenta contable en el campo JSON y la completa automáticamente',
        tipo: 'GRID_AUTOCOMPLETE',
        configuracion: configuracionCompleta,
        prioridad: 10,
        activa: true
      }
    });
    
    console.log('✅ Regla creada/actualizada exitosamente');
    console.log('\n=== DETALLES DE LA REGLA ===');
    console.log(`Código: ${regla.codigo}`);
    console.log(`Nombre: ${regla.nombre}`);
    console.log(`Tipo: ${regla.tipo}`);
    console.log(`Prioridad: ${regla.prioridad}`);
    console.log(`Estado: ${regla.activa ? 'ACTIVA' : 'INACTIVA'}`);
    
    console.log('\n📋 FUNCIONAMIENTO:');
    console.log('1. Usuario selecciona un código de producto en la grilla');
    console.log('2. Sistema busca el producto en parametros_maestros (tipo_campo="codigo_producto")');
    console.log('3. Extrae el valor de cuenta_contable del campo JSON');
    console.log('4. Auto-completa el campo cuentaContable en la grilla');
    console.log('\n💡 Optimizado para:');
    console.log('- Una sola llamada a la API por producto seleccionado');
    console.log('- Búsqueda directa por índice único (tipo_campo + codigo)');
    console.log('- Sin procesamiento adicional en el frontend');
    
    // Verificar algunos productos como ejemplo
    console.log('\n=== VERIFICACIÓN DE DATOS ===');
    const ejemplos = await prisma.parametroMaestro.findMany({
      where: { 
        tipo_campo: 'codigo_producto',
        parametros_json: {
          path: ['cuenta_contable'],
          not: null
        }
      },
      take: 3
    });
    
    console.log('\nEjemplos de productos con cuenta contable:');
    ejemplos.forEach(p => {
      console.log(`  ${p.codigo}: ${p.nombre} -> Cuenta: ${p.parametros_json?.cuenta_contable}`);
    });
    
    // Contar total de productos con cuenta contable
    const totalConCuenta = await prisma.parametroMaestro.count({
      where: { 
        tipo_campo: 'codigo_producto',
        parametros_json: {
          path: ['cuenta_contable'],
          not: null
        }
      }
    });
    
    console.log(`\n📊 Total de productos con cuenta contable: ${totalConCuenta}/65`);
    
  } catch (error) {
    console.error('❌ Error creando regla:', error);
  } finally {
    await prisma.$disconnect();
  }
}

crearReglaAutoCompleteProducto();