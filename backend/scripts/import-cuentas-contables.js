const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function importarCuentasContables() {
  try {
    const csvPath = path.join(__dirname, '../../CuentasContables.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parsear CSV
    const lines = csvContent.split('\n').filter(line => line.trim());
    const [header, ...dataLines] = lines;
    
    console.log('Iniciando importación de cuentas contables...');
    console.log(`Total de líneas a procesar: ${dataLines.length}`);
    
    let importados = 0;
    let errores = 0;
    
    for (const line of dataLines) {
      if (!line.trim()) continue;
      
      try {
        // Parsear línea CSV (separado por punto y coma)
        const parts = line.split(';');
        if (parts.length < 2) {
          console.warn(`Línea incompleta saltada: ${line}`);
          continue;
        }
        
        const codigo = parts[0]?.trim();
        const nombre = parts[1]?.trim();
        
        if (!codigo || !nombre) {
          console.warn(`Línea con datos faltantes saltada: ${line}`);
          continue;
        }
        
        // Crear o actualizar registro en parametros_maestros
        const registro = await prisma.parametroMaestro.upsert({
          where: {
            tipo_campo_codigo: {
              tipo_campo: 'cuenta_contable',
              codigo: codigo
            }
          },
          update: {
            nombre: nombre,
            descripcion: nombre,
            activo: true
          },
          create: {
            codigo: codigo,
            nombre: nombre,
            descripcion: nombre,
            tipo_campo: 'cuenta_contable',
            orden: importados + 1,
            activo: true
          }
        });
        
        importados++;
        
        if (importados % 10 === 0) {
          console.log(`Importados: ${importados} cuentas contables...`);
        }
        
      } catch (error) {
        errores++;
        console.error(`Error importando línea "${line}":`, error.message);
      }
    }
    
    console.log('\n=== RESUMEN DE IMPORTACIÓN ===');
    console.log(`✅ Cuentas contables importadas: ${importados}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📊 Total procesado: ${importados + errores} líneas`);
    
  } catch (error) {
    console.error('Error general en importación:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Verificar si el archivo existe antes de ejecutar
const csvPath = path.join(__dirname, '../../CuentasContables.csv');
if (!fs.existsSync(csvPath)) {
  console.error(`❌ Archivo no encontrado: ${csvPath}`);
  process.exit(1);
}

importarCuentasContables();