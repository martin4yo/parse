/**
 * Script de migración: Tipos de Parámetro
 *
 * Migra los tipos de parámetros hardcodeados a la tabla tipos_parametro.
 * Esta tabla es GLOBAL (sin tenant) y define qué tipos de campos existen.
 *
 * Ejecutar: node src/scripts/migrate-tipos-parametro.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Tipos de parámetros que estaban hardcodeados en maestros.js
const tiposParametro = [
  // Productos y Conceptos
  { codigo: 'tipo_producto', nombre: 'Tipo de Producto', grupo: 'Productos y Conceptos', orden: 1 },
  { codigo: 'codigo_producto', nombre: 'Código de Producto', grupo: 'Productos y Conceptos', orden: 2 },
  { codigo: 'concepto_modulo', nombre: 'Concepto Módulo', grupo: 'Productos y Conceptos', orden: 3 },
  { codigo: 'concepto_tipo', nombre: 'Concepto Tipo', grupo: 'Productos y Conceptos', orden: 4 },
  { codigo: 'concepto_codigo', nombre: 'Concepto Código', grupo: 'Productos y Conceptos', orden: 5 },
  { codigo: 'concepto_liquidacion', nombre: 'Concepto de Liquidación', grupo: 'Productos y Conceptos', orden: 6 },

  // Comercio/Proveedor
  { codigo: 'modulo_comprobante', nombre: 'Módulo Comprobante', grupo: 'Comercio/Proveedor', orden: 1 },
  { codigo: 'tipo_registro', nombre: 'Tipo de Registro', grupo: 'Comercio/Proveedor', orden: 2 },
  { codigo: 'comprobante_origen', nombre: 'Comprobante Origen', grupo: 'Comercio/Proveedor', orden: 3 },
  { codigo: 'codigo_origen', nombre: 'Código Origen', grupo: 'Comercio/Proveedor', orden: 4 },
  { codigo: 'proveedor', nombre: 'Proveedor', grupo: 'Comercio/Proveedor', orden: 5 },
  { codigo: 'tipo_orden_compra', nombre: 'Tipo Orden Compra', grupo: 'Comercio/Proveedor', orden: 6 },

  // Información Fiscal
  { codigo: 'tipo_documento', nombre: 'Tipo de Documento', grupo: 'Información Fiscal', orden: 1 },
  { codigo: 'codigo_pais', nombre: 'Código País', grupo: 'Información Fiscal', orden: 2 },
  { codigo: 'condicion_iva', nombre: 'Condición IVA', grupo: 'Información Fiscal', orden: 3 },
  { codigo: 'codigo_moneda', nombre: 'Código Moneda', grupo: 'Información Fiscal', orden: 4 },

  // Contabilidad
  { codigo: 'tipo_operacion', nombre: 'Tipo de Operación', grupo: 'Contabilidad', orden: 1 },
  { codigo: 'tipo_comprobante', nombre: 'Tipo de Comprobante', grupo: 'Contabilidad', orden: 2 },
  { codigo: 'codigo_dimension', nombre: 'Código Dimensión', grupo: 'Contabilidad', orden: 3 },
  { codigo: 'subcuenta', nombre: 'Subcuenta', grupo: 'Contabilidad', orden: 4 },
  { codigo: 'cuenta_contable', nombre: 'Cuenta Contable', grupo: 'Contabilidad', orden: 5 },

  // CUIT Propio (agregado en sesión 27-Dic-2025)
  { codigo: 'cuit_propio', nombre: 'CUIT Propio', grupo: 'Información Fiscal', orden: 5, descripcion: 'CUITs de las empresas propias del tenant para validación automática' }
];

async function migrate() {
  console.log('🚀 Iniciando migración de tipos de parámetro...\n');

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const tipo of tiposParametro) {
    try {
      // Verificar si ya existe
      const existing = await prisma.tipos_parametro.findUnique({
        where: { codigo: tipo.codigo }
      });

      if (existing) {
        console.log(`⏭️  Saltando: ${tipo.codigo} (ya existe)`);
        skipped++;
        continue;
      }

      // Crear nuevo tipo
      await prisma.tipos_parametro.create({
        data: {
          codigo: tipo.codigo,
          nombre: tipo.nombre,
          grupo: tipo.grupo,
          orden: tipo.orden,
          descripcion: tipo.descripcion || null,
          activo: true
        }
      });

      console.log(`✅ Creado: ${tipo.codigo} - ${tipo.nombre} (${tipo.grupo})`);
      created++;

    } catch (error) {
      console.error(`❌ Error con ${tipo.codigo}:`, error.message);
      errors++;
    }
  }

  console.log('\n📊 Resumen de migración:');
  console.log(`   ✅ Creados: ${created}`);
  console.log(`   ⏭️  Saltados: ${skipped}`);
  console.log(`   ❌ Errores: ${errors}`);
  console.log(`   📝 Total: ${tiposParametro.length}`);
}

async function main() {
  try {
    await migrate();
  } catch (error) {
    console.error('Error fatal:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
