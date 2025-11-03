const { PrismaClient } = require('@prisma/client');
const BusinessRulesEngine = require('../src/services/businessRulesEngine');

const prisma = new PrismaClient();

async function testAplicarReglasEndpoint() {
  try {
    console.log('🧪 Simulando endpoint /api/documentos/aplicar-reglas...\n');

    // Paso 1: Obtener el tenantId
    const reglaConTenant = await prisma.reglas_negocio.findFirst({
      where: { tenantId: { not: null } },
      select: { tenantId: true }
    });

    if (!reglaConTenant) {
      console.log('❌ No se encontró tenantId');
      return;
    }

    const tenantId = reglaConTenant.tenantId;
    console.log(`✅ TenantId: ${tenantId}\n`);

    // Paso 2: Obtener documentos completados sin exportar
    const documentos = await prisma.documentos_procesados.findMany({
      where: {
        tenantId: tenantId,
        estadoProcesamiento: 'completado',
        exportado: false
      },
      include: {
        documento_lineas: true,
        documento_impuestos: true
      }
    });

    console.log(`📋 Encontrados ${documentos.length} documentos para procesar\n`);

    if (documentos.length === 0) {
      console.log('⚠️ No hay documentos pendientes para aplicar reglas');
      return;
    }

    // Paso 3: Inicializar motor de reglas
    console.log('🔧 Inicializando motor de reglas...');
    const rulesEngine = new BusinessRulesEngine(tenantId);
    await rulesEngine.loadRules('TRANSFORMACION', true, prisma);

    console.log(`✅ ${rulesEngine.rules.length} reglas de tipo TRANSFORMACION cargadas\n`);

    if (rulesEngine.rules.length === 0) {
      console.log('⚠️ No hay reglas de transformación activas');
      return;
    }

    // Paso 4: Aplicar reglas al primer documento (para debugging)
    const documento = documentos[0];

    console.log(`📄 Procesando documento: ${documento.nombreArchivo}`);
    console.log(`   ID: ${documento.id}`);
    console.log(`   CUIT: ${documento.cuitExtraido}`);
    console.log(`   Razón Social ANTES: ${documento.razonSocialExtraida || 'null'}`);
    console.log(`   Código Proveedor ANTES: ${documento.codigoProveedor || 'null'}`);
    console.log(`   Líneas: ${documento.documento_lineas.length}`);
    console.log(`   Impuestos: ${documento.documento_impuestos.length}\n`);

    // Aplicar reglas
    const ruleResult = await rulesEngine.applyRulesToDocument(documento, {
      logExecution: false,
      contexto: 'APLICACION_REGLAS'
    });

    console.log(`\n✅ Resultado de aplicar reglas:`);
    console.log(`   Total reglas aplicadas: ${ruleResult.totalReglasAplicadas}`);
    console.log(`   Reglas en documento: ${ruleResult.reglasAplicadas.documento}`);
    console.log(`   Reglas en líneas: ${ruleResult.reglasAplicadas.lineas}`);
    console.log(`   Reglas en impuestos: ${ruleResult.reglasAplicadas.impuestos}\n`);

    if (ruleResult.totalReglasAplicadas === 0) {
      console.log('⚠️ No se aplicó ninguna regla');
      return;
    }

    const docTransformado = ruleResult.documento;

    // Paso 5: Actualizar documento principal
    if (ruleResult.reglasAplicadas.documento > 0) {
      console.log('📝 Actualizando documento principal...');

      const updateData = {
        razonSocialExtraida: docTransformado.razonSocialExtraida || documento.razonSocialExtraida,
        cuitExtraido: docTransformado.cuitExtraido || documento.cuitExtraido,
        codigoProveedor: docTransformado.codigoProveedor || documento.codigoProveedor,
        numeroComprobanteExtraido: docTransformado.numeroComprobanteExtraido || documento.numeroComprobanteExtraido,
        tipoComprobanteExtraido: docTransformado.tipoComprobanteExtraido || documento.tipoComprobanteExtraido,
        fechaExtraida: docTransformado.fechaExtraida || documento.fechaExtraida,
        importeExtraido: docTransformado.importeExtraido || documento.importeExtraido,
        netoGravadoExtraido: docTransformado.netoGravadoExtraido || documento.netoGravadoExtraido,
        exentoExtraido: docTransformado.exentoExtraido || documento.exentoExtraido,
        impuestosExtraido: docTransformado.impuestosExtraido || documento.impuestosExtraido,
        updatedAt: new Date()
      };

      console.log('\n   Cambios detectados:');
      if (updateData.razonSocialExtraida !== documento.razonSocialExtraida) {
        console.log(`      Razón Social: "${documento.razonSocialExtraida || 'null'}" → "${updateData.razonSocialExtraida}"`);
      }
      if (updateData.codigoProveedor !== documento.codigoProveedor) {
        console.log(`      Código Proveedor: "${documento.codigoProveedor || 'null'}" → "${updateData.codigoProveedor}"`);
      }

      await prisma.documentos_procesados.update({
        where: { id: documento.id },
        data: updateData
      });

      console.log('   ✅ Documento actualizado en BD');
    }

    // Paso 6: Actualizar líneas
    if (ruleResult.reglasAplicadas.lineas > 0 && docTransformado.documento_lineas) {
      console.log(`\n📋 Actualizando ${docTransformado.documento_lineas.length} línea(s)...`);

      for (const linea of docTransformado.documento_lineas) {
        const lineaOriginal = documento.documento_lineas.find(l => l.id === linea.id);

        console.log(`\n   Línea ${linea.id}:`);
        if (linea.codigoProducto !== lineaOriginal?.codigoProducto) {
          console.log(`      Código Producto: "${lineaOriginal?.codigoProducto || 'null'}" → "${linea.codigoProducto}"`);
        }
        if (linea.tipoProducto !== lineaOriginal?.tipoProducto) {
          console.log(`      Tipo Producto: "${lineaOriginal?.tipoProducto || 'null'}" → "${linea.tipoProducto}"`);
        }
        if (linea.cuentaContable !== lineaOriginal?.cuentaContable) {
          console.log(`      Cuenta Contable: "${lineaOriginal?.cuentaContable || 'null'}" → "${linea.cuentaContable}"`);
        }
        if (linea.subcuenta !== lineaOriginal?.subcuenta) {
          console.log(`      Subcuenta: "${lineaOriginal?.subcuenta || 'null'}" → "${linea.subcuenta}"`);
        }
        if (linea.ordenCompra !== lineaOriginal?.ordenCompra) {
          console.log(`      Orden Compra: "${lineaOriginal?.ordenCompra || 'null'}" → "${linea.ordenCompra}"`);
        }

        await prisma.documento_lineas.update({
          where: { id: linea.id },
          data: {
            descripcion: linea.descripcion,
            codigoProducto: linea.codigoProducto,
            tipoProducto: linea.tipoProducto,
            codigoDimension: linea.codigoDimension,
            subcuenta: linea.subcuenta,
            cuentaContable: linea.cuentaContable,
            tipoOrdenCompra: linea.tipoOrdenCompra,
            ordenCompra: linea.ordenCompra
          }
        });
      }

      console.log('\n   ✅ Líneas actualizadas en BD');
    }

    // Paso 7: Actualizar impuestos
    if (ruleResult.reglasAplicadas.impuestos > 0 && docTransformado.documento_impuestos) {
      console.log(`\n💰 Actualizando ${docTransformado.documento_impuestos.length} impuesto(s)...`);

      for (const impuesto of docTransformado.documento_impuestos) {
        const impuestoOriginal = documento.documento_impuestos.find(i => i.id === impuesto.id);

        console.log(`\n   Impuesto ${impuesto.id} (${impuesto.tipo}):`);
        if (impuesto.cuentaContable !== impuestoOriginal?.cuentaContable) {
          console.log(`      Cuenta Contable: "${impuestoOriginal?.cuentaContable || 'null'}" → "${impuesto.cuentaContable}"`);
        }
        if (impuesto.subcuenta !== impuestoOriginal?.subcuenta) {
          console.log(`      Subcuenta: "${impuestoOriginal?.subcuenta || 'null'}" → "${impuesto.subcuenta}"`);
        }

        await prisma.documento_impuestos.update({
          where: { id: impuesto.id },
          data: {
            tipo: impuesto.tipo,
            descripcion: impuesto.descripcion,
            codigoDimension: impuesto.codigoDimension,
            subcuenta: impuesto.subcuenta,
            cuentaContable: impuesto.cuentaContable
          }
        });
      }

      console.log('\n   ✅ Impuestos actualizados en BD');
    }

    // Paso 8: Verificar cambios en BD
    console.log('\n\n🔍 Verificando cambios en BD...');
    const documentoActualizado = await prisma.documentos_procesados.findUnique({
      where: { id: documento.id },
      include: {
        documento_lineas: true,
        documento_impuestos: true
      }
    });

    console.log('\n📄 Documento DESPUÉS:');
    console.log(`   Razón Social: ${documentoActualizado.razonSocialExtraida || 'null'}`);
    console.log(`   Código Proveedor: ${documentoActualizado.codigoProveedor || 'null'}`);

    if (documentoActualizado.documento_lineas.length > 0) {
      const linea = documentoActualizado.documento_lineas[0];
      console.log(`\n📋 Primera línea:`);
      console.log(`   Código Producto: ${linea.codigoProducto || 'null'}`);
      console.log(`   Tipo Producto: ${linea.tipoProducto || 'null'}`);
      console.log(`   Cuenta Contable: ${linea.cuentaContable || 'null'}`);
      console.log(`   Subcuenta: ${linea.subcuenta || 'null'}`);
      console.log(`   Orden Compra: ${linea.ordenCompra || 'null'}`);
    }

    if (documentoActualizado.documento_impuestos.length > 0) {
      console.log(`\n💰 Impuestos:`);
      documentoActualizado.documento_impuestos.forEach(imp => {
        console.log(`   ${imp.tipo}: cuenta=${imp.cuentaContable || 'null'}, subcuenta=${imp.subcuenta || 'null'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
testAplicarReglasEndpoint()
  .then(() => {
    console.log('\n\n✨ Test completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
