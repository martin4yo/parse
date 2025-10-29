const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function importarSubcuentas() {
  try {
    const csvPath = path.join(__dirname, '../../Subcuentas.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parsear CSV
    const lines = csvContent.split('\n').filter(line => line.trim());
    const [header, ...dataLines] = lines;
    
    console.log('Iniciando importación de subcuentas...');
    console.log(`Total de líneas a procesar: ${dataLines.length}`);
    
    let importados = 0;
    let errores = 0;
    
    for (const line of dataLines) {
      if (!line.trim()) continue;
      
      try {
        // Parsear línea CSV (separado por punto y coma)
        const parts = line.split(';');
        if (parts.length < 3) {
          console.warn(`Línea incompleta saltada: ${line}`);
          continue;
        }
        
        const codigo = parts[0]?.trim();
        const nombre = parts[1]?.trim();
        const valorPadre = parts[2]?.trim();
        
        if (!codigo || !nombre) {
          console.warn(`Línea con datos faltantes saltada: ${line}`);
          continue;
        }
        
        // Crear o actualizar registro en parametros_maestros
        const registro = await prisma.parametroMaestro.upsert({
          where: {
            tipo_campo_codigo: {
              tipo_campo: 'subcuenta',
              codigo: codigo
            }
          },
          update: {
            nombre: nombre,
            descripcion: nombre,
            valor_padre: valorPadre || null,
            activo: true
          },
          create: {
            codigo: codigo,
            nombre: nombre,
            descripcion: nombre,
            tipo_campo: 'subcuenta',
            valor_padre: valorPadre || null,
            orden: importados + 1,
            activo: true
          }
        });
        
        importados++;
        
        if (importados % 10 === 0) {
          console.log(`Importados: ${importados} subcuentas...`);
        }
        
      } catch (error) {
        errores++;
        console.error(`Error importando línea "${line}":`, error.message);
      }
    }
    
    console.log('\n=== RESUMEN DE IMPORTACIÓN ===');
    console.log(`✅ Subcuentas importadas: ${importados}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📊 Total procesado: ${importados + errores} líneas`);
    
    // Resumen por valor_padre
    const porPadre = await prisma.parametroMaestro.groupBy({
      by: ['valor_padre'],
      where: { tipo_campo: 'subcuenta' },
      _count: true
    });
    
    console.log('\n=== RESUMEN POR VALOR PADRE ===');
    porPadre.forEach(p => {
      console.log(`${p.valor_padre || 'Sin padre'}: ${p._count} subcuentas`);
    });
    
  } catch (error) {
    console.error('Error general en importación:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Verificar si el archivo existe antes de ejecutar
const csvPath = path.join(__dirname, '../../Subcuentas.csv');
if (!fs.existsSync(csvPath)) {
  console.error(`❌ Archivo no encontrado: ${csvPath}`);
  process.exit(1);
}

importarSubcuentas();