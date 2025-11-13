/**
 * Corregir configuración de REGLA_CUENTA_CONTABLE_ITEMS
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixRegla() {
  try {
    console.log('🔧 Corrigiendo REGLA_CUENTA_CONTABLE_ITEMS...\n');

    const regla = await prisma.reglas_negocio.findUnique({
      where: { codigo: 'REGLA_CUENTA_CONTABLE_ITEMS' }
    });

    if (!regla) {
      console.log('❌ No existe la regla');
      return;
    }

    console.log('📋 Configuración ANTES:');
    console.log(JSON.stringify(regla.configuracion, null, 2));

    // Corregir la configuración
    const config = regla.configuracion;

    // Actualizar la acción
    config.acciones = [{
      operacion: 'LOOKUP',  // Cambiar de LOOKUP_JSON a LOOKUP
      tabla: 'parametros_maestros',
      campoConsulta: 'codigo',  // Buscar por el campo codigo
      valorConsulta: '{codigoProducto}',  // Agregar {} para interpolar
      campoResultado: 'parametros_json',  // Obtener el objeto JSON
      campoJSON: 'cuenta_contable',  // Extraer cuenta_contable del JSON
      campo: 'cuentaContable',  // Guardar en cuentaContable
      valorDefecto: ''
    }];

    // Actualizar en BD
    await prisma.reglas_negocio.update({
      where: { id: regla.id },
      data: {
        configuracion: config,
        updatedAt: new Date()
      }
    });

    console.log('\n📋 Configuración DESPUÉS:');
    console.log(JSON.stringify(config, null, 2));

    console.log('\n✅ Regla corregida exitosamente');

    console.log('\n💡 Cómo funciona ahora:');
    console.log('   1. Toma el valor de {codigoProducto} de la línea');
    console.log('   2. Busca en parametros_maestros donde codigo = ese valor');
    console.log('   3. Obtiene el campo parametros_json.cuenta_contable');
    console.log('   4. Lo guarda en el campo cuentaContable de la línea');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixRegla();
