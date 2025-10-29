const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...');

  // Crear perfiles
  const now = new Date();
  const adminProfile = await prisma.profiles.upsert({
    where: { codigo: 'ADMIN' },
    update: {},
    create: {
      id: 'profile_admin',
      codigo: 'ADMIN',
      descripcion: 'Administrador del Sistema',
      activo: true,
      createdAt: now,
      updatedAt: now
    }
  });

  const userProfile = await prisma.profiles.upsert({
    where: { codigo: 'USER' },
    update: {},
    create: {
      id: 'profile_user',
      codigo: 'USER',
      descripcion: 'Usuario Estándar',
      activo: true,
      createdAt: now,
      updatedAt: now
    }
  });

  console.log('✅ Perfiles creados:', { adminProfile, userProfile });

  // Crear tenant por defecto
  const defaultTenant = await prisma.tenants.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      slug: 'default',
      nombre: 'Empresa Demo',
      cuit: '20123456789',
      activo: true,
      esDefault: true
    }
  });

  console.log('✅ Tenant por defecto creado:', {
    slug: defaultTenant.slug,
    nombre: defaultTenant.nombre
  });

  // Crear usuario administrador asociado al tenant
  const hashedPassword = await bcrypt.hash('admin123', 12);

  const adminUser = await prisma.users.upsert({
    where: { email: 'admin@rendiciones.com' },
    update: {},
    create: {
      email: 'admin@rendiciones.com',
      password: hashedPassword,
      nombre: 'Administrador',
      apellido: 'Sistema',
      profileId: adminProfile.id,
      tenantId: defaultTenant.id,
      activo: true,
      superuser: true,
      emailVerified: true
    }
  });

  console.log('✅ Usuario administrador creado y asociado al tenant por defecto:', {
    email: adminUser.email,
    nombre: adminUser.nombre
  });

  // Crear monedas
  const monedas = [
    { codigo: 'ARS', nombre: 'Peso Argentino' },
    { codigo: 'USD', nombre: 'Dólar Estadounidense' },
    { codigo: 'EUR', nombre: 'Euro' }
  ];

  for (const monedaData of monedas) {
    await prisma.monedas.upsert({
      where: { codigo: monedaData.codigo },
      update: {},
      create: monedaData
    });
  }

  console.log('✅ Monedas creadas:', monedas.length);

  // Crear cajas de ejemplo con tenant por defecto
  const cajas = [
    {
      codigo: 'CAJA01',
      nombre: 'Caja Principal',
      descripcion: 'Caja principal de operaciones',
      fondoFijo: true,
      limite: 100000,
      monedaId: 'ARS',
      tenantId: defaultTenant.id
    },
    {
      codigo: 'CAJA02',
      nombre: 'Caja Secundaria',
      descripcion: 'Caja para gastos menores',
      fondoFijo: true,
      limite: 50000,
      monedaId: 'ARS',
      tenantId: defaultTenant.id
    }
  ];

  for (const cajaData of cajas) {
    // Primero buscar la moneda
    const moneda = await prisma.monedas.findUnique({
      where: { codigo: cajaData.monedaId }
    });

    const caja = await prisma.cajas.upsert({
      where: {
        codigo_tenantId: {
          codigo: cajaData.codigo,
          tenantId: defaultTenant.id
        }
      },
      update: {},
      create: {
        ...cajaData,
        monedaId: moneda.id
      }
    });

    // Asociar el usuario admin a las cajas
    await prisma.user_cajas.upsert({
      where: {
        userId_cajaId: {
          userId: adminUser.id,
          cajaId: caja.id
        }
      },
      update: {},
      create: {
        userId: adminUser.id,
        cajaId: caja.id
      }
    });
  }

  console.log('✅ Cajas creadas y asociadas al tenant por defecto:', cajas.length);

  // Crear tarjetas de ejemplo asociadas al tenant por defecto
  const tarjetas = [
    { id: 'tarjeta_icbcvc', codigo: 'ICBCVC', descripcion: 'ICBC Visa Classic', tenantId: defaultTenant.id, createdAt: now, updatedAt: now },
    { id: 'tarjeta_icbcvg', codigo: 'ICBCVG', descripcion: 'ICBC Visa Gold', tenantId: defaultTenant.id, createdAt: now, updatedAt: now },
    { id: 'tarjeta_bbvamc', codigo: 'BBVAMC', descripcion: 'BBVA Mastercard', tenantId: defaultTenant.id, createdAt: now, updatedAt: now },
    { id: 'tarjeta_santam', codigo: 'SANTAM', descripcion: 'Santander Mastercard', tenantId: defaultTenant.id, createdAt: now, updatedAt: now },
    { id: 'tarjeta_galici', codigo: 'GALICI', descripcion: 'Banco Galicia', tenantId: defaultTenant.id, createdAt: now, updatedAt: now }
  ];

  for (const tarjetaData of tarjetas) {
    await prisma.tarjetas.upsert({
      where: {
        codigo_tenantId: {
          codigo: tarjetaData.codigo,
          tenantId: defaultTenant.id
        }
      },
      update: {},
      create: tarjetaData
    });
  }

  console.log('✅ Tarjetas de ejemplo creadas:', tarjetas.length);

  // Crear estados de rendiciones
  const estados = [
    { id: 'estado_autor', codigo: 'AUTOR', descripcion: 'Autorizado', color: '#0b933f', createdAt: now, updatedAt: now },
    { id: 'estado_comgen', codigo: 'COMGEN', descripcion: 'Comprobantes Generados', color: '#1159e8', createdAt: now, updatedAt: now },
    { id: 'estado_enaut', codigo: 'ENAUT', descripcion: 'Pendiente de Autorización', color: '#8bc8fd', createdAt: now, updatedAt: now },
    { id: 'estado_gencom', codigo: 'GENCOM', descripcion: 'Generar Comprobante', color: '#8df7ad', createdAt: now, updatedAt: now },
    { id: 'estado_pendiente', codigo: 'PENDIENTE', descripcion: 'En rendición', color: '#f7f980', createdAt: now, updatedAt: now },
    { id: 'estado_rech', codigo: 'RECH', descripcion: 'Rechazado', color: '#f22626', createdAt: now, updatedAt: now }
  ];

  for (const estadoData of estados) {
    await prisma.estados.upsert({
      where: { codigo: estadoData.codigo },
      update: {},
      create: estadoData
    });
  }

  console.log('✅ Estados de rendiciones creados:', estados.length);

  // Crear algunos parámetros maestros de ejemplo con tenant por defecto
  const parametros = [
    // Tipos de producto
    { tipo_campo: 'tipo_producto', codigo: 'TARJETA', nombre: 'Productos de Tarjeta', descripcion: 'Productos de Tarjeta', orden: 1, tenantId: defaultTenant.id },
    { tipo_campo: 'tipo_producto', codigo: 'CREDITO', nombre: 'Productos de Crédito', descripcion: 'Productos de Crédito', orden: 2, tenantId: defaultTenant.id },
    { tipo_campo: 'tipo_producto', codigo: 'SERVICIO', nombre: 'Servicios Bancarios', descripcion: 'Servicios Bancarios', orden: 3, tenantId: defaultTenant.id },
    
    // Tipos de documento
    { tipo_campo: 'tipo_documento', codigo: 'DNI', nombre: 'DNI', descripcion: 'Documento Nacional de Identidad', orden: 1, tenantId: defaultTenant.id },
    { tipo_campo: 'tipo_documento', codigo: 'CUIL', nombre: 'CUIL', descripcion: 'Código Único de Identificación Laboral', orden: 2, tenantId: defaultTenant.id },
    { tipo_campo: 'tipo_documento', codigo: 'CUIT', nombre: 'CUIT', descripcion: 'Código Único de Identificación Tributaria', orden: 3, tenantId: defaultTenant.id },
    
    // Condiciones IVA
    { tipo_campo: 'condicion_iva', codigo: 'RI', nombre: 'Responsable Inscripto', descripcion: 'Responsable Inscripto', orden: 1, tenantId: defaultTenant.id },
    { tipo_campo: 'condicion_iva', codigo: 'RNI', nombre: 'Responsable No Inscripto', descripcion: 'Responsable No Inscripto', orden: 2, tenantId: defaultTenant.id },
    { tipo_campo: 'condicion_iva', codigo: 'EX', nombre: 'Exento', descripcion: 'Exento', orden: 3, tenantId: defaultTenant.id },
    { tipo_campo: 'condicion_iva', codigo: 'MT', nombre: 'Monotributista', descripcion: 'Monotributista', orden: 4, tenantId: defaultTenant.id },
    { tipo_campo: 'condicion_iva', codigo: 'CF', nombre: 'Consumidor Final', descripcion: 'Consumidor Final', orden: 5, tenantId: defaultTenant.id },
    
    // Códigos de moneda
    { tipo_campo: 'codigo_moneda', codigo: 'ARS', nombre: 'Peso Argentino', descripcion: 'Peso Argentino', orden: 1, tenantId: defaultTenant.id },
    { tipo_campo: 'codigo_moneda', codigo: 'USD', nombre: 'Dólar Estadounidense', descripcion: 'Dólar Estadounidense', orden: 2, tenantId: defaultTenant.id },
    { tipo_campo: 'codigo_moneda', codigo: 'EUR', nombre: 'Euro', descripcion: 'Euro', orden: 3, tenantId: defaultTenant.id }
  ];

  for (const parametro of parametros) {
    await prisma.parametros_maestros.upsert({
      where: {
        tipo_campo_codigo: {
          tipo_campo: parametro.tipo_campo,
          codigo: parametro.codigo
        }
      },
      update: {},
      create: parametro
    });
  }

  console.log('✅ Parámetros maestros creados:', parametros.length);

  // Crear relaciones de parámetros con tenant por defecto
  const relaciones = [
    { campo_padre: 'tipo_producto', campo_hijo: 'codigo_producto', descripcion: 'Productos filtrados por Tipo de Producto', tenantId: defaultTenant.id }
  ];

  for (const relacion of relaciones) {
    await prisma.parametros_relaciones.upsert({
      where: {
        campo_padre_campo_hijo_tenantId: {
          campo_padre: relacion.campo_padre,
          campo_hijo: relacion.campo_hijo,
          tenantId: relacion.tenantId
        }
      },
      update: {},
      create: relacion
    });
  }

  console.log('✅ Relaciones de parámetros creadas:', relaciones.length);

  console.log('🎉 Seed completado exitosamente!');
  console.log('');
  console.log('📧 Usuario admin: admin@rendiciones.com');
  console.log('🔑 Contraseña: admin123');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });