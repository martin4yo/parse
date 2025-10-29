const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function importProveedores() {
  try {
    console.log('🚀 Iniciando importación de proveedores...');
    
    // Leer archivo CSV
    const csvPath = path.join(__dirname, '../../Proveedores.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parsear CSV
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headers = lines[0].split(';').map(h => h.trim());
    
    console.log(`📄 Archivo leído: ${lines.length - 1} proveedores encontrados`);
    console.log(`📋 Campos detectados: ${headers.join(', ')}`);
    
    // Eliminar proveedores existentes del tipo 'proveedor' (opcional)
    const deletedCount = await prisma.parametroMaestro.deleteMany({
      where: { tipo_campo: 'proveedor' }
    });
    console.log(`🗑️ Se eliminaron ${deletedCount.count} proveedores existentes`);
    
    let importados = 0;
    let errores = 0;
    
    // Procesar cada línea (omitir el header)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Parsear valores
      const values = line.split(';').map(v => v.trim());
      
      // Mapear a objeto
      const proveedor = {
        codigo: values[0],
        nombre: values[1],
        cuit: values[2],
        direccion: values[3],
        condicionIva: values[4]
      };
      
      // Validar campos requeridos
      if (!proveedor.codigo || !proveedor.nombre) {
        console.log(`⚠️ Línea ${i + 1}: Proveedor sin código o nombre, omitido`);
        errores++;
        continue;
      }
      
      try {
        // Crear objeto JSON con los campos adicionales
        const parametrosJson = {};
        
        if (proveedor.cuit) parametrosJson.cuit = proveedor.cuit;
        if (proveedor.direccion) parametrosJson.direccion = proveedor.direccion;
        if (proveedor.condicionIva) parametrosJson.condicion_iva = proveedor.condicionIva;
        
        // Insertar en la base de datos
        await prisma.parametroMaestro.create({
          data: {
            codigo: proveedor.codigo,
            nombre: proveedor.nombre,
            descripcion: `Proveedor ${proveedor.codigo} - ${proveedor.nombre}`,
            tipo_campo: 'proveedor',
            valor_padre: null,
            orden: i,
            activo: true,
            parametros_json: Object.keys(parametrosJson).length > 0 ? parametrosJson : null
          }
        });
        
        importados++;
        
        // Mostrar progreso cada 10 registros
        if (importados % 10 === 0) {
          console.log(`✅ ${importados} proveedores importados...`);
        }
        
      } catch (error) {
        console.error(`❌ Error al importar línea ${i + 1} (${proveedor.codigo}):`, error.message);
        errores++;
      }
    }
    
    console.log('\n📊 Resumen de importación:');
    console.log(`✅ Proveedores importados: ${importados}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📋 Total procesados: ${importados + errores}`);
    
    // Verificar algunos registros importados
    const muestra = await prisma.parametroMaestro.findMany({
      where: { tipo_campo: 'proveedor' },
      take: 3
    });
    
    console.log('\n🔍 Muestra de registros importados:');
    muestra.forEach(p => {
      console.log(`  - ${p.codigo}: ${p.nombre}`);
      if (p.parametros_json) {
        console.log(`    JSON: ${JSON.stringify(p.parametros_json)}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error en la importación:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar importación
importProveedores()
  .then(() => {
    console.log('\n✨ Importación completada exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ La importación falló:', error);
    process.exit(1);
  });