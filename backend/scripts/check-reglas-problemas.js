const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function buscarReglasConProblema() {
  try {
    const reglas = await prisma.reglas_negocio.findMany({
      where: {
        tipo: 'TRANSFORMACION'
      }
    });

    console.log(`🔍 Analizando ${reglas.length} reglas tipo TRANSFORMACION...\n`);

    const problematicas = [];

    for (const regla of reglas) {
      const config = regla.configuracion;
      let tieneProblema = false;
      const problemas = [];

      // Revisar condiciones
      if (config.condiciones) {
        config.condiciones.forEach((cond, i) => {
          if (cond.campo && (
            cond.campo.includes('documento_lineas.') ||
            cond.campo.includes('documento_impuestos.')
          )) {
            tieneProblema = true;
            problemas.push(`Condición ${i+1}: campo="${cond.campo}"`);
          }
        });
      }

      // Revisar acciones
      if (config.acciones) {
        config.acciones.forEach((acc, i) => {
          if (acc.campoTexto && (
            acc.campoTexto.includes('documento_lineas.') ||
            acc.campoTexto.includes('documento_impuestos.')
          )) {
            tieneProblema = true;
            problemas.push(`Acción ${i+1}: campoTexto="${acc.campoTexto}"`);
          }
          if (acc.valorConsulta && (
            acc.valorConsulta.includes('documento_lineas.') ||
            acc.valorConsulta.includes('documento_impuestos.')
          )) {
            tieneProblema = true;
            problemas.push(`Acción ${i+1}: valorConsulta="${acc.valorConsulta}"`);
          }
        });
      }

      if (tieneProblema) {
        problematicas.push({
          codigo: regla.codigo,
          nombre: regla.nombre,
          problemas
        });
      }
    }

    if (problematicas.length === 0) {
      console.log('✅ No se encontraron más reglas con el problema de prefijos incorrectos');
    } else {
      console.log(`⚠️ Se encontraron ${problematicas.length} reglas con posibles problemas:\n`);
      problematicas.forEach(r => {
        console.log(`${r.codigo}: ${r.nombre}`);
        r.problemas.forEach(p => console.log(`  - ${p}`));
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

buscarReglasConProblema();
