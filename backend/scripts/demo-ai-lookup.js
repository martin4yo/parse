/**
 * Demo de AI_LOOKUP
 *
 * Este script demuestra cómo usar la operación AI_LOOKUP
 * para clasificar textos con IA usando parámetros maestros
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const BusinessRulesEngine = require('../src/services/businessRulesEngine');

const prisma = new PrismaClient();

async function crearParametrosEjemplo(tenantId) {
  console.log('\n📦 Creando parámetros de ejemplo...');

  const categorias = [
    {
      codigo: 'COMBUSTIBLE',
      nombre: 'Combustibles y Lubricantes',
      descripcion: 'Gastos en nafta, gasoil, aceite para vehículos',
      tipo_campo: 'categoria_gasto'
    },
    {
      codigo: 'ALIMENTOS',
      nombre: 'Alimentos y Bebidas',
      descripcion: 'Comidas, restaurantes, viandas, catering',
      tipo_campo: 'categoria_gasto'
    },
    {
      codigo: 'TECNOLOGIA',
      nombre: 'Tecnología e Informática',
      descripcion: 'Hardware, software, servicios IT, computadoras, notebooks',
      tipo_campo: 'categoria_gasto'
    },
    {
      codigo: 'OFICINA',
      nombre: 'Insumos de Oficina',
      descripcion: 'Papelería, útiles, toner, cartuchos, resmas',
      tipo_campo: 'categoria_gasto'
    },
    {
      codigo: 'SERVICIOS',
      nombre: 'Servicios Profesionales',
      descripcion: 'Honorarios, consultorías, asesorías legales o contables',
      tipo_campo: 'categoria_gasto'
    }
  ];

  for (const cat of categorias) {
    const existe = await prisma.parametros_maestros.findUnique({
      where: {
        tipo_campo_codigo_tenantId: {
          tipo_campo: cat.tipo_campo,
          codigo: cat.codigo,
          tenantId
        }
      }
    });

    if (!existe) {
      await prisma.parametros_maestros.create({
        data: {
          ...cat,
          id: crypto.randomInt(100000, 999999),
          tenantId,
          activo: true,
          orden: 1,
          updatedAt: new Date()
        }
      });
      console.log(`   ✅ Creado: ${cat.nombre}`);
    } else {
      console.log(`   ⏭️  Ya existe: ${cat.nombre}`);
    }
  }
}

async function crearReglaAILookup(tenantId) {
  console.log('\n📋 Creando regla con AI_LOOKUP...');

  const reglaId = crypto.randomUUID();

  const regla = await prisma.reglas_negocio.create({
    data: {
      id: reglaId,
      codigo: 'DEMO_AI_CLASIFICACION',
      nombre: 'Clasificar Gastos con IA',
      descripcion: 'Usa IA para clasificar automáticamente los gastos según su descripción',
      tipo: 'IMPORTACION_DKT',
      activa: true,
      prioridad: 10,
      version: 1,
      tenantId,
      configuracion: {
        condiciones: [
          {
            campo: 'resumen.descripcionCupon',
            operador: 'IS_NOT_EMPTY',
            valor: ''
          }
        ],
        logicOperator: 'AND',
        acciones: [
          {
            campo: 'categoria',
            operacion: 'AI_LOOKUP',
            campoTexto: '{resumen.descripcionCupon}',
            tabla: 'parametros_maestros',
            filtro: {
              tipo_campo: 'categoria_gasto',
              activo: true
            },
            campoRetorno: 'codigo',
            umbralConfianza: 0.80,
            requiereAprobacion: true,
            instruccionesAdicionales: 'Prioriza la categoría más específica. Si es una estación de servicio, siempre es COMBUSTIBLE. Si es un restaurante, es ALIMENTOS.',
            valorDefecto: 'SIN_CLASIFICAR'
          }
        ],
        stopOnMatch: false
      },
      updatedAt: new Date()
    }
  });

  console.log(`   ✅ Regla creada: ${regla.id}`);
  return regla;
}

async function probarClasificacion(tenantId) {
  console.log('\n🧪 Probando clasificación con IA...\n');

  const engine = new BusinessRulesEngine(tenantId);
  await engine.loadRules('IMPORTACION_DKT', true);

  const ejemplos = [
    { descripcionCupon: 'YPF FULL ESTACION DE SERVICIO' },
    { descripcionCupon: 'NOTEBOOK LENOVO THINKPAD 15 PULGADAS' },
    { descripcionCupon: 'RESMA PAPEL A4 AUTOR X 500 HOJAS' },
    { descripcionCupon: 'RESTAURANTE LA PARRILLA ARGENTINA' },
    { descripcionCupon: 'HONORARIOS PROFESIONALES CONTADOR' }
  ];

  for (const ejemplo of ejemplos) {
    console.log(`\n📝 Texto: "${ejemplo.descripcionCupon}"`);

    const itemData = {
      id: crypto.randomUUID(),
      resumen: ejemplo
    };

    const resultado = await engine.applyRules(
      itemData,
      ejemplo,
      {
        tipo: 'IMPORTACION_DKT',
        contexto: 'DEMO',
        logExecution: false
      }
    );

    console.log(`   ✅ Clasificado como: ${resultado.data.categoria || 'PENDIENTE'}`);
    console.log(`   Reglas aplicadas: ${resultado.rulesApplied}`);
  }
}

async function mostrarSugerenciasPendientes(tenantId) {
  console.log('\n📊 Sugerencias de IA pendientes:\n');

  const sugerencias = await prisma.sugerencias_ia.findMany({
    where: {
      tenantId,
      estado: 'pendiente'
    },
    include: {
      reglas_negocio: {
        select: {
          nombre: true
        }
      }
    },
    orderBy: {
      confianza: 'desc'
    }
  });

  if (sugerencias.length === 0) {
    console.log('   No hay sugerencias pendientes');
    return;
  }

  for (const sug of sugerencias) {
    console.log(`\n   📌 ID: ${sug.id}`);
    console.log(`   Texto: "${sug.textoAnalizado}"`);
    console.log(`   Sugerencia: ${sug.valorSugerido.nombre || sug.valorSugerido.codigo}`);
    console.log(`   Confianza: ${(parseFloat(sug.confianza) * 100).toFixed(1)}%`);
    console.log(`   Razón: ${sug.razon}`);
    console.log(`   Estado: ${sug.estado}`);
  }

  console.log(`\n   Total pendientes: ${sugerencias.length}`);
}

async function main() {
  try {
    console.log('🚀 Demo de AI_LOOKUP\n');
    console.log('=' .repeat(60));

    // Buscar tenant default
    const tenant = await prisma.tenants.findUnique({
      where: { slug: 'default' }
    });

    if (!tenant) {
      console.error('❌ Tenant "default" no encontrado');
      return;
    }

    console.log(`✅ Usando tenant: ${tenant.nombre} (${tenant.id})`);

    // Paso 1: Crear parámetros
    await crearParametrosEjemplo(tenant.id);

    // Paso 2: Crear regla
    const regla = await crearReglaAILookup(tenant.id);

    // Paso 3: Probar clasificación
    await probarClasificacion(tenant.id);

    // Paso 4: Mostrar sugerencias pendientes
    await mostrarSugerenciasPendientes(tenant.id);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Demo completado exitosamente!\n');
    console.log('📌 Próximos pasos:');
    console.log('   1. Revisar sugerencias en /api/sugerencias-ia');
    console.log('   2. Aprobar/rechazar desde la UI');
    console.log('   3. Ajustar umbral de confianza según necesidad\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar demo
main();
