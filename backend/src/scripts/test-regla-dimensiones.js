/**
 * Script de prueba para REGLA_DIMENSIONES
 * Verifica el encadenamiento EXTRACT_JSON_FIELDS + CREATE_DISTRIBUTION
 */

const { PrismaClient } = require('@prisma/client');
const BusinessRulesEngine = require('../services/businessRulesEngine');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function testReglaDimensiones() {
  console.log('🧪 Iniciando prueba de REGLA_DIMENSIONES...\n');

  try {
    // 1. Obtener tenant TIMBO por slug
    const tenant = await prisma.tenants.findFirst({
      where: { slug: 'timbo' }
    });

    if (!tenant) {
      console.error('❌ No se encontró tenant con slug "timbo"');
      return;
    }

    console.log(`✅ Tenant encontrado: ${tenant.nombre} (${tenant.id})\n`);

    // 2. Verificar que existe la regla REGLA_DIMENSIONES
    let regla = await prisma.reglas_negocio.findFirst({
      where: {
        codigo: 'REGLA_DIMENSIONES',
        tenantId: tenant.id
      }
    });

    if (!regla) {
      console.log('⚠️  Regla REGLA_DIMENSIONES no encontrada, creando...');

      regla = await prisma.reglas_negocio.create({
        data: {
          id: uuidv4(),
          codigo: 'REGLA_DIMENSIONES',
          nombre: 'Crear distribuciones desde código de producto',
          descripcion: 'Extrae dimensión y subcuentas desde parametros_maestros según codigoProducto y crea las distribuciones automáticamente',
          tipo: 'TRANSFORMACION',
          activa: true,
          prioridad: 100,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          configuracion: {
            aplicaA: 'LINEAS',
            condiciones: [
              {
                campo: 'codigoProducto',
                operador: 'IS_NOT_EMPTY',
                valor: ''
              }
            ],
            acciones: [
              {
                operacion: 'EXTRACT_JSON_FIELDS',
                tabla: 'parametros_maestros',
                campoConsulta: 'codigo',
                valorConsulta: '{codigoProducto}',
                filtroAdicional: {
                  tipo_campo: 'codigo_producto',
                  activo: true
                },
                campos: [
                  {
                    campoJSON: 'dimension.tipo',
                    campoDestino: '_dimensionTipo'
                  },
                  {
                    campoJSON: 'dimension.nombre',
                    campoDestino: '_dimensionNombre'
                  },
                  {
                    campoJSON: 'subcuentas',
                    campoDestino: '_subcuentasJSON'
                  }
                ]
              },
              {
                operacion: 'CREATE_DISTRIBUTION',
                dimensionTipoCampo: '{_dimensionTipo}',
                dimensionNombreCampo: '{_dimensionNombre}',
                subcuentasCampo: '{_subcuentasJSON}'
              }
            ],
            logicOperator: 'AND',
            stopOnMatch: false
          },
          tenantId: tenant.id
        }
      });

      console.log(`✅ Regla creada: ${regla.codigo}\n`);
    } else {
      console.log(`✅ Regla encontrada: ${regla.codigo}\n`);
    }

    // 3. Verificar que existe un producto de prueba en parametros_maestros
    const producto = await prisma.parametros_maestros.findFirst({
      where: {
        tipo_campo: 'codigo_producto',
        codigo: 'PROD001',
        tenantId: tenant.id
      }
    });

    if (!producto) {
      console.error('❌ Producto PROD001 no encontrado en parametros_maestros');
      console.log('   Por favor, crea el producto usando el archivo ejemplo-insert-producto-con-dimension.sql\n');
      return;
    }

    console.log(`✅ Producto encontrado: ${producto.codigo}`);
    console.log(`   Dimensión: ${producto.parametros_json?.dimension?.tipo}`);
    console.log(`   Subcuentas: ${producto.parametros_json?.subcuentas?.length || 0}\n`);

    // 4. Crear documento de prueba
    console.log('📄 Creando documento de prueba...');

    const documento = await prisma.documentos_procesados.create({
      data: {
        id: uuidv4(),
        tipoDocumento: 'FACTURA_A',
        fecha: new Date(),
        total: 1000,
        estadoProcesamiento: 'completado',
        tenantId: tenant.id
      }
    });

    console.log(`✅ Documento creado: ${documento.id}\n`);

    // 5. Crear línea de prueba con codigoProducto
    console.log('📝 Creando línea con codigoProducto...');

    const linea = await prisma.documento_lineas.create({
      data: {
        id: uuidv4(),
        documentoId: documento.id,
        orden: 1,
        codigoProducto: 'PROD001',
        descripcion: 'Producto de prueba',
        cantidad: 1,
        precioUnitario: 1000,
        subtotal: 1000,
        tenantId: tenant.id
      }
    });

    console.log(`✅ Línea creada: ${linea.id}`);
    console.log(`   codigoProducto: ${linea.codigoProducto}\n`);

    // 6. Aplicar reglas con BusinessRulesEngine
    console.log('🔧 Aplicando reglas de negocio...\n');

    const engine = new BusinessRulesEngine(tenant.id);
    await engine.applyRules(documento.id, 'TRANSFORMACION');

    console.log('\n✅ Reglas aplicadas\n');

    // 7. Verificar resultados
    console.log('🔍 Verificando distribuciones creadas...\n');

    const distribuciones = await prisma.documento_distribuciones.findMany({
      where: { lineaId: linea.id },
      include: {
        subcuentas: {
          orderBy: { orden: 'asc' }
        }
      }
    });

    if (distribuciones.length === 0) {
      console.error('❌ No se crearon distribuciones');
      return;
    }

    console.log(`✅ ${distribuciones.length} distribución(es) creada(s):\n`);

    for (const dist of distribuciones) {
      console.log(`📊 Distribución:`);
      console.log(`   Tipo: ${dist.tipoDimension}`);
      console.log(`   Nombre: ${dist.tipoDimensionNombre}`);
      console.log(`   Importe: $${dist.importeDimension}\n`);

      console.log(`   Subcuentas (${dist.subcuentas.length}):`);
      for (const sub of dist.subcuentas) {
        console.log(`   ➕ ${sub.codigoSubcuenta} - ${sub.subcuentaNombre}`);
        console.log(`      ${sub.porcentaje}% = $${sub.importe.toFixed(2)}`);
        if (sub.cuentaContable) {
          console.log(`      Cuenta: ${sub.cuentaContable}`);
        }
      }
      console.log();
    }

    // 8. Validar resultados
    console.log('✅ VALIDACIÓN:\n');

    const distribucion = distribuciones[0];
    const errors = [];

    // Validar que la dimensión coincide con el producto
    if (distribucion.tipoDimension !== producto.parametros_json.dimension.tipo) {
      errors.push(`❌ Tipo de dimensión incorrecto: esperado "${producto.parametros_json.dimension.tipo}", obtenido "${distribucion.tipoDimension}"`);
    } else {
      console.log(`✓ Tipo de dimensión correcto: ${distribucion.tipoDimension}`);
    }

    if (distribucion.tipoDimensionNombre !== producto.parametros_json.dimension.nombre) {
      errors.push(`❌ Nombre de dimensión incorrecto: esperado "${producto.parametros_json.dimension.nombre}", obtenido "${distribucion.tipoDimensionNombre}"`);
    } else {
      console.log(`✓ Nombre de dimensión correcto: ${distribucion.tipoDimensionNombre}`);
    }

    // Validar que tiene 2 subcuentas
    if (distribucion.subcuentas.length !== 2) {
      errors.push(`❌ Cantidad de subcuentas incorrecta: esperado 2, obtenido ${distribucion.subcuentas.length}`);
    } else {
      console.log(`✓ Cantidad de subcuentas correcta: ${distribucion.subcuentas.length}`);
    }

    // Validar que los porcentajes suman 100
    const totalPorcentaje = distribucion.subcuentas.reduce((sum, sub) => sum + parseFloat(sub.porcentaje), 0);
    if (Math.abs(totalPorcentaje - 100) > 0.01) {
      errors.push(`❌ Porcentajes no suman 100: ${totalPorcentaje}`);
    } else {
      console.log(`✓ Porcentajes suman 100: ${totalPorcentaje.toFixed(2)}`);
    }

    // Validar que los importes suman el total
    const totalImporte = distribucion.subcuentas.reduce((sum, sub) => sum + parseFloat(sub.importe), 0);
    if (Math.abs(totalImporte - linea.subtotal) > 0.01) {
      errors.push(`❌ Importes no suman el total: esperado ${linea.subtotal}, obtenido ${totalImporte}`);
    } else {
      console.log(`✓ Importes suman el total: $${totalImporte.toFixed(2)}`);
    }

    // Validar subcuentas individuales
    const subcuentasEsperadas = producto.parametros_json.subcuentas;
    for (let i = 0; i < subcuentasEsperadas.length; i++) {
      const esperada = subcuentasEsperadas[i];
      const obtenida = distribucion.subcuentas[i];

      if (obtenida.codigoSubcuenta !== esperada.codigo) {
        errors.push(`❌ Subcuenta ${i + 1} código incorrecto: esperado "${esperada.codigo}", obtenido "${obtenida.codigoSubcuenta}"`);
      } else {
        console.log(`✓ Subcuenta ${i + 1} código correcto: ${obtenida.codigoSubcuenta}`);
      }

      if (Math.abs(parseFloat(obtenida.porcentaje) - esperada.porcentaje) > 0.01) {
        errors.push(`❌ Subcuenta ${i + 1} porcentaje incorrecto: esperado ${esperada.porcentaje}, obtenido ${obtenida.porcentaje}`);
      } else {
        console.log(`✓ Subcuenta ${i + 1} porcentaje correcto: ${obtenida.porcentaje}%`);
      }
    }

    console.log('\n' + '='.repeat(60));

    if (errors.length > 0) {
      console.error('\n❌ PRUEBA FALLIDA:\n');
      errors.forEach(err => console.error(err));
    } else {
      console.log('\n🎉 ¡PRUEBA EXITOSA! El encadenamiento funciona correctamente.\n');
    }

    // 9. Limpieza (opcional)
    console.log('\n🧹 Limpiando datos de prueba...');

    await prisma.documento_subcuentas.deleteMany({ where: { tenantId: tenant.id, distribucionId: distribucion.id } });
    await prisma.documento_distribuciones.deleteMany({ where: { tenantId: tenant.id, lineaId: linea.id } });
    await prisma.documento_lineas.deleteMany({ where: { tenantId: tenant.id, documentoId: documento.id } });
    await prisma.documentos_procesados.delete({ where: { id: documento.id } });

    console.log('✅ Datos de prueba eliminados\n');

    console.log('Nota: La regla y el producto de prueba NO fueron eliminados para que puedas usarlos.\n');

  } catch (error) {
    console.error('\n❌ Error durante la prueba:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar prueba
testReglaDimensiones()
  .then(() => {
    console.log('✅ Script finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
